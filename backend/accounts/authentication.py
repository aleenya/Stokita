from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings


class _CSRFCheck(CsrfViewMiddleware):
    """Same trick DRF's own SessionAuthentication uses internally to run
    Django's CSRF double-submit check outside of the middleware chain
    (DRF views are CSRF-exempt by default; enforcement is opt-in per
    authentication class)."""

    def _reject(self, request, reason):
        return reason


class CookieJWTAuthentication(JWTAuthentication):
    """Reads the access token from an httpOnly cookie instead of the
    Authorization header (django-rest-framework-simplejwt's default) —
    that's the point of moving off localStorage, raw tokens never touch
    JS. Enforces CSRF on unsafe methods since cookie auth (unlike bearer
    tokens in a header) is otherwise vulnerable to it."""

    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.ACCESS_COOKIE_NAME)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        self.enforce_csrf(request)
        return (self.get_user(validated_token), validated_token)

    def enforce_csrf(self, request):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return
        check = _CSRFCheck(get_response=lambda r: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")

    def get_user(self, validated_token):
        """Same as JWTAuthentication.get_user(), but select_related the
        business so business-scoped views (nearly all of them) don't pay
        a second DB round-trip for request.user.business."""
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError:
            raise InvalidToken("Token contained no recognizable user identification")

        try:
            user = self.user_model.objects.select_related("business").get(
                **{api_settings.USER_ID_FIELD: user_id}
            )
        except self.user_model.DoesNotExist:
            raise exceptions.AuthenticationFailed("User not found", code="user_not_found")

        if api_settings.CHECK_USER_IS_ACTIVE and not user.is_active:
            raise exceptions.AuthenticationFailed("User is inactive", code="user_inactive")

        return user
