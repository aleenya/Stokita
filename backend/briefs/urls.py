from rest_framework.routers import DefaultRouter
from .views import BriefViewSet, BriefActionViewSet
 
router = DefaultRouter()
router.register("briefs", BriefViewSet, basename="brief")
router.register("briefs/actions", BriefActionViewSet, basename="brief-action")
urlpatterns = router.urls
