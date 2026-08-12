from rest_framework.authentication import TokenAuthentication as _BaseTokenAuthentication


class TokenAuthentication(_BaseTokenAuthentication):
    """DRF's default only does select_related('user') when resolving a
    token, so every business-scoped view (nearly all of them — they all
    filter by request.user.business) pays a second DB round-trip just to
    fetch the business. Joining it here at auth time collapses that back
    into the single token-lookup query, on every authenticated request."""

    def authenticate_credentials(self, key):
        model = self.get_model()
        try:
            token = model.objects.select_related("user__business").get(key=key)
        except model.DoesNotExist:
            from rest_framework import exceptions
            raise exceptions.AuthenticationFailed("Invalid token.")

        if not token.user.is_active:
            from rest_framework import exceptions
            raise exceptions.AuthenticationFailed("User inactive or deleted.")

        return (token.user, token)
