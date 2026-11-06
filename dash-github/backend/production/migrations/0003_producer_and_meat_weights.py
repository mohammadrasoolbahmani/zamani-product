from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


PRODUCERS = [
    ("مهدی زمانی", "مدیر ۶۰ درصد", 10),
    ("علی توانا", "مدیر ۹۰ درصد", 20),
    ("کمال اکبری", "تولید شرکت", 30),
]


def create_producers_and_assign(apps, schema_editor):
    Producer = apps.get_model("production", "Producer")
    ProductionRecord = apps.get_model("production", "ProductionRecord")

    producers = []
    for name, role, order in PRODUCERS:
        producer, _ = Producer.objects.get_or_create(
            name=name,
            defaults={"role": role, "sort_order": order, "is_active": True},
        )
        producers.append(producer)

    if producers:
        ProductionRecord.objects.filter(producer__isnull=True).update(
            producer=producers[0]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("production", "0002_alter_productionrecord_amount_kg"),
    ]

    operations = [
        migrations.CreateModel(
            name="Producer",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "name",
                    models.CharField(max_length=120, unique=True, verbose_name="نام تولیدکننده"),
                ),
                ("role", models.CharField(max_length=120, verbose_name="سمت / سهم")),
                (
                    "sort_order",
                    models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش"),
                ),
                ("is_active", models.BooleanField(default=True, verbose_name="فعال")),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد"),
                ),
            ],
            options={
                "verbose_name": "تولیدکننده",
                "verbose_name_plural": "تولیدکنندگان",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.AddField(
            model_name="productionrecord",
            name="producer",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="records",
                to="production.producer",
                verbose_name="تولیدکننده",
            ),
        ),
        migrations.RunPython(create_producers_and_assign, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="productionrecord",
            name="producer",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="records",
                to="production.producer",
                verbose_name="تولیدکننده",
            ),
        ),
        migrations.AddField(
            model_name="productionrecord",
            name="delivered_meat_kg",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=12,
                validators=[
                    django.core.validators.MinValueValidator(Decimal("0"))
                ],
                verbose_name="وزن گوشت تحویل داده شده (کیلوگرم)",
            ),
        ),
        migrations.AddField(
            model_name="productionrecord",
            name="waste_kg",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=12,
                validators=[
                    django.core.validators.MinValueValidator(Decimal("0"))
                ],
                verbose_name="وزن معدومی‌ها (کیلوگرم)",
            ),
        ),
        migrations.AlterField(
            model_name="productionrecord",
            name="amount_kg",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=12,
                validators=[
                    django.core.validators.MinValueValidator(Decimal("0.01"))
                ],
                verbose_name="وزن گوشت تولید شده (کیلوگرم)",
            ),
        ),
        migrations.AlterField(
            model_name="productionrecord",
            name="packages_count",
            field=models.PositiveIntegerField(
                default=0, verbose_name="تعداد بسته‌های تولید شده"
            ),
        ),
        migrations.AddIndex(
            model_name="productionrecord",
            index=models.Index(
                fields=["producer", "date"], name="record_producer_date_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="productionrecord",
            constraint=models.CheckConstraint(
                condition=models.Q(("delivered_meat_kg__gte", 0)),
                name="production_delivered_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="productionrecord",
            constraint=models.CheckConstraint(
                condition=models.Q(("waste_kg__gte", 0)),
                name="production_waste_non_negative",
            ),
        ),
    ]
