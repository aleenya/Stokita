from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import User, StaffFeatureGrant
from .serializers import StaffSerializer
from .permissions import IsOwner
from rest_framework.views import APIView
from .serializers import UserSerializer


class StaffViewSet(viewsets.ViewSet):
    """People management — sengaja tetep IsOwner (bukan feature_required),
    biar staff yang di-grant nggak bisa ngasih grant ke diri sendiri/orang lain."""
    permission_classes = [IsAuthenticated, IsOwner]

    def list(self, request):
        staff = User.objects.filter(business=request.user.business, role=User.STAFF)
        return Response(StaffSerializer(staff, many=True).data)

    @action(detail=True, methods=["put"])
    def grants(self, request, pk=None):
        try:
            staff = User.objects.get(id=pk, business=request.user.business, role=User.STAFF)
        except User.DoesNotExist:
            return Response(status=404)

        valid_codes = dict(StaffFeatureGrant.FEATURE_CHOICES)
        features = request.data.get("features", [])
        invalid = [f for f in features if f not in valid_codes]
        if invalid:
            return Response({"error": f"Unknown feature(s): {invalid}"}, status=status.HTTP_400_BAD_REQUEST)

        staff.feature_grants.all().delete()
        for f in features:
            StaffFeatureGrant.objects.create(staff=staff, feature=f, granted_by=request.user)

        return Response(StaffSerializer(staff).data)

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
