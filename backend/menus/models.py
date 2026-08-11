import uuid
from django.db import models
from accounts.models import Business
from inventory.models import Ingredient


class Menu(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="menus")
    name = models.CharField(max_length=200)
    sell_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    target_margin = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # %
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "menus"

    def unit_cost(self):
        """Sum of (ingredient cost x qty per serving) across the recipe."""
        total = 0
        for line in self.recipe_lines.select_related("ingredient"):
            total += line.ingredient.cost_per_unit * line.qty_per_serving
        return total

    def __str__(self):
        return self.name


class MenuRecipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name="recipe_lines")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    qty_per_serving = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        unique_together = ("menu", "ingredient")