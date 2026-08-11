from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0002_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DROP TABLE IF EXISTS inventory_stockmovement CASCADE;
                DROP TABLE IF EXISTS inventory_ingredient CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterModelTable(name="ingredient", table="ingredients"),
                migrations.AlterModelTable(name="stockmovement", table="stock_movements"),
                migrations.AlterField(
                    model_name="stockmovement",
                    name="created_by",
                    field=models.ForeignKey(
                        null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL,
                        to="accounts.user", db_column="created_by",
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
