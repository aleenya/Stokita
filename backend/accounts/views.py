from django.contrib.auth import authenticate
from django.middleware.csrf import get_token
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from django.conf import settings
from .cookies import clear_auth_cookies, set_auth_cookies
from .google_auth import verify_google_token
from .models import StaffFeatureGrant, User
from .permissions import IsOwner
from .serializers import BusinessSerializer, RegisterSerializer, StaffSerializer, UserSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # public endpoint — don't try to validate a cookie that may not exist

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        body = {
            "role": user.role,
            "is_active": user.is_active,
            "business": BusinessSerializer(user.business).data,
        }
        response = Response(body, status=status.HTTP_201_CREATED)

        # Staff self-registration starts inactive (owner approval required
        # — see RegisterSerializer.create) — no session for them to log
        # into yet, so no cookies to set.
        if not user.is_active:
            return response

        refresh = RefreshToken.for_user(user)
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


class CsrfCookieView(APIView):
    """SPA calls this once on load. Also returns the token value in the
    body — the frontend/backend are on different top-level domains in
    production (www.stokita.app vs the Vercel backend domain), and
    document.cookie can only ever read a cookie set by the page's own
    origin. axios's cookie-reading CSRF echo (xsrfCookieName) silently
    finds nothing there, so every mutating request loses its
    X-CSRFToken header — the cookie itself still round-trips fine
    (SameSite=None), it's just unreadable to JS on the frontend's
    origin. Handing the same value back in the body lets the frontend
    hold it in memory and set the header itself, sidestepping the
    cross-origin cookie-read entirely without weakening the check
    (server still compares this exact value against the cookie)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        token = get_token(request)
        return Response({"csrftoken": token})


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(request, username=username, password=password)
        if user is None:
            # Deliberately generic — Django's ModelBackend already refuses
            # inactive users here too, so this covers both "wrong password"
            # and "not approved yet / deactivated" without leaking which.
            return Response({"error": "Username atau password salah."}, status=status.HTTP_401_UNAUTHORIZED)

        body = {"role": user.role, "business": BusinessSerializer(user.business).data}
        response = Response(body, status=status.HTTP_200_OK)

        refresh = RefreshToken.for_user(user)
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


class GoogleLoginView(APIView):
    """Sign in with an already-linked Google account — see GoogleLinkView.
    Deliberately doesn't auto-create accounts: this app's registration flow
    needs a role + business (or a join code), which a bare Google identity
    doesn't carry."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        credential = request.data.get("credential")
        if not credential:
            return Response({"error": "credential wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            info = verify_google_token(credential)
        except ValueError:
            return Response({"error": "Token Google tidak valid."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(google_sub=info["sub"]).first()
        if user is None:
            return Response(
                {"error": "Akun Google ini belum terhubung ke Stokita. Login manual dulu, "
                          "lalu hubungkan Google dari menu akun."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not user.is_active:
            return Response({"error": "Akun ini belum aktif."}, status=status.HTTP_401_UNAUTHORIZED)

        body = {"role": user.role, "business": BusinessSerializer(user.business).data}
        response = Response(body, status=status.HTTP_200_OK)

        refresh = RefreshToken.for_user(user)
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


class GoogleLinkView(APIView):
    """Attach a Google identity to the currently logged-in account, so
    GoogleLoginView has something to match later. Default cookie auth
    applies (IsAuthenticated + CSRF enforced), same as any other mutating
    endpoint."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        credential = request.data.get("credential")
        if not credential:
            return Response({"error": "credential wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            info = verify_google_token(credential)
        except ValueError:
            return Response({"error": "Token Google tidak valid."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(google_sub=info["sub"]).exclude(pk=request.user.pk).exists():
            return Response(
                {"error": "Akun Google ini udah terhubung ke user lain."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.google_sub = info["sub"]
        if info.get("email"):
            request.user.email = info["email"]
        request.user.save(update_fields=["google_sub", "email"])
        return Response({"linked": True, "email": request.user.email})


class LogoutView(APIView):
    """AllowAny on purpose: the access token may already be expired by the
    time someone logs out, but the refresh cookie (what actually needs
    revoking) can still be valid — this shouldn't require a fresh access
    token to work."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass  # already invalid/expired/blacklisted — fine, still clear cookies

        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw_refresh:
            return Response({"error": "Refresh token tidak ditemukan."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={"refresh": raw_refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            response = Response({"error": "Sesi udah habis, silakan login lagi."}, status=status.HTTP_401_UNAUTHORIZED)
            clear_auth_cookies(response)
            return response

        # With ROTATE_REFRESH_TOKENS on, validated_data also contains a new
        # "refresh" (and the old one gets blacklisted automatically).
        access = serializer.validated_data["access"]
        new_refresh = serializer.validated_data.get("refresh")

        response = Response(status=status.HTTP_204_NO_CONTENT)
        set_auth_cookies(response, access, new_refresh)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class StaffViewSet(viewsets.ViewSet):
    """People management — sengaja tetep IsOwner (bukan feature_required),
    biar staff yang di-grant nggak bisa ngasih grant ke diri sendiri/orang lain."""
    permission_classes = [IsAuthenticated, IsOwner]

    def list(self, request):
        staff = User.objects.filter(
            business=request.user.business, role=User.STAFF
        ).prefetch_related("feature_grants")
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
            return Response({"error": f"Fitur gak dikenal: {invalid}"}, status=status.HTTP_400_BAD_REQUEST)

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