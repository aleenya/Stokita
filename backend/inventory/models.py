import uuid
from django.db import models
from accounts.models import Business, User


class Ingredient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="ingredients")
    name = models.CharField(max_length=200)
    unit = models.CharField(max_length=20, default="kg")
    current_stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    cost_per_unit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    low_stock_threshold = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.current_stock} {self.unit})"


class StockMovement(models.Model):
    RESTOCK = "restock"
    ADJUSTMENT = "adjustment"
    SALE_DEDUCTION = "sale_deduction"
    TYPE_CHOICES = [(RESTOCK, "Restock"), (ADJUSTMENT, "Adjustment"), (SALE_DEDUCTION, "Sale deduction")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name="movements")
    change_qty = models.DecimalField(max_digits=12, decimal_places=3)  # +in / -out
    movement_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    expiry_date = models.DateField(null=True, blank=True)
    related_sale = models.ForeignKey(
        "sales.Sale", on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_movements"
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)