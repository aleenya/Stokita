from django.core.management.base import BaseCommand

from accounts.models import Business
from briefs.services import generate_weekly_impact_checks


class Command(BaseCommand):
    """Jalanin generate_weekly_impact_checks buat semua business.

    Dimaksudkan buat dipanggil tiap Senin lewat scheduler eksternal
    (cron / Windows Task Scheduler / Celery beat) — Django sendiri
    gak punya scheduler bawaan, jadi command ini cuma nyediain
    entrypoint-nya, bukan jadwalnya.

    Usage:
        python manage.py run_weekly_impact_checks
    """

    help = "Generate weekly ActionImpactCheck rows for every business (run every Monday)."

    def handle(self, *args, **options):
        businesses = Business.objects.all()
        total_created = 0

        for business in businesses:
            try:
                checks = generate_weekly_impact_checks(business)
            except Exception as exc:
                self.stderr.write(
                    self.style.ERROR(f"[{business.name}] gagal: {exc}")
                )
                continue

            total_created += len(checks)
            self.stdout.write(
                f"[{business.name}] {len(checks)} impact check dibuat."
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Selesai. {total_created} impact check dibuat buat {businesses.count()} business."
            )
        )
