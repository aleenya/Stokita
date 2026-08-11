from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Allows access only to users with the owner role."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_owner())