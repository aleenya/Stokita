from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0002_use_supabase_tables"),
        ("accounts", "0002_use_supabase_tables"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_recorded_by_fkey;
                ALTER TABLE sales
                    ADD CONSTRAINT sales_recorded_by_fkey
                    FOREIGN KEY (recorded_by) REFERENCES accounts_user(id) ON DELETE SET NULL;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
