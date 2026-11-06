from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ChangePasswordView,
    DashboardStatsView,
    GarriRecordViewSet,
    HealthView,
    MaterialRecordViewSet,
    MeView,
    ProducerViewSet,
    ProductDistributionView,
    ProductViewSet,
    ProductionChartView,
    ProductionRecordViewSet,
    ReportExcelExportView,
    ReportSummaryView,
    UserViewSet,
    WorkdayListView,
)

router = DefaultRouter()
router.register("producers", ProducerViewSet, basename="producer")
router.register("products", ProductViewSet, basename="product")
router.register("records", ProductionRecordViewSet, basename="record")
router.register("garri", GarriRecordViewSet, basename="garri")
router.register("materials", MaterialRecordViewSet, basename="material")
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("me/", MeView.as_view(), name="me"),
    path("me/password/", ChangePasswordView.as_view(), name="change-password"),
    path("stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("chart/production/", ProductionChartView.as_view(), name="production-chart"),
    path(
        "chart/distribution/",
        ProductDistributionView.as_view(),
        name="product-distribution",
    ),
    path("reports/summary/", ReportSummaryView.as_view(), name="report-summary"),
    path("reports/export/", ReportExcelExportView.as_view(), name="report-export"),
    path("workdays/", WorkdayListView.as_view(), name="workdays"),
    path("", include(router.urls)),
]
