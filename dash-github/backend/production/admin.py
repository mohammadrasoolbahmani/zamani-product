from django.contrib import admin
from django.utils import timezone

from .models import GarriRecord, MaterialRecord, Producer, Product, ProductionRecord


@admin.register(Producer)
class ProducerAdmin(admin.ModelAdmin):
    list_display = ("name", "role", "sort_order", "is_active", "records_count")
    list_filter = ("is_active",)
    search_fields = ("name", "role")
    list_editable = ("sort_order", "is_active")

    def records_count(self, obj):
        return obj.records.count()

    records_count.short_description = "تعداد سوابق"


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "records_count", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
    list_editable = ("is_active",)

    def records_count(self, obj):
        return obj.records.count()

    records_count.short_description = "تعداد سوابق"


@admin.register(ProductionRecord)
class ProductionRecordAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "producer",
        "product",
        "delivered_meat_kg",
        "amount_kg",
        "packages_count",
        "waste_kg",
        "scrap_kg",
        "created_by",
    )
    list_filter = ("date", "product", "producer")
    search_fields = (
        "producer__name",
        "product__name",
        "note",
        "created_by__username",
    )
    date_hierarchy = "date"
    autocomplete_fields = ("producer", "product", "created_by")
    readonly_fields = ("created_at", "created_by_name")

    fieldsets = (
        (
            "اطلاعات تولید",
            {
                "fields": (
                    "date",
                    "producer",
                    "product",
                    "delivered_meat_kg",
                    "amount_kg",
                    "packages_count",
                    "waste_kg",
                    "scrap_kg",
                    "note",
                )
            },
        ),
        (
            "ثبت",
            {"fields": ("created_by", "created_by_name", "created_at")},
        ),
    )

    def created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    created_by_name.short_description = "نام ثبت‌کننده"

    def get_changeform_initial_data(self, request):
        return {"created_by": request.user.pk, "date": timezone.localdate()}

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(GarriRecord)
class GarriRecordAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "producer",
        "garri",
        "meat_input_kg",
        "note",
        "created_by",
    )
    list_filter = ("garri", "date")
    search_fields = ("producer__name", "note", "created_by__username")
    date_hierarchy = "date"
    autocomplete_fields = ("producer", "created_by")
    readonly_fields = ("created_at",)

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(MaterialRecord)
class MaterialRecordAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "producer",
        "onion_input_kg",
        "chicken_input_kg",
        "onion_used_kg",
        "chicken_used_kg",
        "note",
        "created_by",
    )
    list_filter = ("date",)
    search_fields = ("producer__name", "note", "created_by__username")
    date_hierarchy = "date"
    autocomplete_fields = ("producer", "created_by")
    readonly_fields = ("created_at",)

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


admin.site.site_header = "ZAMANI BURGER — پنل مدیریت تولید"
admin.site.site_title = "ZAMANI BURGER"
admin.site.index_title = "مدیریت کارخانه"
