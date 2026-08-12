import uuid
from django.db import models
from accounts.models import Business
from menus.models import Menu
from inventory.models import Ingredient


class DailyBrief(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="briefs")
    brief_date = models.DateField()
    summary = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "daily_briefs"
        ordering = ["-created_at"]
        # NOTE: sengaja TIDAK ada unique_together("business", "brief_date")
        # lagi. Gate "1x per 24 jam" sekarang berbasis timestamp
        # (created_at brief terakhir), bukan tanggal kalender — lihat
        # BRIEF_COOLDOWN di services.py. Kalau dulu digate per tanggal,
        # generate jam 23:58 lalu jam 00:02 (4 menit kemudian, beda
        # tanggal) akan lolos padahal belum 24 jam.


class BriefAction(models.Model):
    DISCOUNT = "discount"
    REVIEW_MENU = "review_menu"
    TYPE_CHOICES = [(DISCOUNT, "Discount"), (REVIEW_MENU, "Review menu")]
    # NOTE: "restock" dan "expiry_alert" SENGAJA dihapus dari sini.
    # Brief sekarang cuma isinya rekomendasi HARGA (AI-derived). Restock
    # & expiry alert dipindah jadi live endpoint di inventory app
    # (GET /ingredients/low-stock/, GET /ingredients/expiring/) —
    # gak lagi kena cooldown 24 jam & gak ada status acted/dismissed,
    # karena mereka bukan "rekomendasi yang di-generate", tapi status
    # stok real-time.

    PENDING = "pending"
    ACTED = "acted"
    DISMISSED = "dismissed"
    STATUS_CHOICES = [(PENDING, "Pending"), (ACTED, "Acted"), (DISMISSED, "Dismissed")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brief = models.ForeignKey(DailyBrief, on_delete=models.CASCADE, related_name="actions")
    action_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=120, null=True)
    # Judul pendek buat UI, misal "Diskon 20% Menu Nasi Goreng" atau
    # "Review Harga Ayam Geprek". Ini yang ditampilin gede di kartu.
    message = models.TextField()
    # Reasoning/alasan, ditampilin sebagai baris kedua di kartu (kecil),
    # misal "Bahan Nasi Goreng akan segera kadaluwarsa dalam 2 hari."
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    # Cuma diisi kalau action_type == "discount". Ini angka terstruktur
    # yang dipakai logic apply-diskon-ke-sales, BUKAN cuma teks di title.
    related_menu = models.ForeignKey(Menu, on_delete=models.SET_NULL, null=True, blank=True)
    related_ingredient = models.ForeignKey(Ingredient, on_delete=models.SET_NULL, null=True, blank=True)
    rupiah_impact = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)

    # untuk impact
    acted_at = models.DateTimeField(null=True, blank=True)
    baseline_snapshot = models.JSONField(null=True, blank=True)

    discount_ingredient_expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "brief_actions"

class ActionImpactCheck(models.Model):
    """
    Satu baris = satu hasil pengecekan mingguan buat sebuah BriefAction.
    Satu action bisa punya banyak baris ini (dicek tiap minggu selama
    masih dalam window 30 hari sejak acted_at).
    """
    POSITIVE = "positive"
    NEGATIVE = "negative"
    INCONCLUSIVE = "inconclusive"
    EXTERNAL = "external"
    ANSWER_CHOICES = [
        (POSITIVE, "Positive"), (NEGATIVE, "Negative"),
        (INCONCLUSIVE, "Inconclusive"), (EXTERNAL, "Likely external"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.ForeignKey(BriefAction, on_delete=models.CASCADE, related_name="impact_checks")
    week_start = models.DateField()  # Senin dari minggu pengecekan ini dilakukan
    followup_snapshot = models.JSONField()
    answer = models.CharField(max_length=15, choices=ANSWER_CHOICES)
    reasoning = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("action", "week_start") 
        ordering = ["-week_start"]
        db_table = "action_impact_checks"