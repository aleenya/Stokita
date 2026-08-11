from rest_framework.routers import DefaultRouter
from .views import MenuViewSet
 
router = DefaultRouter()
router.register("menus", MenuViewSet, basename="menu")
urlpatterns = router.urls
