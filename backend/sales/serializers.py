from rest_framework import serializers
from .models import Sale, SaleItem
 
 
class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ["id", "menu", "quantity", "unit_price", "unit_cost"]
 
 
class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
 
    class Meta:
        model = Sale
        fields = ["id", "sale_date", "recorded_by", "items", "created_at"]
        read_only_fields = ["recorded_by", "created_at"]