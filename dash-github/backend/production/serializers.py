from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    PRODUCT_TYPE_90,
    ROLE_NINETY,
    GarriRecord,
    MaterialRecord,
    Producer,
    Product,
    ProductionRecord,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "display_name",
            "email",
            "role",
            "is_staff",
            "is_superuser",
            "is_active",
            "date_joined",
            "last_login",
        ]
        read_only_fields = fields

    def get_full_name(self, obj) -> str:
        return obj.get_full_name().strip()

    def get_display_name(self, obj) -> str:
        return obj.get_full_name().strip() or obj.username

    def get_role(self, obj) -> str:
        if obj.is_superuser:
            return "مدیر ارشد"
        if obj.is_staff:
            return "مدیر"
        return "تولیدکننده"


class UserProfileSerializer(serializers.ModelSerializer):
    """Fields a signed-in user may edit on their own profile."""

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email"]
        extra_kwargs = {
            "first_name": {"required": False, "max_length": 150},
            "last_name": {"required": False, "max_length": 150},
            "email": {"required": False, "allow_blank": True},
        }

    def validate_first_name(self, value):
        return value.strip()

    def validate_last_name(self, value):
        return value.strip()


class UserAdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8,
        style={"input_type": "password"},
        error_messages={"min_length": "رمز عبور باید حداقل ۸ کاراکتر باشد."},
    )
    full_name = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "display_name",
            "email",
            "password",
            "role",
            "is_active",
            "is_staff",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "is_staff", "date_joined", "last_login"]
        extra_kwargs = {
            "username": {"required": True},
            "is_active": {"required": False},
        }

    def get_full_name(self, obj) -> str:
        return obj.get_full_name().strip()

    def get_display_name(self, obj) -> str:
        return obj.get_full_name().strip() or obj.username

    def get_role(self, obj) -> str:
        if obj.is_superuser:
            return "مدیر ارشد"
        if obj.is_staff:
            return "مدیر"
        return "تولیدکننده"

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "رمز عبور الزامی است."})
        user = User(**validated_data)
        validate_password(password, user=user)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        # Username and password are intentionally immutable through this API.
        validated_data.pop("username", None)
        validated_data.pop("password", None)
        return super().update(instance, validated_data)


class ProducerSerializer(serializers.ModelSerializer):
    records_count = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Producer
        fields = [
            "id",
            "name",
            "role",
            "display_name",
            "sort_order",
            "is_active",
            "records_count",
            "created_at",
        ]
        read_only_fields = ["id", "display_name", "records_count", "created_at"]

    def get_records_count(self, obj):
        annotated = getattr(obj, "records_count", None)
        return annotated if annotated is not None else obj.records.count()

    def get_display_name(self, obj) -> str:
        return f"{obj.name} ({obj.role})"

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("نام تولیدکننده نمی‌تواند خالی باشد.")
        return value

    def validate_role(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("سمت تولیدکننده نمی‌تواند خالی باشد.")
        return value


class ProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    records_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "image",
            "image_url",
            "is_active",
            "records_count",
            "created_at",
        ]
        read_only_fields = ["id", "image_url", "records_count", "created_at"]
        extra_kwargs = {
            "image": {"required": False, "allow_null": True},
            "name": {"required": True},
        }

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

    def get_records_count(self, obj):
        annotated = getattr(obj, "records_count", None)
        return annotated if annotated is not None else obj.records.count()

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("نام محصول نمی‌تواند خالی باشد.")
        return value


