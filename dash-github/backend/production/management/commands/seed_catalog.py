"""Idempotent seed for the production catalogue and producers.

Usage:
    python manage.py seed_catalog

Safe to run multiple times: existing rows are kept and only missing rows are
created. Producer roles/sort orders are refreshed to the agreed values.
"""

from django.core.management.base import BaseCommand

from production.models import Producer, Product

PRODUCTS = (
    "همبرگر ۶۰ درصد ۱۰۰ گرمی",
    "همبرگر ۶۰ درصد ۱۲۵ گرمی",
    "همبرگر ۹۰ درصد ۱۰۰ گرمی",
    "همبرگر ۹۰ درصد ۱۲۰ گرمی",
    "همبرگر ۹۰ درصد ۱۲۵ گرمی",
    "همبرگر ۹۰ درصد ۱۵۰ گرمی",
    "همبرگر ۹۰ درصد ۱۸۰ گرمی",
)

PRODUCERS = (
    ("مهدی زمانی", "مدیر ۶۰ درصد", 10),
    ("خانم زارع", "مدیر ۹۰ درصد", 20),
    ("علی توانا", "مدیر مواد اولیه", 30),
)


class Command(BaseCommand):
    help = "Create the 7 products and 3 producers required by the dashboard."

    def handle(self, *args, **options):
        created_products = 0
        for name in PRODUCTS:
            _, created = Product.objects.get_or_create(
                name=name, defaults={"is_active": True}
            )
            created_products += int(created)

        created_producers = 0
        updated_producers = 0
        for name, role, sort_order in PRODUCERS:
            producer, created = Producer.objects.get_or_create(
                name=name,
                defaults={
                    "role": role,
                    "sort_order": sort_order,
                    "is_active": True,
                },
            )
            if created:
                created_producers += 1
                continue
            changed = []
            if producer.role != role:
                producer.role = role
                changed.append("role")
            if producer.sort_order != sort_order:
                producer.sort_order = sort_order
                changed.append("sort_order")
            if not producer.is_active:
                producer.is_active = True
                changed.append("is_active")
            if changed:
                producer.save(update_fields=changed)
                updated_producers += 1

        self.stdout.write(
            self.style.SUCCESS(
                "seed_catalog: "
                f"{created_products} محصول جدید، "
                f"{created_producers} تولیدکننده جدید، "
                f"{Product.objects.count()} محصول و "
                f"{Producer.objects.count()} تولیدکننده در مجموع."
            )
        )
