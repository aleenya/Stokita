from rest_framework import serializers
from .models import Ingredient, StockMovement
 
 
class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ["id", "name", "unit", "current_stock", "cost_per_unit",
                  "low_stock_threshold", "created_at"]
        read_only_fields = ["created_at"]
 
 
class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = ["id", "ingredient", "change_qty", "movement_type",
                  "expiry_date", "related_sale", "created_at"]
        read_only_fields = ["created_at"]
