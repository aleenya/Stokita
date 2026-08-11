from django.contrib import admin
from .models import Ingredient, StockMovement


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ["name", "unit", "current_stock", "cost_per_unit", "low_stock_threshold"]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ["ingredient", "change_qty", "movement_type", "created_at"]
