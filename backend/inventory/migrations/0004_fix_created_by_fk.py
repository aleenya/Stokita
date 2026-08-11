from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0003_use_supabase_tables"),
        ("accounts", "0002_use_supabase_tables"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;
                ALTER TABLE stock_movements
                    ADD CONSTRAINT stock_movements_created_by_fkey
                    FOREIGN KEY (created_by) REFERENCES accounts_user(id) ON DELETE SET NULL;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
