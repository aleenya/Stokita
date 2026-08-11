from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Menu, MenuRecipe
from .serializers import MenuSerializer
 
 
class MenuViewSet(viewsets.ModelViewSet):
    serializer_class = MenuSerializer
 
    def get_queryset(self):
        return Menu.objects.filter(business=self.request.user.business)
 
    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business)
 
    @action(detail=True, methods=["put"])
    def recipe(self, request, pk=None):
        """Replace the whole recipe line set for this menu."""
        menu = self.get_object()
        lines = request.data.get("lines", [])
        menu.recipe_lines.all().delete()
        for line in lines:
            MenuRecipe.objects.create(
                menu=menu,
                ingredient_id=line["ingredient_id"],
                qty_per_serving=line["qty_per_serving"],
            )
        return Response(MenuSerializer(menu).data, status=status.HTTP_200_OK)
