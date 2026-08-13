"""Verifies a Google Identity Services ID token server-side. Used by both
GoogleLoginView (match an existing account) and GoogleLinkView (attach a
Google identity to the currently logged-in account) in accounts/views.py."""
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from django.conf import settings


def verify_google_token(credential):
    """Returns {'sub': str, 'email': str|None, 'name': str|None}.
    Raises ValueError for any failure — bad/expired/wrong-audience token,
    or a network hiccup fetching Google's public certs (that one surfaces
    as google.auth.exceptions.TransportError, not a ValueError, from the
    library itself). Normalized to one type here so every caller only
    needs one except clause instead of each guessing which exception
    types verify_oauth2_token can raise."""
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID belum diset.")
    try:
        idinfo = id_token.verify_oauth2_token(
            credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except Exception as e:
        raise ValueError(str(e)) from e
    return {
        "sub": idinfo["sub"],
        "email": idinfo.get("email"),
        "name": idinfo.get("name"),
    }
