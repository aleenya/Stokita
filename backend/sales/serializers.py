from rest_framework import serializers
from .models import Sale, SaleItem


class SaleItemInputSerializer(serializers.Serializer):
    """Validates POST /sales/ body items — the view used to pass
    request.data straight into record_sale() with zero validation, so a
    missing field raised an uncaught KeyError (500) and a negative
    quantity would flip the stock-deduction math into an addition
    (record_sale does current_stock -= qty_per_serving * quantity)."""
    menu_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


class RecordSaleSerializer(serializers.Serializer):
    sale_date = serializers.DateField()
    items = SaleItemInputSerializer(many=True, allow_empty=False)


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