from rest_framework.routers import DefaultRouter
from .views import SaleViewSet, ProfitAnalyticsViewSet
 
router = DefaultRouter()
router.register("sales", SaleViewSet, basename="sale")
router.register("analytics/profit", ProfitAnalyticsViewSet, basename="profit")
urlpatterns = router.urls
