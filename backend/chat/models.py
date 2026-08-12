import uuid

from django.db import models


class PendingAction(models.Model):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (CONFIRMED, "Confirmed"),
        (CANCELLED, "Cancelled"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="pending_chat_actions",
    )

    business = models.ForeignKey(
        "accounts.Business",
        on_delete=models.CASCADE,
        related_name="pending_chat_actions",
    )

    intent = models.CharField(max_length=50)

    ingredient = models.ForeignKey(
        "inventory.Ingredient",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="pending_chat_actions",
    )

    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
    )

    unit = models.CharField(max_length=30)

    message = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=PENDING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)