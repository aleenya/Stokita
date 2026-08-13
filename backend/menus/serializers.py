from decimal import Decimal
from rest_framework import serializers
from .models import Menu, MenuRecipe


class RecipeLineInputSerializer(serializers.Serializer):
    """Validates PUT /menus/{id}/recipe/ body lines — the view used to
    index into request.data dicts directly with no validation at all
    (KeyError -> 500 on a missing field, no floor on qty_per_serving)."""
    ingredient_id = serializers.UUIDField()
    qty_per_serving = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0.001")
    )


class MenuRecipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuRecipe
        fields = ["id", "ingredient", "qty_per_serving"]
 
 
class MenuSerializer(serializers.ModelSerializer):
    recipe_lines = MenuRecipeSerializer(many=True, read_only=True)
    unit_cost = serializers.SerializerMethodField()
    # SerializerMethodField, not a plain model field: has to run
    # get_effective_discount_pct() (manual-priority, live expiry/stock
    # check) rather than echo whatever's raw in the DB column, or a
    # discount that's expired/lost its triggering stock would still show
    # as active in the UI. (get_active_discount_pct() used to be defined
    # inside class Meta instead of on the serializer, so DRF never called
    # it and this field silently returned the raw column instead.)
    active_discount_pct = serializers.SerializerMethodField()

    class Meta:
        model = Menu
        fields = ["id", "name", "sell_price", "target_margin", "is_active",
          "recipe_lines", "unit_cost", "created_at",
          "active_discount_pct", "manual_discount_pct", "manual_discount_until"]
        read_only_fields = [
            "created_at", "active_discount_pct", "manual_discount_pct", "manual_discount_until",
        ]  # manual_discount_* only writable via the dedicated /manual-discount/ action, which validates pct

    def get_unit_cost(self, obj):
        return obj.unit_cost()

    def get_active_discount_pct(self, obj):
        return obj.get_effective_discount_pct()
