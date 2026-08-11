from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Ingredient, StockMovement
from .serializers import IngredientSerializer
 
 
class IngredientViewSet(viewsets.ModelViewSet):
    serializer_class = IngredientSerializer
 
    def get_queryset(self):
        return Ingredient.objects.filter(business=self.request.user.business)
 
    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business)
 
    @action(detail=True, methods=["post"])
    def restock(self, request, pk=None):
        ingredient = self.get_object()
        qty = Decimal(str(request.data.get("change_qty", 0)))
        expiry = request.data.get("expiry_date")
        if qty <= 0:
            return Response({"error": "change_qty must be positive"},
                            status=status.HTTP_400_BAD_REQUEST)
        StockMovement.objects.create(
            ingredient=ingredient, change_qty=qty,
            movement_type=StockMovement.RESTOCK,
            expiry_date=expiry or None, created_by=request.user,
        )
        ingredient.current_stock += qty
        ingredient.save(update_fields=["current_stock"])
        return Response({"current_stock": ingredient.current_stock})
