from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from inventory.models import Ingredient
from .models import Menu, MenuRecipe
from .serializers import MenuSerializer, RecipeLineInputSerializer
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsOwner
from accounts.permissions import feature_required

class MenuViewSet(viewsets.ModelViewSet):
    serializer_class = MenuSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "recipe", "manual_discount"]:
            return [IsAuthenticated(), feature_required("menus_manage")()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Menu.objects.filter(
            business=self.request.user.business
        ).prefetch_related("recipe_lines__ingredient")

    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"error": "Menu ini punya riwayat penjualan. Nonaktifkan aja biar histori tetap aman."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["put"])
    @transaction.atomic
    def recipe(self, request, pk=None):
        """Replace the whole recipe line set for this menu."""
        menu = get_object_or_404(
            Menu.objects.select_for_update(), pk=pk, business=request.user.business
        )

        line_serializer = RecipeLineInputSerializer(data=request.data.get("lines", []), many=True)
        line_serializer.is_valid(raise_exception=True)
        lines = line_serializer.validated_data

        ingredient_ids = [line["ingredient_id"] for line in lines]
        if len(set(ingredient_ids)) != len(ingredient_ids):
            return Response(
                {"error": "Satu ingredient cuma boleh muncul sekali di resep."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        owned_ids = set(
            Ingredient.objects.filter(
                id__in=ingredient_ids, business=request.user.business
            ).values_list("id", flat=True)
        )
        foreign_ids = [str(i) for i in ingredient_ids if i not in owned_ids]
        if foreign_ids:
            return Response(
                {"error": f"Ingredient gak ketemu di business kamu: {foreign_ids}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        menu.recipe_lines.all().delete()
        MenuRecipe.objects.bulk_create([
            MenuRecipe(menu=menu, ingredient_id=line["ingredient_id"], qty_per_serving=line["qty_per_serving"])
            for line in lines
        ])
        return Response(MenuSerializer(menu).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="manual-discount")
    def manual_discount(self, request, pk=None):
        """Set or clear the owner's manual promo discount. Kept strictly
        separate from active_discount_* (the AI/ingredient-triggered
        discount, owned by briefs/services.py) — this used to also
        overwrite active_discount_pct directly ("manual selalu menang,
        langsung timpa"), which both polluted the AI discount's own field
        and didn't even work, since the effective-discount check required
        active_discount_ingredient_id to be set too. Menu.get_effective_discount_pct()
        now checks manual_discount_pct on its own, so this action only
        ever touches the two manual_discount_* fields."""
        menu = get_object_or_404(Menu, pk=pk, business=request.user.business)
        pct = request.data.get("pct")
        until = request.data.get("until") or None

        if pct is not None:
            try:
                pct = Decimal(str(pct))
            except InvalidOperation:
                return Response({"error": "pct harus berupa angka."}, status=status.HTTP_400_BAD_REQUEST)
            if pct <= 0 or pct > 100:
                return Response({"error": "Diskon harus lebih dari 0 dan maksimal 100."}, status=status.HTTP_400_BAD_REQUEST)

        menu.manual_discount_pct = pct
        menu.manual_discount_until = until
        menu.save(update_fields=["manual_discount_pct", "manual_discount_until"])
        return Response(MenuSerializer(menu).data)