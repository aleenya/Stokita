from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("briefs", "0002_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DROP TABLE IF EXISTS briefs_briefaction CASCADE;
                DROP TABLE IF EXISTS briefs_dailybrief CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterModelTable(name="dailybrief", table="daily_briefs"),
                migrations.AlterModelTable(name="briefaction", table="brief_actions"),
            ],
            database_operations=[],
        ),
    ]
