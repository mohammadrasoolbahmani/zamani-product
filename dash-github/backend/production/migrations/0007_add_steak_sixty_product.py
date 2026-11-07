from django.db import migrations

STEAK_NAME = "استیک ۶۰ درصد"


def add_steak_product(apps, schema_editor):
    Product = apps.get_model("production", "Product")
    Product.objects.get_or_create(name=STEAK_NAME, defaults={"is_active": True})


def remove_steak_product(apps, schema_editor):
    Product = apps.get_model("production", "Product")
    Product.objects.filter(name=STEAK_NAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("production", "0006_garrirecord_meat_output_kg"),
    ]

    operations = [
        migrations.RunPython(add_steak_product, remove_steak_product),
    ]
