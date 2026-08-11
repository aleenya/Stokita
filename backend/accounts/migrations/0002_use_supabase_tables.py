from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS accounts_business CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterModelTable(name="business", table="businesses"),
            ],
            database_operations=[],
        ),
    ]
