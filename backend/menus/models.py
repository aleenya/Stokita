import uuid
from decimal import Decimal
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from accounts.models import Business
from inventory.models import Ingredient
from datetime import date


class Menu(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="menus")
    name = models.CharField(max_length=200)
    sell_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(Decimal("0.01"))]
    )
    target_margin = models.DecimalField(
        max_digits=5, decimal_places=2, default=30, validators=[MinValueValidator(0)]
    )  # %
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    active_discount_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    active_discount_ingredient = models.ForeignKey(Ingredient, on_delete=models.SET_NULL, null=True, blank=True)
    active_discount_expiry_date = models.DateField(null=True, blank=True)  # snapshot expiry batch pemicu diskon
    manual_discount_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    manual_discount_until = models.DateField(null=True, blank=True)  # null = gak ada batas waktu, manual off sendiri

    class Meta:
        db_table = "menus"

    def unit_cost(self):
        """Sum of (ingredient cost x qty per serving) across the recipe.
        Reuses the prefetch cache when the caller did
        .prefetch_related('recipe_lines__ingredient') (list views) so this
        doesn't re-query per menu; falls back to one select_related query
        for standalone lookups (e.g. mid-transaction in record_sale)."""
        if "recipe_lines" in getattr(self, "_prefetched_objects_cache", {}):
            lines = self.recipe_lines.all()
        else:
            lines = self.recipe_lines.select_related("ingredient")
        total = 0
        for line in lines:
            total += line.ingredient.cost_per_unit * line.qty_per_serving
        return total

    def __str__(self):
        return self.name

    def get_effective_discount_pct(self):
        """Diskon dianggap aktif HANYA kalau kondisinya beneran masih
        valid, dicek live gak ngandelin field tersimpan yang bisa basi.
        Manual (dari owner) menang duluan kalau masih aktif — sebelumnya
        ada DUA definisi method ini di class ini, yang kedua diam-diam
        nimpa yang pertama (Python method override), jadi cabang manual
        di bawah ini gak pernah kepanggil sama sekali: diskon manual
        keliatan "aktif" di UI tapi record_sale() tetap motong harga
        penuh. Sekarang cuma ada satu definisi yang bener-bener ngecek
        keduanya."""
        if self.manual_discount_pct:
            expired = self.manual_discount_until and self.manual_discount_until < date.today()
            if not expired:
                return self.manual_discount_pct
        if self.active_discount_pct and self.active_discount_ingredient_id:
            ing = self.active_discount_ingredient
            expired = self.active_discount_expiry_date and self.active_discount_expiry_date < date.today()
            if ing.current_stock > 0 and not expired:
                return self.active_discount_pct
        return None


class MenuRecipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name="recipe_lines")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    qty_per_serving = models.DecimalField(
        max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))]
    )

    class Meta:
        db_table = "menu_recipes"
        unique_together = ("menu", "ingredient")