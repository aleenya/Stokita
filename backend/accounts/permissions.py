from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Allows access only to users with the owner role."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_owner())

def feature_required(feature_code):
    """
    Owner selalu lolos. Staff cuma lolos kalau punya StaffFeatureGrant
    buat feature_code ini secara spesifik.
    """

    class _HasFeatureAccess(BasePermission):
        def has_permission(self, request, view):
            user = request.user
            if not (user and user.is_authenticated):
                return False
            if user.is_owner():
                return True
            return user.feature_grants.filter(feature=feature_code).exists()
    return _HasFeatureAccess