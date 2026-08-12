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
 
    class Meta:
        model = Menu
        fields = ["id", "name", "sell_price", "target_margin", "is_active",
          "recipe_lines", "unit_cost", "created_at",
          "active_discount_pct", "active_discount_ingredient", "active_discount_expiry_date"]  # tambahan
        read_only_fields = ["created_at"]
 
    def get_unit_cost(self, obj):
        return obj.unit_cost()
