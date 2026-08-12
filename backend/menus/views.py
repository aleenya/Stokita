from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from inventory.models import Ingredient
from .models import Menu, MenuRecipe
from .serializers import MenuSerializer
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsOwner
from accounts.permissions import feature_required
 
class MenuViewSet(viewsets.ModelViewSet):
    serializer_class = MenuSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "recipe"]:
            return [IsAuthenticated(), feature_required("menus_manage")()]
        return [IsAuthenticated()]
 
    def get_queryset(self):
        return Menu.objects.filter(
            business=self.request.user.business
        ).prefetch_related("recipe_lines__ingredient")
 
    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business)
 
    @action(detail=True, methods=["put"])
    def recipe(self, request, pk=None):
        """Replace the whole recipe line set for this menu."""
        menu = self.get_object()
        lines = request.data.get("lines", [])

        ingredient_ids = [line["ingredient_id"] for line in lines]
        owned_ids = set(
            Ingredient.objects.filter(
                id__in=ingredient_ids, business=request.user.business
            ).values_list("id", flat=True)
        )
        foreign_ids = [str(i) for i in ingredient_ids if str(i) not in {str(o) for o in owned_ids}]
        if foreign_ids:
            return Response(
                {"error": f"Ingredient(s) not found in your business: {foreign_ids}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        menu.recipe_lines.all().delete()
        for line in lines:
            MenuRecipe.objects.create(
                menu=menu,
                ingredient_id=line["ingredient_id"],
                qty_per_serving=line["qty_per_serving"],
            )
        return Response(MenuSerializer(menu).data, status=status.HTTP_200_OK)