class ProductionRecordSerializer(serializers.ModelSerializer):
    producer_name = serializers.CharField(source="producer.name", read_only=True)
    producer_role = serializers.CharField(source="producer.role", read_only=True)
    producer_display = serializers.CharField(source="producer.__str__", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_image_url = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductionRecord
        fields = [
            "id",
            "date",
            "producer",
            "producer_name",
            "producer_role",
            "producer_display",
            "product",
            "product_name",
            "product_image_url",
            "delivered_meat_kg",
            "amount_kg",
            "packages_count",
            "waste_kg",
            "scrap_kg",
            "note",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at"]
        extra_kwargs = {
            "delivered_meat_kg": {"required": False},
            "amount_kg": {"required": False, "allow_null": True},
            "packages_count": {"required": False},
            "waste_kg": {"required": False},
            "scrap_kg": {"required": False},
            "note": {"required": False, "allow_blank": True},
        }

    def get_product_image_url(self, obj):
        if not obj.product.image:
            return None
        request = self.context.get("request")
        url = obj.product.image.url
        return request.build_absolute_uri(url) if request else url

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.get_full_name().strip() or obj.created_by.username

    def validate_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("ثبت تولید برای تاریخ آینده مجاز نیست.")
        return value

    def validate_producer(self, producer):
        if not producer.is_active:
            raise serializers.ValidationError(
                "این تولیدکننده غیرفعال است و قابل انتخاب نیست."
            )
        return producer

    def validate_product(self, product):
        if not product.is_active:
            raise serializers.ValidationError("این محصول غیرفعال است و قابل انتخاب نیست.")
        return product

    def validate_delivered_meat_kg(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "وزن گوشت تحویل داده شده نمی‌تواند منفی باشد."
            )
        return value

    def validate_amount_kg(self, value):
        if value is None:
            return value
        if value <= 0:
            raise serializers.ValidationError(
                "وزن گوشت تولید شده باید بیشتر از صفر باشد."
            )
        return value

    def validate_packages_count(self, value):
        if value < 0:
            raise serializers.ValidationError("تعداد بسته نمی‌تواند منفی باشد.")
        return value

    def validate_waste_kg(self, value):
        if value < 0:
            raise serializers.ValidationError("وزن معدومی‌ها نمی‌تواند منفی باشد.")
        return value

    def validate_scrap_kg(self, value):
        if value < 0:
            raise serializers.ValidationError("وزن ضایعات نمی‌تواند منفی باشد.")
        return value

    def validate_note(self, value):
        return (value or "").strip()[:500]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        producer = attrs.get("producer") or getattr(self.instance, "producer", None)
        product = attrs.get("product") or getattr(self.instance, "product", None)
        role = (producer.role if producer else "").strip()
        errors = {}

        if role == ROLE_NINETY:
            # خانم زارع: فقط محصولات ۹۰ درصد، بدون وزن تحویلی.
            if product and product.percent != PRODUCT_TYPE_90:
                errors["product"] = (
                    "برای مدیر ۹۰ درصد فقط محصولات ۹۰ درصد قابل انتخاب است."
                )
            packages = int(attrs.get("packages_count") or 0)
            if packages <= 0:
                errors["packages_count"] = "تعداد بسته باید بزرگ‌تر از صفر باشد."
            attrs["delivered_meat_kg"] = Decimal("0")
            amount = attrs.get("amount_kg")
            if amount is None and product is not None:
                grams = Product.grams_of_name(product.name)
                if grams:
                    attrs["amount_kg"] = (
                        Decimal(packages) * Decimal(grams) / Decimal(1000)
                    )
        else:
            delivered = attrs.get("delivered_meat_kg")
            if delivered is None and self.instance:
                delivered = self.instance.delivered_meat_kg
            if delivered is None or delivered <= 0:
                errors["delivered_meat_kg"] = (
                    "وزن گوشت تحویل داده شده باید بیشتر از صفر باشد."
                )

            amount = attrs.get("amount_kg")
            if amount is None and self.instance:
                amount = self.instance.amount_kg
            if amount is None or amount <= 0:
                errors["amount_kg"] = "وزن گوشت تولید شده باید بیشتر از صفر باشد."

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("created_by", None)
        return super().update(instance, validated_data)


class GarriRecordSerializer(serializers.ModelSerializer):
    producer_name = serializers.CharField(source="producer.name", read_only=True)
    producer_role = serializers.CharField(source="producer.role", read_only=True)
    garri_display = serializers.CharField(source="get_garri_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    is_update = serializers.SerializerMethodField()

    class Meta:
        model = GarriRecord
        fields = [
            "id",
            "date",
            "producer",
            "producer_name",
            "producer_role",
            "garri",
            "garri_display",
            "meat_input_kg",
            "meat_output_kg",
            "note",
            "created_by",
            "created_by_name",
            "created_at",
            "is_update",
        ]
        read_only_fields = ["id", "created_by", "created_at", "is_update"]
        extra_kwargs = {
            "note": {"required": False, "allow_blank": True},
        }
        # The (date, producer, cart) uniqueness is enforced by our upsert in
        # `create()` so that re-submitting a cart edits it instead of failing.
        validators = []

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.get_full_name().strip() or obj.created_by.username

    def get_is_update(self, obj) -> bool:
        return bool(getattr(self, "_updated", False))

    def validate_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("ثبت گاری برای تاریخ آینده مجاز نیست.")
        return value

    def validate_producer(self, producer):
        if not producer.is_active:
            raise serializers.ValidationError(
                "این تولیدکننده غیرفعال است و قابل انتخاب نیست."
            )
        return producer

    def validate_meat_input_kg(self, value):
        if value <= 0:
            raise serializers.ValidationError("وزن گوشت ورودی باید بیشتر از صفر باشد.")
        return value

    def validate_meat_output_kg(self, value):
        if value < 0:
            raise serializers.ValidationError("وزن گوشت خروجی نمی‌تواند منفی باشد.")
        return value

    def validate_note(self, value):
        return (value or "").strip()[:500]

    def create(self, validated_data):
        """One row per (date, producer, cart): re-submitting updates it in place."""
        validated_data["created_by"] = self.context["request"].user
        existing = GarriRecord.objects.filter(
            date=validated_data.get("date"),
            producer=validated_data.get("producer"),
            garri=validated_data.get("garri"),
        ).first()
        if existing:
            for field, value in validated_data.items():
                if field == "created_by":
                    continue
                setattr(existing, field, value)
            existing.save()
            self._updated = True
            return existing
        self._updated = False
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("created_by", None)
        self._updated = True
        return super().update(instance, validated_data)


class MaterialRecordSerializer(serializers.ModelSerializer):
    producer_name = serializers.CharField(source="producer.name", read_only=True)
    producer_role = serializers.CharField(source="producer.role", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MaterialRecord
        fields = [
            "id",
            "date",
            "producer",
            "producer_name",
            "producer_role",
            "onion_input_kg",
            "chicken_input_kg",
            "onion_used_kg",
            "chicken_used_kg",
            "note",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at"]
        extra_kwargs = {
            "note": {"required": False, "allow_blank": True},
        }

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.get_full_name().strip() or obj.created_by.username

    def validate_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("ثبت مواد اولیه برای تاریخ آینده مجاز نیست.")
        return value

    def validate_producer(self, producer):
        if not producer.is_active:
            raise serializers.ValidationError(
                "این تولیدکننده غیرفعال است و قابل انتخاب نیست."
            )
        return producer

    def validate_note(self, value):
        return (value or "").strip()[:500]

    def _validate_non_negative(self, field_label, value):
        if value < 0:
            raise serializers.ValidationError(f"{field_label} نمی‌تواند منفی باشد.")
        return value

    def validate_onion_input_kg(self, value):
        return self._validate_non_negative("ورودی پیاز", value)

    def validate_chicken_input_kg(self, value):
        return self._validate_non_negative("ورودی مرغ", value)

    def validate_onion_used_kg(self, value):
        return self._validate_non_negative("پیاز مصرفی", value)

    def validate_chicken_used_kg(self, value):
        return self._validate_non_negative("مرغ مصرفی", value)

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("created_by", None)
        return super().update(instance, validated_data)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Return the public user object alongside the JWT pair."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user, context=self.context).data
        return data
