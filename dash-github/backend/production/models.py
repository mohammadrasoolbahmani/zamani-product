import re
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

# --- نقش‌های شناخته‌شدهٔ تولیدکنندگان -------------------------------------
ROLE_SIXTY = "مدیر ۶۰ درصد"
ROLE_NINETY = "مدیر ۹۰ درصد"
ROLE_MATERIAL = "مدیر مواد اولیه"

# --- انواع محصول برای فیلتر داشبورد --------------------------------------
PRODUCT_TYPE_60 = "60"
PRODUCT_TYPE_90 = "90"
PRODUCT_TYPES = (PRODUCT_TYPE_60, PRODUCT_TYPE_90)

_PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")


def product_type_q(product_type, field_prefix: str = "product__") -> models.Q:
    """Q object that narrows a records queryset to 60% or 90% products."""
    value = str(product_type or "").strip()
    if value not in PRODUCT_TYPES:
        return models.Q()
    persian = "۶۰ درصد" if value == PRODUCT_TYPE_60 else "۹۰ درصد"
    latin = "60 درصد" if value == PRODUCT_TYPE_60 else "90 درصد"
    column = f"{field_prefix}name__contains"
    return models.Q(**{column: persian}) | models.Q(**{column: latin})


class Product(models.Model):
    """A finished meat product that can be produced."""

    name = models.CharField("نام محصول", max_length=120, unique=True)
    image = models.ImageField("تصویر", upload_to="products/%Y/%m/", blank=True, null=True)
    is_active = models.BooleanField("فعال", default=True)
    created_at = models.DateTimeField("تاریخ ایجاد", auto_now_add=True)

    class Meta:
        verbose_name = "محصول"
        verbose_name_plural = "محصولات"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @staticmethod
    def percent_of_name(name: str) -> str | None:
        """Return "60" / "90" when the product name carries a percentage."""
        if "۶۰ درصد" in name or "60 درصد" in name:
            return PRODUCT_TYPE_60
        if "۹۰ درصد" in name or "90 درصد" in name:
            return PRODUCT_TYPE_90
        return None

    @property
    def percent(self) -> str | None:
        return self.percent_of_name(self.name)

    @staticmethod
    def grams_of_name(name: str) -> int | None:
        """Read the nominal weight (e.g. «۱۰۰ گرمی») out of a product name."""
        normalized = str(name).translate(_PERSIAN_DIGITS)
        match = re.search(r"(\d+)\s*گرمی", normalized)
        return int(match.group(1)) if match else None


class Producer(models.Model):
    """A production manager/company representative who submits production."""

    name = models.CharField("نام تولیدکننده", max_length=120, unique=True)
    role = models.CharField("سمت / سهم", max_length=120)
    sort_order = models.PositiveSmallIntegerField("ترتیب نمایش", default=0)
    is_active = models.BooleanField("فعال", default=True)
    created_at = models.DateTimeField("تاریخ ایجاد", auto_now_add=True)

    class Meta:
        verbose_name = "تولیدکننده"
        verbose_name_plural = "تولیدکنندگان"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.role})"


class ProductionRecord(models.Model):
    """A production entry for one product and date."""

    date = models.DateField("تاریخ تولید", default=timezone.localdate)
    producer = models.ForeignKey(
        Producer,
        verbose_name="تولیدکننده",
        on_delete=models.PROTECT,
        related_name="records",
    )
    product = models.ForeignKey(
        Product,
        verbose_name="محصول",
        on_delete=models.PROTECT,
        related_name="records",
    )
    delivered_meat_kg = models.DecimalField(
        "وزن گوشت تحویل داده شده (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("0"),
    )
    amount_kg = models.DecimalField(
        "وزن گوشت تولید شده (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        null=True,
        blank=True,
        default=None,
    )
    packages_count = models.PositiveIntegerField("تعداد بسته‌های تولید شده", default=0)
    waste_kg = models.DecimalField(
        "وزن معدومی‌ها (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("0"),
    )
    scrap_kg = models.DecimalField(
        "وزن ضایعات (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("0"),
    )
    note = models.TextField("یادداشت", max_length=500, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="ثبت‌کننده",
        on_delete=models.PROTECT,
        related_name="production_records",
    )
    created_at = models.DateTimeField("تاریخ ثبت", auto_now_add=True)

    class Meta:
        verbose_name = "سابقه تولید"
        verbose_name_plural = "سوابق تولید"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["date"], name="record_date_idx"),
            models.Index(fields=["product", "date"], name="record_product_date_idx"),
            models.Index(fields=["producer", "date"], name="record_producer_date_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(delivered_meat_kg__gte=0),
                name="production_delivered_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(waste_kg__gte=0),
                name="production_waste_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(scrap_kg__gte=0),
                name="production_scrap_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.producer} — {self.product} — {self.date}"


class GarriRecord(models.Model):
    """Per-cart (گاری) meat input registered by the materials manager."""

    class Garri(models.TextChoices):
        ONE = "1", "گاری ۱"
        TWO = "2", "گاری ۲"
        THREE = "3", "گاری ۳"
        FOUR = "4", "گاری ۴"
        FIVE = "5", "گاری ۵"

    date = models.DateField("تاریخ", default=timezone.localdate)
    producer = models.ForeignKey(
        Producer,
        verbose_name="تولیدکننده",
        on_delete=models.PROTECT,
        related_name="garri_records",
    )
    garri = models.CharField(
        "گاری",
        max_length=5,
        choices=Garri.choices,
        default=Garri.ONE,
    )
    meat_input_kg = models.DecimalField(
        "وزن گوشت ورودی (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("0"),
    )
    meat_output_kg = models.DecimalField(
        "وزن گوشت خروجی (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("0"),
    )
    note = models.TextField("یادداشت", max_length=500, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="ثبت‌کننده",
        on_delete=models.PROTECT,
        related_name="garri_records",
    )
    created_at = models.DateTimeField("تاریخ ثبت", auto_now_add=True)

    class Meta:
        verbose_name = "سابقه گاری"
        verbose_name_plural = "سوابق گاری"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["date"], name="garri_date_idx"),
            models.Index(fields=["garri", "date"], name="garri_garri_date_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["date", "producer", "garri"],
                name="garri_unique_per_day",
            ),
            models.CheckConstraint(
                condition=models.Q(meat_input_kg__gt=0),
                name="garri_meat_input_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_garri_display()} — {self.date}"


class MaterialRecord(models.Model):
    """Raw-material (onion/chicken) entry for the materials manager."""

    date = models.DateField("تاریخ", default=timezone.localdate)
    producer = models.ForeignKey(
        Producer,
        verbose_name="تولیدکننده",
        on_delete=models.PROTECT,
        related_name="material_records",
    )
    onion_input_kg = models.DecimalField(
        "ورودی پیاز (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("0"),
    )
    chicken_input_kg = models.DecimalField(
        "ورودی مرغ (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("0"),
    )
    onion_used_kg = models.DecimalField(
        "پیاز مصرفی (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("0"),
    )
    chicken_used_kg = models.DecimalField(
        "مرغ مصرفی (کیلوگرم)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("0"),
    )
    note = models.TextField("یادداشت", max_length=500, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="ثبت‌کننده",
        on_delete=models.PROTECT,
        related_name="material_records",
    )
    created_at = models.DateTimeField("تاریخ ثبت", auto_now_add=True)

    class Meta:
        verbose_name = "سابقه مواد اولیه"
        verbose_name_plural = "سوابق مواد اولیه"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["date"], name="material_date_idx"),
        ]

    def __str__(self) -> str:
        return f"مواد اولیه — {self.date}"
