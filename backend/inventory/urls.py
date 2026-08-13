from rest_framework.routers import DefaultRouter
from .views import IngredientViewSet, StockMovementViewSet

router = DefaultRouter()
router.register("ingredients", IngredientViewSet, basename="ingredient")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
urlpatterns = router.urls
