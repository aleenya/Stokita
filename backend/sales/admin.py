from django.contrib import admin
from .models import Sale, SaleItem


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ["sale_date", "business", "recorded_by", "created_at"]


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ["sale", "menu", "quantity", "unit_price", "unit_cost"]
