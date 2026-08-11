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
        unique_together = ("business", "brief_date")


class BriefAction(models.Model):
    RESTOCK = "restock"
    DISCOUNT = "discount"
    REVIEW_MENU = "review_menu"
    EXPIRY_ALERT = "expiry_alert"
    TYPE_CHOICES = [(RESTOCK, "Restock"), (DISCOUNT, "Discount"),
                    (REVIEW_MENU, "Review menu"), (EXPIRY_ALERT, "Expiry alert")]

    PENDING = "pending"
    ACTED = "acted"
    DISMISSED = "dismissed"
    STATUS_CHOICES = [(PENDING, "Pending"), (ACTED, "Acted"), (DISMISSED, "Dismissed")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brief = models.ForeignKey(DailyBrief, on_delete=models.CASCADE, related_name="actions")
    action_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    message = models.TextField()
    related_menu = models.ForeignKey(Menu, on_delete=models.SET_NULL, null=True, blank=True)
    related_ingredient = models.ForeignKey(Ingredient, on_delete=models.SET_NULL, null=True, blank=True)
    rupiah_impact = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)

    class Meta:
        db_table = "brief_actions"