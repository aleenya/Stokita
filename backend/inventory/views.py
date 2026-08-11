from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Ingredient, StockMovement
from .serializers import IngredientSerializer
from datetime import date, timedelta
from .ai import estimate_shelf_life, parse_receipt
 
 
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


    @action(detail=False, methods=["post"])
    def parse_receipt_view(self, request):
        """
        Upload foto struk -> extract item bahan + auto-generate estimasi
        expiry per item (reuse estimate_shelf_life, text-based, biar akurat).
        Belum nyimpen ke DB. User masih review/edit tiap baris dulu sebelum
        submit lewat bulk_restock.
        """
        image_file = request.FILES.get("image")
        if not image_file:
            return Response({"error": "image file wajib diisi"}, status=status.HTTP_400_BAD_REQUEST)

        raw_items = parse_receipt(
            image_bytes=image_file.read(),
            mime_type=image_file.content_type or "image/jpeg",
        )
        if not raw_items:
            return Response(
                {"error": "Gak ada item yang berhasil dikenali dari struk ini. Coba foto lebih jelas atau isi manual."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        results = []
        for item in raw_items:
            name = (item.get("name") or "").strip()
            if not name:
                continue

            expiry_result = estimate_shelf_life(ingredient_name=name)
            if expiry_result:
                suggested_expiry = (date.today() + timedelta(days=expiry_result["estimated_days"])).isoformat()
                confidence, note = expiry_result.get("confidence"), expiry_result.get("note")
            else:
                suggested_expiry, confidence, note = None, None, "Gagal estimasi, isi manual"

            results.append({
                "name": name,
                "quantity": item.get("quantity", 1),
                "unit": item.get("unit", "pcs"),
                "suggested_expiry_date": suggested_expiry,
                "confidence": confidence,
                "note": note,
            })

        return Response({"items": results})

    @action(detail=False, methods=["post"])
    def bulk_restock(self, request):
        """
        Submit banyak item sekaligus (hasil review dari parse-receipt).
        Body: {"items": [{"name", "unit", "change_qty", "expiry_date"}]}
        Ingredient yang namanya belum ada di business ini otomatis dibikinin.
        """
        items = request.data.get("items", [])
        if not items:
            return Response({"error": "items wajib diisi"}, status=status.HTTP_400_BAD_REQUEST)

        business = request.user.business
        restocked = []

        for item in items:
            name = (item.get("name") or "").strip()
            try:
                change_qty = Decimal(str(item.get("change_qty", 0)))
            except Exception:
                continue
            if not name or change_qty <= 0:
                continue  # skip baris invalid, jangan gagalin semua batch

            ingredient, _ = Ingredient.objects.get_or_create(
                business=business, name=name,
                defaults={"unit": item.get("unit", "pcs")},
            )
            StockMovement.objects.create(
                ingredient=ingredient, change_qty=change_qty,
                movement_type=StockMovement.RESTOCK,
                expiry_date=item.get("expiry_date") or None,
                created_by=request.user,
            )
            ingredient.current_stock += change_qty
            ingredient.save(update_fields=["current_stock"])
            restocked.append(str(ingredient.id))

        return Response({"restocked_ingredient_ids": restocked}, status=status.HTTP_201_CREATED)