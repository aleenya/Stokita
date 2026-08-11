from django.contrib import admin
from .models import Menu, MenuRecipe


@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    list_display = ["name", "sell_price", "target_margin", "is_active"]


@admin.register(MenuRecipe)
class MenuRecipeAdmin(admin.ModelAdmin):
    list_display = ["menu", "ingredient", "qty_per_serving"]
