from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import StaffViewSet, MeView

router = DefaultRouter()
router.register("staff", StaffViewSet, basename="staff")

urlpatterns = router.urls + [
    path("me/", MeView.as_view()),
]
