from rest_framework import serializers
from .models import Ingredient, StockMovement
 
 
class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ["id", "name", "unit", "current_stock", "cost_per_unit",
                  "low_stock_threshold", "created_at"]
        read_only_fields = ["created_at"]
 
 
class StockMovementSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    ingredient_unit = serializers.CharField(source="ingredient.unit", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True, default=None)

    class Meta:
        model = StockMovement
        fields = ["id", "ingredient", "ingredient_name", "ingredient_unit", "change_qty",
                  "movement_type", "expiry_date", "related_sale", "created_by_name", "created_at"]
        read_only_fields = ["created_at"]
