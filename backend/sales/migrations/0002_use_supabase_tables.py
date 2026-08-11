from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DROP TABLE IF EXISTS sales_saleitem CASCADE;
                DROP TABLE IF EXISTS sales_sale CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterModelTable(name="sale", table="sales"),
                migrations.AlterModelTable(name="saleitem", table="sale_items"),
                migrations.AlterField(
                    model_name="sale",
                    name="recorded_by",
                    field=models.ForeignKey(
                        null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL,
                        to="accounts.user", db_column="recorded_by",
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
