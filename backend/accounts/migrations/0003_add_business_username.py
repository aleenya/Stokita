from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_use_supabase_tables"),
    ]

    operations = [
        migrations.AddField(
            model_name="business",
            name="username",
            field=models.SlugField(max_length=50, unique=True, null=True, blank=True),
        ),
    ]