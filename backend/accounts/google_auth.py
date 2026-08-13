"""Verifies a Google Identity Services ID token server-side. Used by both
GoogleLoginView (match an existing account) and GoogleLinkView (attach a
Google identity to the currently logged-in account) in accounts/views.py."""
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from django.conf import settings


def verify_google_token(credential):
    """Returns {'sub': str, 'email': str|None, 'name': str|None}.
    Raises ValueError if the token is missing, expired, or wasn't issued
    for this app's GOOGLE_CLIENT_ID."""
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID belum diset.")
    idinfo = id_token.verify_oauth2_token(
        credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
    )
    return {
        "sub": idinfo["sub"],
        "email": idinfo.get("email"),
        "name": idinfo.get("name"),
    }
