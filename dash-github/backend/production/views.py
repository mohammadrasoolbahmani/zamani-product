from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import connection, transaction
from django.db.models import Count, ProtectedError, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import (
    PRODUCT_TYPES,
    ROLE_NINETY,
    GarriRecord,
    MaterialRecord,
    Producer,
    Product,
    ProductionRecord,
    product_type_q,
)
from .permissions import IsAdminOrReadOnly, IsRecordOwnerOrAdmin
from .pagination import StandardResultsSetPagination
from .serializers import (
    CustomTokenObtainPairSerializer,
    GarriRecordSerializer,
    MaterialRecordSerializer,
    ProducerSerializer,
    ProductSerializer,
    ProductionRecordSerializer,
    UserAdminSerializer,
    UserProfileSerializer,
    UserSerializer,
)
from .exports import build_report_workbook
from .services import (
    get_dashboard_stats,
    get_product_distribution,
    get_production_chart,
    get_report_summary,
    parse_iso_date,
)

User = get_user_model()


class HealthView(APIView):
    """Lightweight liveness/readiness probe used by the hosting platform."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            connection.ensure_connection()
        except Exception:
            return Response(
                {"status": "error", "database": "unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {
                "status": "ok",
                "database": "ok",
                "time": timezone.now().isoformat(),
            }
        )


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get("old_password", "")
        new_password = request.data.get("new_password", "")

        if not request.user.check_password(old_password):
            raise ValidationError({"old_password": "رمز عبور فعلی درست نیست."})
        if not new_password:
            raise ValidationError({"new_password": "رمز عبور جدید الزامی است."})
        if old_password == new_password:
            raise ValidationError(
                {"new_password": "رمز عبور جدید باید با رمز فعلی متفاوت باشد."}
            )

        validate_password(new_password, user=request.user)
        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        return Response({"detail": "رمز عبور با موفقیت تغییر کرد."})


class UserViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Admin-only management of the people who can record production."""

    queryset = User.objects.order_by("username")
    serializer_class = UserAdminSerializer
    permission_classes = [IsAdminUser]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance == request.user and request.data.get("is_active") is False:
            raise ValidationError(
                {"is_active": "نمی‌توانید حساب کاربری خودتان را غیرفعال کنید."}
            )
        if instance.is_superuser and request.data.get("is_active") is False:
            raise ValidationError(
                {"is_active": "حساب مدیر ارشد از این مسیر غیرفعال نمی‌شود."}
            )
        return super().update(request, *args, **kwargs)


