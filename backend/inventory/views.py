from decimal import Decimal, InvalidOperation
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .models import Ingredient, StockMovement
from .serializers import IngredientSerializer
from .services import apply_restock, apply_waste
from datetime import date, timedelta
from .ai import estimate_shelf_life, parse_receipt
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsOwner
from accounts.permissions import feature_required

RECEIPT_MAX_SIZE = 5 * 1024 * 1024
RECEIPT_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
 
 
class IngredientViewSet(viewsets.ModelViewSet):
    serializer_class = IngredientSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), feature_required("ingredients_manage")()]
        return [IsAuthenticated()]
 
    def get_queryset(self):
        return Ingredient.objects.filter(business=self.request.user.business)
 
    def perform_create(self, serializer):
        ingredient = serializer.save(business=self.request.user.business)
        initial_stock = self.request.data.get("current_stock")
        if initial_stock and Decimal(str(initial_stock)) > 0:
            qty = Decimal(str(initial_stock))
            expiry = self.request.data.get("expiry_date")
            StockMovement.objects.create(
                ingredient=ingredient, change_qty=qty,
                movement_type=StockMovement.RESTOCK,
                expiry_date=expiry or None,
                created_by=self.request.user,
            )
            ingredient.current_stock = qty
            ingredient.save(update_fields=["current_stock"])

    def perform_update(self, serializer):
        ingredient = serializer.instance
        new_unit = serializer.validated_data.get("unit")
        if new_unit and new_unit != ingredient.unit and ingredient.menurecipe_set.exists():
            raise ValidationError(
                {"unit": "Gak bisa ganti unit — bahan ini udah dipakai di resep menu."}
            )
        serializer.save(current_stock=serializer.instance.current_stock)

    @action(detail=True, methods=["post"])
    def restock(self, request, pk=None):
        ingredient = self.get_object()
        try:
            qty = Decimal(str(request.data.get("change_qty", 0)))
            total_cost = Decimal(str(request.data.get("total_cost", 0)))
        except InvalidOperation:
            return Response({"error": "change_qty/total_cost harus berupa angka."},
                            status=status.HTTP_400_BAD_REQUEST)
        if qty <= 0:
            return Response({"error": "change_qty must be positive"},
                            status=status.HTTP_400_BAD_REQUEST)
        expiry = request.data.get("expiry_date")
        ingredient = apply_restock(
            ingredient, qty, total_cost=total_cost, expiry_date=expiry or None, user=request.user,
        )
        return Response({"current_stock": ingredient.current_stock, "cost_per_unit": ingredient.cost_per_unit})

    @action(detail=True, methods=["post"])
    def waste(self, request, pk=None):
        ingredient = self.get_object()
        try:
            qty = Decimal(str(request.data.get("qty", 0)))
        except InvalidOperation:
            return Response({"error": "qty harus berupa angka."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ingredient = apply_waste(ingredient, qty, user=request.user)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"current_stock": ingredient.current_stock})

    @action(detail=False, methods=["post"], url_path="estimate-expiry")
    def estimate_expiry(self, request):
        """
        Dipanggil dari tombol 'Generate expiry' di form restock —
        baik mode add ingredient baru (nama diketik) maupun mode edit
        (nama dari dropdown ingredient existing). Cuma butuh nama,
        gak butuh ingredient sudah ada di DB atau belum.
        Form belum di-submit di titik ini.
        """
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"error": "nama wajib diisi"}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get("notes") or ""
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


    @action(detail=False, methods=["post"], url_path="parse-receipt")
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
        if image_file.size > RECEIPT_MAX_SIZE:
            return Response({"error": "Ukuran gambar maksimal 5 MB."}, status=status.HTTP_400_BAD_REQUEST)
        if image_file.content_type not in RECEIPT_ALLOWED_TYPES:
            return Response({"error": "File harus berupa gambar JPG, PNG, atau WEBP."},
                            status=status.HTTP_400_BAD_REQUEST)

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
                "total_price": item.get("total_price"),
                "suggested_expiry_date": suggested_expiry,
                "confidence": confidence,
                "note": note,
            })

        return Response({"items": results})

    @action(detail=False, methods=["post"], url_path="bulk-restock")
    @transaction.atomic
    def bulk_restock(self, request):
        """
        Submit banyak item sekaligus (hasil review dari parse-receipt).
        Body: {"items": [{"name", "unit", "change_qty", "total_price", "expiry_date"}]}
        Ingredient yang namanya belum ada di business ini (case-insensitive)
        otomatis dibikinin. Dibungkus satu transaksi biar gak ada state
        nyangkut separo kalau ada error di tengah batch.
        """
        items = request.data.get("items", [])
        if not items:
            return Response({"error": "items wajib diisi"}, status=status.HTTP_400_BAD_REQUEST)

        business = request.user.business
        restocked = []
        skipped = []

        for item in items:
            name = (item.get("name") or "").strip()
            try:
                change_qty = Decimal(str(item.get("change_qty", 0)))
                total_cost = Decimal(str(item.get("total_price", 0) or 0))
            except InvalidOperation:
                skipped.append({"name": name or "(tanpa nama)", "reason": "qty/harga bukan angka"})
                continue
            if not name:
                skipped.append({"name": "(tanpa nama)", "reason": "nama kosong"})
                continue
            if change_qty <= 0:
                skipped.append({"name": name, "reason": "qty harus lebih dari 0"})
                continue

            ingredient = Ingredient.objects.filter(business=business, name__iexact=name).first()
            if not ingredient:
                ingredient = Ingredient.objects.create(
                    business=business, name=name, unit=item.get("unit", "pcs"),
                )
            ingredient = apply_restock(
                ingredient, change_qty, total_cost=total_cost,
                expiry_date=item.get("expiry_date") or None, user=request.user,
            )
            restocked.append(str(ingredient.id))

        return Response(
            {"restocked_ingredient_ids": restocked, "skipped": skipped},
            status=status.HTTP_201_CREATED,
        )