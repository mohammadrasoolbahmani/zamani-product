"""Business calculations for the ZAMANI BURGER dashboard and reports."""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import ProductionRecord, product_type_q

MAX_RANGE_DAYS = 366


def _records_in_range(start: date, end: date, product_type=None):
    """Production rows of a period, optionally narrowed to 60% / 90% products."""
    return ProductionRecord.objects.filter(
        Q(date__range=(start, end)) & product_type_q(product_type)
    )


def _decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def _percent_change(current: Decimal, previous: Decimal):
    if previous == 0:
        if current == 0:
            return 0.0
        return 100.0
    return round(float((current - previous) / previous * 100), 1)


def _validate_range(start: date, end: date) -> int:
    if end < start:
        raise ValidationError({"end": "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."})
    days = (end - start).days + 1
    if days > MAX_RANGE_DAYS:
        raise ValidationError({"end": "بازه انتخابی نمی‌تواند بیشتر از یک سال باشد."})
    if end > timezone.localdate():
        raise ValidationError({"end": "تاریخ پایان نمی‌تواند در آینده باشد."})
    return days


def parse_iso_date(value: str | None, field_name: str, default: date | None = None):
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError({field_name: "تاریخ باید در قالب YYYY-MM-DD باشد."})


def _totals(records, days: int) -> dict:
    aggregated = records.aggregate(
        delivered=Sum("delivered_meat_kg"),
        amount=Sum("amount_kg"),
        waste=Sum("waste_kg"),
        scrap=Sum("scrap_kg"),
        packages=Sum("packages_count"),
        products=Count("product", distinct=True),
        rows=Count("id"),
    )
    amount = _decimal(aggregated["amount"])
    delivered = _decimal(aggregated["delivered"])
    waste = _decimal(aggregated["waste"])
    scrap = _decimal(aggregated["scrap"])
    packages = int(aggregated["packages"] or 0)
    safe_days = max(days, 1)
    return {
        "delivered_meat_kg": round(float(delivered), 2),
        "amount_kg": round(float(amount), 2),
        "waste_kg": round(float(waste), 2),
        "scrap_kg": round(float(scrap), 2),
        "packages_count": packages,
        "products_count": int(aggregated["products"] or 0),
        "records_count": int(aggregated["rows"] or 0),
        "daily_average_kg": round(float(amount / safe_days), 2),
    }


def get_dashboard_stats(
    start: date | None = None, end: date | None = None, product_type=None
) -> dict:
    """Aggregate production for any selected period and compare the period before it."""
    today = timezone.localdate()
    start = start or today
    end = end or start
    days = _validate_range(start, end)

    records = _records_in_range(start, end, product_type)
    totals = _totals(records, days)

    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    previous_records = _records_in_range(previous_start, previous_end, product_type)
    previous = _totals(previous_records, days)

    changes = {
        key: _percent_change(_decimal(totals[key]), _decimal(previous[key]))
        for key in (
            "delivered_meat_kg",
            "amount_kg",
            "waste_kg",
            "scrap_kg",
            "packages_count",
            "products_count",
            "records_count",
            "daily_average_kg",
        )
    }

    return {
        "period": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "previous_period": {
            "start": previous_start.isoformat(),
            "end": previous_end.isoformat(),
        },
        "totals": totals,
        "previous": previous,
        "changes": changes,
        "product_type": str(product_type or ""),
    }


def get_production_chart(start: date, end: date, product_type=None) -> dict:
    days = _validate_range(start, end)
    rows = (
        _records_in_range(start, end, product_type)
        .values("date")
        .annotate(amount=Sum("amount_kg"), packages=Sum("packages_count"))
        .order_by("date")
    )
    lookup = {
        row["date"]: {
            "amount_kg": round(float(row["amount"] or 0), 2),
            "packages_count": int(row["packages"] or 0),
        }
        for row in rows
    }
    results = []
    for offset in range(days):
        current = start + timedelta(days=offset)
        values = lookup.get(current, {"amount_kg": 0.0, "packages_count": 0})
        results.append({"date": current.isoformat(), **values})
    return {
        "days": days,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "results": results,
    }


def get_product_distribution(start: date, end: date, product_type=None) -> dict:
    _validate_range(start, end)
    rows = (
        _records_in_range(start, end, product_type)
        .values("product__id", "product__name", "product__image")
        .annotate(amount=Sum("amount_kg"), packages=Sum("packages_count"))
        .order_by("-amount", "packages")
    )
    total = sum(_decimal(row["amount"]) for row in rows)
    items = []
    for row in rows:
        amount = _decimal(row["amount"])
        items.append(
            {
                "product_id": row["product__id"],
                "name": row["product__name"],
                "image": row["product__image"] or None,
                "amount_kg": round(float(amount), 2),
                "packages_count": int(row["packages"] or 0),
                "percentage": round(float(amount / total * 100), 1) if total else 0.0,
            }
        )
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "product_type": str(product_type or ""),
        "total_kg": round(float(total), 2),
        "items": items,
    }


def get_report_summary(start: date, end: date, product_type=None) -> dict:
    days = _validate_range(start, end)
    records = _records_in_range(start, end, product_type)
    totals = _totals(records, days)

    by_product = [
        {
            "product_id": row["product__id"],
            "name": row["product__name"],
            "delivered_meat_kg": round(float(_decimal(row["delivered"])), 2),
            "amount_kg": round(float(_decimal(row["amount"])), 2),
            "waste_kg": round(float(_decimal(row["waste"])), 2),
            "scrap_kg": round(float(_decimal(row["scrap"])), 2),
            "packages_count": int(row["packages"] or 0),
            "records_count": int(row["records"] or 0),
        }
        for row in records.values("product__id", "product__name")
        .annotate(
            delivered=Sum("delivered_meat_kg"),
            amount=Sum("amount_kg"),
            waste=Sum("waste_kg"),
            scrap=Sum("scrap_kg"),
            packages=Sum("packages_count"),
            records=Count("id"),
        )
        .order_by("-amount", "-packages")
    ]

    by_producer = [
        {
            "producer_id": row["producer__id"],
            "name": row["producer__name"],
            "role": row["producer__role"],
            "delivered_meat_kg": round(float(_decimal(row["delivered"])), 2),
            "amount_kg": round(float(_decimal(row["amount"])), 2),
            "waste_kg": round(float(_decimal(row["waste"])), 2),
            "scrap_kg": round(float(_decimal(row["scrap"])), 2),
            "packages_count": int(row["packages"] or 0),
            "records_count": int(row["records"] or 0),
        }
        for row in records.values("producer__id", "producer__name", "producer__role")
        .annotate(
            delivered=Sum("delivered_meat_kg"),
            amount=Sum("amount_kg"),
            waste=Sum("waste_kg"),
            scrap=Sum("scrap_kg"),
            packages=Sum("packages_count"),
            records=Count("id"),
        )
        .order_by("-amount", "-packages")
    ]

    by_day = [
        {
            "date": row["date"].isoformat(),
            "amount_kg": round(float(_decimal(row["amount"])), 2),
            "packages_count": int(row["packages"] or 0),
        }
        for row in records.values("date")
        .annotate(amount=Sum("amount_kg"), packages=Sum("packages_count"))
        .order_by("date")
    ]

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "days": days,
        "product_type": str(product_type or ""),
        "totals": totals,
        "by_product": by_product,
        "by_producer": by_producer,
        "by_day": by_day,
    }
