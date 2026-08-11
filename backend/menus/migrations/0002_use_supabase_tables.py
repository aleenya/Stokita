from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("menus", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DROP TABLE IF EXISTS menus_menurecipe CASCADE;
                DROP TABLE IF EXISTS menus_menu CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterModelTable(name="menu", table="menus"),
                migrations.AlterModelTable(name="menurecipe", table="menu_recipes"),
            ],
            database_operations=[],
        ),
    ]
