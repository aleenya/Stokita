from django.conf import settings


def set_auth_cookies(response, access, refresh=None):
    """Set the JWT access (and optionally refresh) token as httpOnly
    cookies. Never returned in the JSON body — that's the whole point of
    moving off localStorage, the token has to stay invisible to JS."""
    access_max_age = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie(
        settings.ACCESS_COOKIE_NAME,
        access,
        max_age=access_max_age,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
    )
    if refresh is not None:
        refresh_max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
        response.set_cookie(
            settings.REFRESH_COOKIE_NAME,
            refresh,
            max_age=refresh_max_age,
            httponly=True,
            secure=settings.AUTH_COOKIE_SECURE,
            samesite=settings.AUTH_COOKIE_SAMESITE,
            path="/",
        )
    return response


def clear_auth_cookies(response):
    response.delete_cookie(settings.ACCESS_COOKIE_NAME, path="/", samesite=settings.AUTH_COOKIE_SAMESITE)
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path="/", samesite=settings.AUTH_COOKIE_SAMESITE)
    return response
