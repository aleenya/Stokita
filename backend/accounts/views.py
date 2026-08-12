from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import StaffFeatureGrant, User
from .permissions import IsOwner
from .serializers import BusinessSerializer, RegisterSerializer, StaffSerializer, UserSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "token": token.key,
                "role": user.role,
                "is_active": user.is_active,
                "business": BusinessSerializer(user.business).data,
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


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

    @action(detail=True, methods=["patch"])
    def status(self, request, pk=None):
        """Nonaktifin/aktifin staff (soft-deactivate, bukan hard delete —
        biar history sale/stock movement yang dia catat tetep ke-atribusi).
        Nonaktif = is_active=False, otomatis nolak token auth dia."""
        try:
            staff = User.objects.get(id=pk, business=request.user.business, role=User.STAFF)
        except User.DoesNotExist:
            return Response(status=404)

        is_active = request.data.get("is_active")
        if not isinstance(is_active, bool):
            return Response({"error": "is_active harus boolean"}, status=status.HTTP_400_BAD_REQUEST)

        staff.is_active = is_active
        staff.save(update_fields=["is_active"])
        return Response(StaffSerializer(staff).data)