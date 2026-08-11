from rest_framework import serializers
from .models import Menu, MenuRecipe
 
 
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
                  "recipe_lines", "unit_cost", "created_at"]
        read_only_fields = ["created_at"]
 
    def get_unit_cost(self, obj):
        return obj.unit_cost()
