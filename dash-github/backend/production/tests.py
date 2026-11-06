from datetime import timedelta
from decimal import Decimal
from io import BytesIO

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import status
from rest_framework.test import APITestCase

from .models import GarriRecord, MaterialRecord, Producer, Product, ProductionRecord

User = get_user_model()


class ZamaniBurgerApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="admin_test",
            email="admin@test.local",
            password="AdminPass123!",
            first_name="مدیر",
            last_name="آزمون",
        )
        self.operator = User.objects.create_user(
            username="operator_test",
            password="OperatorPass123!",
            first_name="اپراتور",
            last_name="آزمون",
        )
        self.producer, _ = Producer.objects.get_or_create(
            name="مهدی زمانی",
            defaults={"role": "مدیر ۶۰ درصد", "sort_order": 10},
        )
        self.inactive_producer = Producer.objects.create(
            name="تولیدکننده غیرفعال",
            role="آزمون",
            is_active=False,
        )
        self.product = Product.objects.create(
            name="همبرگر ۶۰ درصد ۱۵۰ گرمی", is_active=True
        )
        self.inactive_product = Product.objects.create(
            name="محصول غیرفعال", is_active=False
        )
        self.today = timezone.localdate()
        self.record = ProductionRecord.objects.create(
            date=self.today,
            producer=self.producer,
            product=self.product,
            delivered_meat_kg=Decimal("1500"),
            amount_kg=Decimal("1250.50"),
            packages_count=900,
            waste_kg=Decimal("100"),
            created_by=self.admin,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.admin)

    # --- authentication -------------------------------------------------
    def test_token_login_returns_tokens_and_user(self):
        response = self.client.post(
            "/api/token/",
            {"username": "admin_test", "password": "AdminPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["username"], "admin_test")
        self.assertEqual(response.data["user"]["role"], "مدیر ارشد")

    def test_token_login_rejects_bad_password(self):
        response = self.client.post(
            "/api/token/",
            {"username": "admin_test", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh(self):
        login = self.client.post(
            "/api/token/",
            {"username": "admin_test", "password": "AdminPass123!"},
            format="json",
        )
        refresh = self.client.post(
            "/api/token/refresh/",
            {"refresh": login.data["refresh"]},
            format="json",
        )
        self.assertEqual(refresh.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh.data)

    def test_health_endpoint_is_public(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertEqual(response.data["database"], "ok")

    def test_protected_endpoint_requires_auth(self):
        self.assertEqual(
            self.client.get("/api/stats/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.client.get("/api/records/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    # --- profile --------------------------------------------------------
    def test_me_and_profile_update(self):
        self.authenticate(self.operator)
        me = self.client.get("/api/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["role"], "تولیدکننده")

        updated = self.client.patch(
            "/api/me/",
            {"first_name": "نام جدید", "email": "new@test.local"},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["first_name"], "نام جدید")
        self.operator.refresh_from_db()
        self.assertEqual(self.operator.email, "new@test.local")

    def test_change_password(self):
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/me/password/",
            {"old_password": "OperatorPass123!", "new_password": "NewOperator123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.operator.refresh_from_db()
        self.assertTrue(self.operator.check_password("NewOperator123!"))

    def test_change_password_rejects_wrong_current_password(self):
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/me/password/",
            {"old_password": "wrong", "new_password": "NewOperator123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- products -------------------------------------------------------
    def test_operator_can_read_but_not_create_products(self):
        self.authenticate(self.operator)
        listed = self.client.get("/api/products/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], Product.objects.count())
        listed_names = {row["name"] for row in listed.data["results"]}
        self.assertIn(self.product.name, listed_names)
        self.assertIn("محصول غیرفعال", listed_names)

        created = self.client.post(
            "/api/products/", {"name": "محصول جدید"}, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_and_update_product(self):
        self.authenticate()
        created = self.client.post(
            "/api/products/", {"name": "سوسیس تست"}, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        product_id = created.data["id"]

        updated = self.client.patch(
            f"/api/products/{product_id}/", {"is_active": False}, format="json"
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertFalse(updated.data["is_active"])

    def test_product_with_records_cannot_be_deleted(self):
        self.authenticate()
        response = self.client.delete(f"/api/products/{self.product.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    # --- producers ------------------------------------------------------
    def test_admin_can_list_and_create_producers(self):
        self.authenticate()
        listed = self.client.get("/api/producers/?active=1")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], 3)
        listed_names = {row["name"] for row in listed.data["results"]}
        self.assertEqual(
            listed_names,
            {"مهدی زمانی", "علی توانا", "خانم زارع"},
        )

        created = self.client.post(
            "/api/producers/",
            {"name": "تولیدکننده چهارم", "role": "مدیر آزمایشی", "sort_order": 40},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            created.data["display_name"], "تولیدکننده چهارم (مدیر آزمایشی)"
        )
        self.assertEqual(created.data["records_count"], 0)

    def test_operator_can_read_but_not_create_producer(self):
        self.authenticate(self.operator)
        listed = self.client.get("/api/producers/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        created = self.client.post(
            "/api/producers/",
            {"name": "تولیدکننده جدید", "role": "مدیر"},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_403_FORBIDDEN)

    def test_producer_with_records_cannot_be_deleted(self):
        self.authenticate()
        response = self.client.delete(f"/api/producers/{self.producer.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    # --- production records --------------------------------------------
    def test_create_record_assigns_request_user(self):
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "product": self.product.id,
                "delivered_meat_kg": "400",
                "amount_kg": "320.50",
                "packages_count": 250,
                "waste_kg": "50",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["created_by"], self.operator.id)
        self.assertEqual(response.data["producer_name"], self.producer.name)
        self.assertEqual(response.data["product_name"], self.product.name)
        self.assertEqual(response.data["delivered_meat_kg"], "400.00")
        self.assertEqual(response.data["waste_kg"], "50.00")
        created = ProductionRecord.objects.get(pk=response.data["id"])
        self.assertEqual(created.created_by, self.operator)

    def test_future_record_is_rejected(self):
        self.authenticate()
        response = self.client.post(
            "/api/records/",
            {
                "date": (self.today + timedelta(days=1)).isoformat(),
                "producer": self.producer.id,
                "product": self.product.id,
                "delivered_meat_kg": "12",
                "amount_kg": "10",
                "packages_count": 1,
                "waste_kg": "1",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date", response.data)

    def test_inactive_product_is_rejected(self):
        self.authenticate()
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "product": self.inactive_product.id,
                "delivered_meat_kg": "12",
                "amount_kg": "10",
                "packages_count": 1,
                "waste_kg": "1",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("product", response.data)

    def test_zero_amount_is_rejected(self):
        self.authenticate()
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "product": self.product.id,
                "delivered_meat_kg": "10",
                "amount_kg": "0",
                "packages_count": 1,
                "waste_kg": "1",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inactive_producer_is_rejected(self):
        self.authenticate()
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": self.inactive_producer.id,
                "product": self.product.id,
                "delivered_meat_kg": "100",
                "amount_kg": "80",
                "packages_count": 8,
                "waste_kg": "5",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("producer", response.data)

    def test_missing_delivered_weight_is_rejected(self):
        self.authenticate()
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "product": self.product.id,
                "amount_kg": "80",
                "packages_count": 8,
                "waste_kg": "5",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("delivered_meat_kg", response.data)

    def test_negative_waste_is_rejected(self):
        self.authenticate()
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "product": self.product.id,
                "delivered_meat_kg": "100",
                "amount_kg": "80",
                "packages_count": 8,
                "waste_kg": "-1",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("waste_kg", response.data)

    def test_other_operator_cannot_delete_admin_record(self):
        self.authenticate(self.operator)
        response = self.client.delete(f"/api/records/{self.record.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_creator_can_delete_own_record(self):
        own = ProductionRecord.objects.create(
            date=self.today,
            producer=self.producer,
            product=self.product,
            delivered_meat_kg=Decimal("60"),
            amount_kg=Decimal("50"),
            packages_count=4,
            waste_kg=Decimal("4"),
            created_by=self.operator,
        )
        self.authenticate(self.operator)
        response = self.client.delete(f"/api/records/{own.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ProductionRecord.objects.filter(pk=own.id).exists())

    def test_records_filtering(self):
        self.authenticate()
        response = self.client.get("/api/records/?search=همبرگر")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        by_producer = self.client.get(f"/api/records/?producer={self.producer.id}")
        self.assertEqual(by_producer.data["count"], 1)
        empty = self.client.get(f"/api/records/?producer={self.inactive_producer.id}")
        self.assertEqual(empty.data["count"], 0)

    def test_record_has_no_shift_field(self):
        self.authenticate()
        response = self.client.get(f"/api/records/{self.record.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("shift", response.data)
        self.assertNotIn("shift_display", response.data)

    # --- 90% manager (خانم زارع) --------------------------------------
    def _ninety_setup(self):
        producer, _ = Producer.objects.get_or_create(
            name="خانم زارع",
            defaults={"role": "مدیر ۹۰ درصد", "sort_order": 20},
        )
        product, _ = Product.objects.get_or_create(
            name="همبرگر ۹۰ درصد ۱۰۰ گرمی", defaults={"is_active": True}
        )
        return producer, product

    def test_ninety_record_computes_amount_and_ignores_delivered(self):
        producer, product = self._ninety_setup()
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": producer.id,
                "product": product.id,
                "packages_count": 250,
                "waste_kg": "6",
                "scrap_kg": "1.5",
                "note": "شیفت صبح",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["delivered_meat_kg"], "0.00")
        self.assertEqual(response.data["amount_kg"], "25.00")
        self.assertEqual(response.data["scrap_kg"], "1.50")
        self.assertEqual(response.data["note"], "شیفت صبح")

    def test_ninety_record_rejects_sixty_percent_product(self):
        producer, _ = self._ninety_setup()
        sixty, _ = Product.objects.get_or_create(
            name="همبرگر ۶۰ درصد ۱۲۰ گرمی", defaults={"is_active": True}
        )
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": producer.id,
                "product": sixty.id,
                "packages_count": 10,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("product", response.data)

    def test_ninety_record_requires_packages(self):
        producer, product = self._ninety_setup()
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": producer.id,
                "product": product.id,
                "packages_count": 0,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("packages_count", response.data)

    def test_bulk_creates_multiple_ninety_rows_for_one_day(self):
        producer, product100 = self._ninety_setup()
        product120, _ = Product.objects.get_or_create(
            name="همبرگر ۹۰ درصد ۱۲۰ گرمی", defaults={"is_active": True}
        )
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/records/bulk/",
            {
                "date": self.today.isoformat(),
                "producer": producer.id,
                "waste_kg": "2",
                "scrap_kg": "1",
                "note": "ثبت گروهی",
                "items": [
                    {"product": product100.id, "packages_count": 200},
                    {"product": product120.id, "packages_count": 300},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["amount_kg"], "20.00")
        self.assertEqual(response.data[1]["amount_kg"], "36.00")
        self.assertEqual(response.data[0]["waste_kg"], "2.00")
        self.assertEqual(response.data[1]["waste_kg"], "0.00")
        self.assertEqual(response.data[0]["note"], "ثبت گروهی")
        self.assertEqual(response.data[1]["note"], "")
        self.assertEqual(
            ProductionRecord.objects.filter(
                producer=producer, date=self.today
            ).count(),
            2,
        )

    def test_bulk_rolls_back_when_one_row_is_invalid(self):
        producer, product100 = self._ninety_setup()
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/records/bulk/",
            {
                "date": self.today.isoformat(),
                "producer": producer.id,
                "items": [
                    {"product": product100.id, "packages_count": 100},
                    {"product": self.product.id, "packages_count": 50},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            ProductionRecord.objects.filter(
                producer=producer, product=product100
            ).exists()
        )

    def test_bulk_rejects_non_ninety_producer(self):
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/records/bulk/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "items": [{"product": self.product.id, "packages_count": 10}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("producer", response.data)

    def test_bulk_rejects_empty_items(self):
        producer, _ = self._ninety_setup()
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/records/bulk/",
            {
                "date": self.today.isoformat(),
                "producer": producer.id,
                "items": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", response.data)

    def test_sixty_record_requires_delivered_weight(self):
        self.authenticate()
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "product": self.product.id,
                "amount_kg": "80",
                "packages_count": 8,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("delivered_meat_kg", response.data)

    def test_negative_scrap_is_rejected(self):
        self.authenticate()
        response = self.client.post(
            "/api/records/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "product": self.product.id,
                "delivered_meat_kg": "100",
                "amount_kg": "80",
                "packages_count": 8,
                "scrap_kg": "-2",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("scrap_kg", response.data)

    # --- product type filter (60 / 90) --------------------------------
    def test_stats_filters_by_product_type(self):
        ninety_producer, ninety_product = self._ninety_setup()
        ProductionRecord.objects.create(
            date=self.today,
            producer=ninety_producer,
            product=ninety_product,
            amount_kg=Decimal("40"),
            packages_count=400,
            waste_kg=Decimal("3"),
            scrap_kg=Decimal("1"),
            created_by=self.admin,
        )
        self.authenticate()
        both = self.client.get(
            f"/api/stats/?start={self.today.isoformat()}&end={self.today.isoformat()}"
        )
        self.assertEqual(both.data["totals"]["amount_kg"], 1290.5)
        self.assertEqual(both.data["totals"]["scrap_kg"], 1.0)

        only_sixty = self.client.get(
            f"/api/stats/?start={self.today.isoformat()}&end={self.today.isoformat()}&product_type=60"
        )
        self.assertEqual(only_sixty.data["totals"]["amount_kg"], 1250.5)
        self.assertEqual(only_sixty.data["totals"]["records_count"], 1)

        only_ninety = self.client.get(
            f"/api/stats/?start={self.today.isoformat()}&end={self.today.isoformat()}&product_type=90"
        )
        self.assertEqual(only_ninety.data["totals"]["amount_kg"], 40.0)
        self.assertEqual(only_ninety.data["totals"]["packages_count"], 400)

    def test_records_list_filters_by_product_type(self):
        ninety_producer, ninety_product = self._ninety_setup()
        ProductionRecord.objects.create(
            date=self.today,
            producer=ninety_producer,
            product=ninety_product,
            amount_kg=Decimal("40"),
            packages_count=400,
            created_by=self.admin,
        )
        self.authenticate()
        self.assertEqual(self.client.get("/api/records/").data["count"], 2)
        self.assertEqual(
            self.client.get("/api/records/?product_type=60").data["count"], 1
        )
        self.assertEqual(
            self.client.get("/api/records/?product_type=90").data["count"], 1
        )
        self.assertEqual(
            self.client.get("/api/records/?product_type=70").data["count"], 2
        )

    # --- dashboards and reports ---------------------------------------
    def test_stats_returns_expected_values(self):
        self.authenticate()
        response = self.client.get(
            f"/api/stats/?start={self.today.isoformat()}&end={self.today.isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"]["days"], 1)
        self.assertEqual(response.data["totals"]["delivered_meat_kg"], 1500.0)
        self.assertEqual(response.data["totals"]["amount_kg"], 1250.5)
        self.assertEqual(response.data["totals"]["waste_kg"], 100.0)
        self.assertEqual(response.data["totals"]["packages_count"], 900)
        self.assertEqual(response.data["totals"]["products_count"], 1)
        self.assertEqual(response.data["totals"]["records_count"], 1)
        self.assertEqual(response.data["totals"]["daily_average_kg"], 1250.5)
        self.assertIn("changes", response.data)
        self.assertNotIn("hours", response.data["totals"])
        self.assertNotIn("plan_percent", response.data["totals"])

    def test_stats_custom_range_and_previous_period_comparison(self):
        ProductionRecord.objects.create(
            date=self.today - timedelta(days=1),
            producer=self.producer,
            product=self.product,
            delivered_meat_kg=Decimal("1200"),
            amount_kg=Decimal("1000"),
            packages_count=100,
            waste_kg=Decimal("80"),
            created_by=self.admin,
        )
        ProductionRecord.objects.create(
            date=self.today - timedelta(days=2),
            producer=self.producer,
            product=self.product,
            delivered_meat_kg=Decimal("600"),
            amount_kg=Decimal("500"),
            packages_count=50,
            waste_kg=Decimal("40"),
            created_by=self.admin,
        )
        start = self.today - timedelta(days=1)
        self.authenticate()
        response = self.client.get(
            f"/api/stats/?start={start.isoformat()}&end={self.today.isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"]["days"], 2)
        self.assertEqual(response.data["totals"]["delivered_meat_kg"], 2700.0)
        self.assertEqual(response.data["totals"]["amount_kg"], 2250.5)
        self.assertEqual(response.data["totals"]["waste_kg"], 180.0)
        self.assertEqual(response.data["totals"]["packages_count"], 1000)
        self.assertEqual(response.data["totals"]["records_count"], 2)
        self.assertEqual(response.data["totals"]["daily_average_kg"], 1125.25)
        self.assertEqual(response.data["previous"]["amount_kg"], 500.0)
        self.assertEqual(response.data["changes"]["amount_kg"], 350.1)

    def test_stats_rejects_future_end_date(self):
        self.authenticate()
        response = self.client.get(
            f"/api/stats/?start={self.today.isoformat()}&end={(self.today + timedelta(days=1)).isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_production_chart_has_zero_filled_days(self):
        self.authenticate()
        response = self.client.get("/api/chart/production/?days=7")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 7)
        self.assertEqual(response.data["results"][-1]["date"], self.today.isoformat())

    def test_production_chart_accepts_custom_range(self):
        self.authenticate()
        start = self.today - timedelta(days=2)
        response = self.client.get(
            f"/api/chart/production/?start={start.isoformat()}&end={self.today.isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["days"], 3)
        self.assertEqual(len(response.data["results"]), 3)

    def test_distribution_groups_today_by_product(self):
        self.authenticate()
        response = self.client.get("/api/chart/distribution/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_kg"], 1250.5)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["percentage"], 100.0)

    def test_distribution_accepts_custom_range(self):
        ProductionRecord.objects.create(
            date=self.today - timedelta(days=1),
            producer=self.producer,
            product=self.product,
            delivered_meat_kg=Decimal("450"),
            amount_kg=Decimal("400"),
            packages_count=40,
            waste_kg=Decimal("20"),
            created_by=self.admin,
        )
        self.authenticate()
        start = self.today - timedelta(days=1)
        response = self.client.get(
            f"/api/chart/distribution/?start={start.isoformat()}&end={self.today.isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_kg"], 1650.5)
        self.assertEqual(response.data["items"][0]["packages_count"], 940)

    def test_report_summary_totals_and_breakdown(self):
        self.authenticate()
        response = self.client.get(
            f"/api/reports/summary/?start={(self.today - timedelta(days=6)).isoformat()}&end={self.today.isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totals"]["delivered_meat_kg"], 1500.0)
        self.assertEqual(response.data["totals"]["amount_kg"], 1250.5)
        self.assertEqual(response.data["totals"]["waste_kg"], 100.0)
        self.assertEqual(response.data["totals"]["records_count"], 1)
        self.assertEqual(response.data["totals"]["daily_average_kg"], 178.64)
        self.assertNotIn("plan_percent", response.data["totals"])
        self.assertEqual(len(response.data["by_product"]), 1)
        self.assertEqual(len(response.data["by_producer"]), 1)
        self.assertEqual(response.data["by_producer"][0]["name"], self.producer.name)
        self.assertEqual(len(response.data["by_day"]), 1)

    def test_report_rejects_inverted_range(self):
        self.authenticate()
        response = self.client.get(
            f"/api/reports/summary/?start={self.today.isoformat()}&end={(self.today - timedelta(days=1)).isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_export_excel_report(self):
        self.authenticate()
        response = self.client.get(
            f"/api/reports/export/?start={self.today.isoformat()}&end={self.today.isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertIn("zamaniburger-production-", response["Content-Disposition"])

        workbook = load_workbook(BytesIO(response.content))
        self.assertEqual(
            workbook.sheetnames,
            ["خلاصه", "عملکرد محصولات", "تولیدکنندگان", "ریز تولید"],
        )
        self.assertIn("ZAMANI BURGER", workbook["خلاصه"]["A1"].value)
        self.assertEqual(workbook["خلاصه"]["B8"].value, 1500.0)
        self.assertEqual(workbook["خلاصه"]["B9"].value, 1250.5)
        self.assertEqual(workbook["خلاصه"]["B10"].value, 100.0)
        self.assertEqual(workbook["عملکرد محصولات"]["B4"].value, self.product.name)
        self.assertEqual(workbook["عملکرد محصولات"]["C4"].value, 1500.0)
        self.assertEqual(workbook["عملکرد محصولات"]["D4"].value, 1250.5)
        self.assertEqual(workbook["عملکرد محصولات"]["E4"].value, 100.0)
        self.assertEqual(workbook["تولیدکنندگان"]["B4"].value, self.producer.name)
        self.assertEqual(workbook["تولیدکنندگان"]["C4"].value, self.producer.role)
        self.assertEqual(workbook["ریز تولید"]["C4"].value, self.producer.name)
        self.assertEqual(workbook["ریز تولید"]["D4"].value, self.product.name)
        self.assertEqual(workbook["ریز تولید"]["E4"].value, 1500.0)
        self.assertEqual(workbook["ریز تولید"]["F4"].value, 1250.5)
        self.assertEqual(workbook["ریز تولید"]["H4"].value, 100.0)

    def test_operator_cannot_export_excel_report(self):
        self.authenticate(self.operator)
        response = self.client.get(
            f"/api/reports/export/?start={self.today.isoformat()}&end={self.today.isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_excel_export_rejects_inverted_range(self):
        self.authenticate()
        response = self.client.get(
            f"/api/reports/export/?start={self.today.isoformat()}&end={(self.today - timedelta(days=1)).isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- cart (گاری) entries ------------------------------------------
    def test_create_and_list_garri_record(self):
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/garri/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "garri": "2",
                "meat_input_kg": "300",
                "meat_output_kg": "280",
                "note": "وزن‌گیری صبح",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["garri_display"], "گاری ۲")
        self.assertEqual(response.data["meat_output_kg"], "280.00")
        self.assertEqual(response.data["created_by"], self.operator.id)
        self.assertEqual(response.data["note"], "وزن‌گیری صبح")
        self.assertFalse(response.data["is_update"])

        listed = self.client.get("/api/garri/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], 1)

        filtered = self.client.get("/api/garri/?garri=3")
        self.assertEqual(filtered.data["count"], 0)

        ranged = self.client.get(
            f"/api/garri/?start_date={self.today.isoformat()}&end_date={self.today.isoformat()}"
        )
        self.assertEqual(ranged.data["count"], 1)

    def test_garri_re_submit_updates_the_same_row(self):
        self.authenticate(self.operator)
        payload = {
            "date": self.today.isoformat(),
            "producer": self.producer.id,
            "garri": "1",
            "meat_input_kg": "100",
            "meat_output_kg": "95",
        }
        first = self.client.post("/api/garri/", payload, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post(
            "/api/garri/",
            {**payload, "meat_input_kg": "135", "meat_output_kg": "130"},
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertTrue(second.data["is_update"])
        self.assertEqual(second.data["id"], first.data["id"])
        self.assertEqual(GarriRecord.objects.filter(garri="1").count(), 1)
        self.assertEqual(
            GarriRecord.objects.get(garri="1").meat_input_kg, Decimal("135")
        )
        self.assertEqual(
            GarriRecord.objects.get(garri="1").meat_output_kg, Decimal("130")
        )

        other_cart = self.client.post(
            "/api/garri/", {**payload, "garri": "3"}, format="json"
        )
        self.assertEqual(other_cart.status_code, status.HTTP_201_CREATED)
        self.assertFalse(other_cart.data["is_update"])
        self.assertEqual(GarriRecord.objects.count(), 2)

    def test_garri_rejects_zero_meat_input(self):
        self.authenticate()
        response = self.client.post(
            "/api/garri/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "garri": "1",
                "meat_input_kg": "0",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("meat_input_kg", response.data)

    def test_garri_rejects_negative_meat_output(self):
        self.authenticate()
        response = self.client.post(
            "/api/garri/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "garri": "1",
                "meat_input_kg": "100",
                "meat_output_kg": "-5",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("meat_output_kg", response.data)

    def test_creator_can_delete_own_garri_record(self):
        own = GarriRecord.objects.create(
            date=self.today,
            producer=self.producer,
            garri="1",
            meat_input_kg=Decimal("100"),
            created_by=self.operator,
        )
        self.authenticate(self.operator)
        response = self.client.delete(f"/api/garri/{own.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(GarriRecord.objects.filter(pk=own.id).exists())

    def test_other_operator_cannot_delete_admin_garri_record(self):
        own = GarriRecord.objects.create(
            date=self.today,
            producer=self.producer,
            garri="5",
            meat_input_kg=Decimal("100"),
            created_by=self.admin,
        )
        self.authenticate(self.operator)
        response = self.client.delete(f"/api/garri/{own.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- raw-material entries -----------------------------------------
    def test_create_and_list_material_record(self):
        self.authenticate(self.operator)
        response = self.client.post(
            "/api/materials/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "onion_input_kg": "120",
                "chicken_input_kg": "80",
                "onion_used_kg": "100",
                "chicken_used_kg": "75.5",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["onion_input_kg"], "120.00")
        self.assertEqual(response.data["chicken_used_kg"], "75.50")
        self.assertEqual(response.data["created_by"], self.operator.id)

        listed = self.client.get("/api/materials/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], 1)

    def test_material_rejects_negative_value(self):
        self.authenticate()
        response = self.client.post(
            "/api/materials/",
            {
                "date": self.today.isoformat(),
                "producer": self.producer.id,
                "onion_input_kg": "-5",
                "chicken_input_kg": "0",
                "onion_used_kg": "0",
                "chicken_used_kg": "0",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("onion_input_kg", response.data)

    def test_creator_can_delete_own_material_record(self):
        own = MaterialRecord.objects.create(
            date=self.today,
            producer=self.producer,
            onion_input_kg=Decimal("50"),
            chicken_input_kg=Decimal("30"),
            onion_used_kg=Decimal("45"),
            chicken_used_kg=Decimal("28"),
            created_by=self.operator,
        )
        self.authenticate(self.operator)
        response = self.client.delete(f"/api/materials/{own.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MaterialRecord.objects.filter(pk=own.id).exists())

    # --- per-workday grouping (carts + raw materials) -------------------
    def test_workdays_group_carts_and_materials(self):
        MaterialRecord.objects.create(
            date=self.today,
            producer=self.producer,
            onion_input_kg=Decimal("120"),
            chicken_input_kg=Decimal("80"),
            onion_used_kg=Decimal("100"),
            chicken_used_kg=Decimal("70"),
            note="ورودی روز",
            created_by=self.operator,
        )
        GarriRecord.objects.create(
            date=self.today,
            producer=self.producer,
            garri="1",
            meat_input_kg=Decimal("300"),
            meat_output_kg=Decimal("280"),
            created_by=self.operator,
        )
        GarriRecord.objects.create(
            date=self.today,
            producer=self.producer,
            garri="3",
            meat_input_kg=Decimal("250"),
            meat_output_kg=Decimal("240"),
            created_by=self.operator,
        )
        self.authenticate(self.operator)
        response = self.client.get("/api/workdays/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        day = response.data["results"][0]
        self.assertEqual(day["date"], self.today.isoformat())
        self.assertEqual(day["material"]["onion_input_kg"], 120.0)
        self.assertEqual(len(day["carts"]), 2)
        self.assertEqual([cart["garri"] for cart in day["carts"]], ["1", "3"])
        self.assertEqual(day["carts"][0]["meat_output_kg"], 280.0)
        self.assertEqual(day["cart_total_kg"], 550.0)
        self.assertEqual(day["cart_output_total_kg"], 520.0)
        self.assertEqual(day["note"], "ورودی روز")

    def test_workdays_filter_by_cart_and_date(self):
        other_day = self.today - timedelta(days=1)
        GarriRecord.objects.create(
            date=self.today,
            producer=self.producer,
            garri="1",
            meat_input_kg=Decimal("300"),
            created_by=self.operator,
        )
        GarriRecord.objects.create(
            date=self.today,
            producer=self.producer,
            garri="2",
            meat_input_kg=Decimal("200"),
            created_by=self.operator,
        )
        GarriRecord.objects.create(
            date=other_day,
            producer=self.producer,
            garri="1",
            meat_input_kg=Decimal("150"),
            created_by=self.operator,
        )
        self.authenticate(self.operator)

        filtered = self.client.get("/api/workdays/?garri=1")
        self.assertEqual(filtered.data["count"], 2)
        for day in filtered.data["results"]:
            self.assertEqual(len(day["carts"]), 1)
            self.assertEqual(day["carts"][0]["garri"], "1")

        exact = self.client.get(f"/api/workdays/?date={self.today.isoformat()}")
        self.assertEqual(exact.data["count"], 1)
        self.assertEqual(exact.data["results"][0]["cart_total_kg"], 500.0)

    def test_workdays_requires_authentication(self):
        response = self.client.get("/api/workdays/")
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    # --- user management ------------------------------------------------
    def test_operator_cannot_list_users(self):
        self.authenticate(self.operator)
        response = self.client.get("/api/users/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_operator(self):
        self.authenticate()
        response = self.client.post(
            "/api/users/",
            {
                "username": "new_operator",
                "first_name": "کاربر",
                "last_name": "جدید",
                "password": "StrongPass123!",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["is_staff"])
        user = User.objects.get(username="new_operator")
        self.assertTrue(user.check_password("StrongPass123!"))

    def test_admin_cannot_deactivate_self(self):
        self.authenticate()
        response = self.client.patch(
            f"/api/users/{self.admin.id}/", {"is_active": False}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
