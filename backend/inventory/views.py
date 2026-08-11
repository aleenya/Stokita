from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Ingredient, StockMovement
from .serializers import IngredientSerializer
from datetime import date, timedelta
from .ai import estimate_shelf_life
 
 
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

    @action(detail=False, methods=["post"])
    def estimate_expiry(self, request):
        """
        Dipanggil dari tombol 'Generate expiry' di form restock —
        baik mode add ingredient baru (nama diketik) maupun mode edit
        (nama dari dropdown ingredient existing). Cuma butuh nama,
        gak butuh ingredient sudah ada di DB atau belum.
        Form belum di-submit di titik ini.
        """
        name = request.data.get("name", "").strip()
        if not name:
            return Response({"error": "nama wajib diisi"}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get("notes", "")
        result = estimate_shelf_life(ingredient_name=name, notes=notes)
        if result is None:
            return Response(
                {"error": "Gagal estimasi. Isi expiry date manual."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        estimated_days = result["estimated_days"]
        suggested_expiry = date.today() + timedelta(days=estimated_days)

        return Response({
            "estimated_days": estimated_days,
            "confidence": result.get("confidence"),
            "note": result.get("note"),
            "suggested_expiry_date": suggested_expiry.isoformat(),
        })