class ProducerViewSet(viewsets.ModelViewSet):
    serializer_class = ProducerSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name", "role"]
    ordering_fields = ["sort_order", "name", "created_at"]
    ordering = ["sort_order", "name"]

    def get_queryset(self):
        queryset = Producer.objects.annotate(records_count=Count("records"))
        active = self.request.query_params.get("active")
        if active in {"1", "true", "True"}:
            queryset = queryset.filter(is_active=True)
        elif active in {"0", "false", "False"}:
            queryset = queryset.filter(is_active=False)
        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {
                    "detail": "این تولیدکننده سابقه تولید دارد؛ به‌جای حذف، او را غیرفعال کنید."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = Product.objects.annotate(records_count=Count("records"))
        active = self.request.query_params.get("active")
        if active in {"1", "true", "True"}:
            queryset = queryset.filter(is_active=True)
        elif active in {"0", "false", "False"}:
            queryset = queryset.filter(is_active=False)
        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {
                    "detail": "این محصول سابقه تولید دارد؛ به‌جای حذف، آن را غیرفعال کنید."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductionRecordViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ProductionRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAuthenticated(), IsRecordOwnerOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = ProductionRecord.objects.select_related(
            "producer", "product", "created_by"
        )
        params = self.request.query_params

        producer = params.get("producer")
        if producer:
            queryset = queryset.filter(producer_id=producer)

        product = params.get("product")
        if product:
            queryset = queryset.filter(product_id=product)

        product_type = params.get("product_type")
        if product_type:
            queryset = queryset.filter(product_type_q(product_type))

        start_date = parse_iso_date(params.get("start_date"), "start_date")
        end_date = parse_iso_date(params.get("end_date"), "end_date")
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(product__name__icontains=search)
                | Q(producer__name__icontains=search)
                | Q(producer__role__icontains=search)
                | Q(created_by__username__icontains=search)
                | Q(created_by__first_name__icontains=search)
                | Q(created_by__last_name__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk_create(self, request):
        """Create several product rows (packages + product) for one working day."""

        items = request.data.get("items")
        if not isinstance(items, list) or not items:
            raise ValidationError({"items": "حداقل یک محصول باید ثبت شود."})
        if len(items) > 50:
            raise ValidationError({"items": "حداکثر ۵۰ محصول در هر ثبت مجاز است."})

        producer_id = request.data.get("producer")
        producer = Producer.objects.filter(pk=producer_id).first() if producer_id else None
        if producer is None:
            raise ValidationError({"producer": "تولیدکننده معتبر نیست."})
        if (producer.role or "").strip() != ROLE_NINETY:
            raise ValidationError(
                {"producer": "ثبت گروهی فقط برای مدیر ۹۰ درصد مجاز است."}
            )

        date = request.data.get("date")
        waste = request.data.get("waste_kg", "0") or "0"
        scrap = request.data.get("scrap_kg", "0") or "0"
        note = (request.data.get("note") or "").strip()

        created = []
        with transaction.atomic():
            for index, item in enumerate(items):
                if not isinstance(item, dict):
                    raise ValidationError({"items": "ساختار هر ردیف معتبر نیست."})
                payload = {
                    "date": date,
                    "producer": producer.pk,
                    "product": item.get("product"),
                    "packages_count": item.get("packages_count"),
                    "delivered_meat_kg": "0",
                    "waste_kg": waste if index == 0 else "0",
                    "scrap_kg": scrap if index == 0 else "0",
                    "note": note if index == 0 else "",
                }
                serializer = self.get_serializer(data=payload)
                serializer.is_valid(raise_exception=True)
                created.append(serializer.save())

        return Response(
            self.get_serializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class GarriRecordViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Cart (گاری) meat-input entries recorded by the materials manager."""

    serializer_class = GarriRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAuthenticated(), IsRecordOwnerOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = GarriRecord.objects.select_related("producer", "created_by")
        params = self.request.query_params

        producer = params.get("producer")
        if producer:
            queryset = queryset.filter(producer_id=producer)

        garri = params.get("garri")
        if garri in GarriRecord.Garri.values:
            queryset = queryset.filter(garri=garri)

        start_date = parse_iso_date(params.get("start_date"), "start_date")
        end_date = parse_iso_date(params.get("end_date"), "end_date")
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(producer__name__icontains=search)
                | Q(note__icontains=search)
                | Q(created_by__username__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MaterialRecordViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Raw-material entries recorded by the materials manager."""

    serializer_class = MaterialRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAuthenticated(), IsRecordOwnerOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = MaterialRecord.objects.select_related("producer", "created_by")
        params = self.request.query_params

        producer = params.get("producer")
        if producer:
            queryset = queryset.filter(producer_id=producer)

        start_date = parse_iso_date(params.get("start_date"), "start_date")
        end_date = parse_iso_date(params.get("end_date"), "end_date")
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


def _display_name(user) -> str:
    if not user:
        return ""
    return user.get_full_name().strip() or user.username


def _producer_payload(producer):
    if not producer:
        return None
    return {"id": producer.id, "name": producer.name, "role": producer.role}


def _garri_payload(record: GarriRecord) -> dict:
    return {
        "id": record.id,
        "garri": record.garri,
        "garri_display": record.get_garri_display(),
        "meat_input_kg": float(record.meat_input_kg or 0),
        "meat_output_kg": float(record.meat_output_kg or 0),
        "note": record.note,
        "created_by": record.created_by_id,
        "created_by_name": _display_name(record.created_by),
        "created_at": record.created_at.isoformat(),
    }


def _material_payload(record: MaterialRecord) -> dict:
    return {
        "id": record.id,
        "onion_input_kg": float(record.onion_input_kg or 0),
        "chicken_input_kg": float(record.chicken_input_kg or 0),
        "onion_used_kg": float(record.onion_used_kg or 0),
        "chicken_used_kg": float(record.chicken_used_kg or 0),
        "note": record.note,
        "created_by": record.created_by_id,
        "created_by_name": _display_name(record.created_by),
        "created_at": record.created_at.isoformat(),
    }


class WorkdayListView(APIView):
    """Cart weights and raw materials grouped into one row per working day."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = request.query_params
        producer = params.get("producer")
        garri = params.get("garri")
        exact_date = parse_iso_date(params.get("date"), "date")
        start_date = parse_iso_date(params.get("start_date"), "start_date")
        end_date = parse_iso_date(params.get("end_date"), "end_date")

        carts = GarriRecord.objects.select_related("producer", "created_by")
        materials = MaterialRecord.objects.select_related("producer", "created_by")

        if producer:
            carts = carts.filter(producer_id=producer)
            materials = materials.filter(producer_id=producer)
        if garri in GarriRecord.Garri.values:
            carts = carts.filter(garri=garri)
        if exact_date:
            carts = carts.filter(date=exact_date)
            materials = materials.filter(date=exact_date)
        if start_date:
            carts = carts.filter(date__gte=start_date)
            materials = materials.filter(date__gte=start_date)
        if end_date:
            carts = carts.filter(date__lte=end_date)
            materials = materials.filter(date__lte=end_date)

        days: dict = {}

        def day_for(value) -> dict:
            if value not in days:
                days[value] = {
                    "date": value,
                    "producer": None,
                    "material": None,
                    "carts": [],
                }
            return days[value]

        for record in materials:
            day = day_for(record.date)
            day["material"] = _material_payload(record)
            day["producer"] = _producer_payload(record.producer)

        for record in carts:
            day = day_for(record.date)
            day["carts"].append(_garri_payload(record))
            if day["producer"] is None:
                day["producer"] = _producer_payload(record.producer)

        if garri:
            # A cart filter should hide days that have no matching cart at all.
            days = {key: value for key, value in days.items() if value["carts"]}

        items = []
        for item in sorted(days.values(), key=lambda row: row["date"], reverse=True):
            carts_rows = sorted(item["carts"], key=lambda row: row["garri"])
            input_total = sum(row["meat_input_kg"] for row in carts_rows)
            output_total = sum(row["meat_output_kg"] for row in carts_rows)
            material = item["material"] or {}
            items.append(
                {
                    "date": item["date"].isoformat(),
                    "producer": item["producer"],
                    "material": item["material"],
                    "carts": carts_rows,
                    "cart_total_kg": round(input_total, 2),
                    "cart_output_total_kg": round(output_total, 2),
                    "note": material.get("note") or (carts_rows[0]["note"] if carts_rows else ""),
                    "created_by_name": material.get("created_by_name")
                    or (carts_rows[0]["created_by_name"] if carts_rows else ""),
                }
            )

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(items, request)
        return paginator.get_paginated_response(page)


def _resolve_range(request):
    """Read start/end query params, falling back to today."""
    today = timezone.localdate()
    start = parse_iso_date(request.query_params.get("start"), "start")
    end = parse_iso_date(request.query_params.get("end"), "end")
    if not start and not end:
        return today, today
    if not start:
        return end, end
    if not end:
        return start, today
    return start, end


def _product_type(request):
    """Read the `product_type` filter (60 / 90) or return an empty string."""
    value = str(request.query_params.get("product_type") or "").strip()
    return value if value in PRODUCT_TYPES else ""


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end = _resolve_range(request)
        return Response(
            get_dashboard_stats(start, end, product_type=_product_type(request))
        )


class ProductionChartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = parse_iso_date(request.query_params.get("start"), "start")
        end = parse_iso_date(request.query_params.get("end"), "end")

        if not start and not end:
            try:
                days = int(request.query_params.get("days", 7))
            except (TypeError, ValueError):
                raise ValidationError({"days": "تعداد روزها باید یک عدد صحیح باشد."})
            days = max(1, min(days, 366))
            end = timezone.localdate()
            start = end - timedelta(days=days - 1)
        elif not start:
            start = end
        elif not end:
            end = timezone.localdate()

        return Response(
            get_production_chart(start, end, product_type=_product_type(request))
        )


class ProductDistributionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start, end = _resolve_range(request)
        return Response(
            get_product_distribution(start, end, product_type=_product_type(request))
        )


class ReportSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        default_start = today.replace(day=1)
        start = parse_iso_date(
            request.query_params.get("start"), "start", default=default_start
        )
        end = parse_iso_date(request.query_params.get("end"), "end", default=today)
        return Response(
            get_report_summary(start, end, product_type=_product_type(request))
        )


class ReportExcelExportView(APIView):
    """Admin-only XLSX export for the selected production period."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        today = timezone.localdate()
        default_start = today.replace(day=1)
        start = parse_iso_date(
            request.query_params.get("start"), "start", default=default_start
        )
        end = parse_iso_date(request.query_params.get("end"), "end", default=today)
        workbook = build_report_workbook(
            start, end, product_type=_product_type(request)
        )
        filename = (
            f"zamaniburger-production-{start.isoformat()}-to-{end.isoformat()}.xlsx"
        )
        response = HttpResponse(
            workbook.getvalue(),
            content_type=(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "no-store"
        return response
