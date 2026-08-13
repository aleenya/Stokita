import re
import secrets
import string

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from .google_auth import verify_google_token
from .models import Business, User

UserModel = get_user_model()

_SLUG_ALPHABET = string.ascii_lowercase + string.digits
_SLUG_SUFFIX_LEN = 6


def _random_business_slug(base):
    """base + random suffix so the join code can't be guessed from the
    business name — it's shared like an invite code, not a public handle."""
    suffix = "".join(secrets.choice(_SLUG_ALPHABET) for _ in range(_SLUG_SUFFIX_LEN))
    return f"{base}-{suffix}"


def _generate_username(seed):
    """Turn a Google email/name into a free username — register-via-Google
    doesn't collect one from the user, so we make one up and dedupe it."""
    base = re.sub(r"[^a-z0-9]", "", (seed or "user").lower())[:20] or "user"
    for _ in range(5):
        candidate = base + "".join(secrets.choice(_SLUG_ALPHABET) for _ in range(4))
        if not UserModel.objects.filter(username=candidate).exists():
            return candidate
    raise serializers.ValidationError({"username": "Gagal generate username, coba lagi."})


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ["id", "name", "username", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "full_name", "role", "business", "business_username"]

    full_name = serializers.SerializerMethodField()
    business_username = serializers.CharField(source="business.username", read_only=True)

    def get_full_name(self, obj):
        return obj.get_full_name()


class StaffSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    granted_features = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "role", "granted_features", "is_active", "last_login"]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_granted_features(self, obj):
        # .all() (not .values_list()) so this reuses the
        # prefetch_related('feature_grants') cache from StaffViewSet.list()
        # instead of firing a fresh query per staff row.
        return [g.feature for g in obj.feature_grants.all()]


class RegisterSerializer(serializers.Serializer):
    """
    Satu endpoint, dua alur:
    - role="owner": bikin Business baru sekaligus, owner nentuin nama +
      (opsional) slug custom buat username business.
    - role="staff": join ke Business yang UDAH ADA lewat business_username
      (kode yang dikasih owner). Kalau kodenya gak ketemu, error jelas.

    Validasi dilakuin pas submit (bukan real-time), sesuai keputusan tim.
    """

    ROLE_CHOICES = (("owner", "Owner"), ("staff", "Staff"))

    role = serializers.ChoiceField(choices=ROLE_CHOICES)
    # username/password: required for the normal path, unused for the
    # Google path (username gets generated, password gets set unusable).
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    # Register-via-Google: an ID token from GoogleSignInButton. Role +
    # business still have to be picked normally — Google only supplies
    # identity, not "which business is this."
    google_credential = serializers.CharField(required=False, allow_blank=True, write_only=True)
    full_name = serializers.CharField(required=False, allow_blank=True, max_length=150)

    # Dipake kalau role == owner
    business_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    # Dipake di DUA konteks beda tergantung role:
    # - owner: slug custom (opsional, auto-generate dari business_name kalau kosong)
    # - staff: kode business yang mau di-join (wajib)
    business_username = serializers.CharField(required=False, allow_blank=True, max_length=50)

    def validate(self, data):
        role = data.get("role")
        google_credential = data.get("google_credential")

        if google_credential:
            try:
                info = verify_google_token(google_credential)
            except ValueError:
                raise serializers.ValidationError({"google_credential": "Token Google gak valid."})
            if User.objects.filter(google_sub=info["sub"]).exists():
                raise serializers.ValidationError(
                    {"google_credential": "Akun Google ini udah terdaftar. Coba login."}
                )
            data["_google_info"] = info

            username = data.get("username", "").strip()
            if username:
                if UserModel.objects.filter(username=username).exists():
                    raise serializers.ValidationError({"username": "Username ini sudah dipakai, coba yang lain."})
                data["username"] = username
            else:
                seed = (info.get("email") or "").split("@")[0] or info.get("name") or "user"
                data["username"] = _generate_username(seed)
            if not data.get("full_name") and info.get("name"):
                data["full_name"] = info["name"]
        else:
            username = data.get("username", "").strip()
            if not username:
                raise serializers.ValidationError({"username": "Username wajib diisi."})
            if UserModel.objects.filter(username=username).exists():
                raise serializers.ValidationError({"username": "Username ini sudah dipakai, coba yang lain."})
            data["username"] = username
            if not data.get("password") or len(data["password"]) < 6:
                raise serializers.ValidationError({"password": "Password minimal 6 karakter."})

        if role == "owner":
            business_name = data.get("business_name", "").strip()
            if not business_name:
                raise serializers.ValidationError(
                    {"business_name": "Nama business wajib diisi."}
                )

            raw_slug = data.get("business_username", "").strip() or business_name
            # Truncate base so base + "-" + suffix still fits the 50-char SlugField.
            base = slugify(raw_slug)[: 50 - 1 - _SLUG_SUFFIX_LEN]
            if not base:
                raise serializers.ValidationError(
                    {"business_username": "Username business tidak valid, coba nama lain."}
                )

            for _ in range(5):
                slug = _random_business_slug(base)
                if not Business.objects.filter(username=slug).exists():
                    break
            else:
                raise serializers.ValidationError(
                    {"business_username": "Gagal generate kode unik, coba submit ulang."}
                )

            data["business_name"] = business_name
            data["business_username"] = slug

        elif role == "staff":
            code = data.get("business_username", "").strip()
            if not code:
                raise serializers.ValidationError(
                    {"business_username": "Masukkan kode business dari owner kamu."}
                )
            slug = slugify(code)
            business = Business.objects.filter(username=slug).first()
            if not business:
                raise serializers.ValidationError(
                    {"business_username": "Business dengan kode ini tidak ditemukan. Cek lagi kode dari owner kamu."}
                )
            data["_business_instance"] = business

        return data

    def create(self, validated_data):
        role = validated_data["role"]
        username = validated_data["username"]
        full_name = validated_data.get("full_name", "").strip()
        google_info = validated_data.get("_google_info")

        if role == "owner":
            business = Business.objects.create(
                name=validated_data["business_name"],
                username=validated_data["business_username"],
            )
        else:
            business = validated_data["_business_instance"]

        user = User(username=username, role=role, business=business)
        if full_name:
            user.first_name = full_name
        if role == "staff":
            # Staff self-registers with just the business join code — require
            # owner approval (via PeoplePage "Aktifkan") before they get access.
            user.is_active = False

        if google_info:
            user.google_sub = google_info["sub"]
            if google_info.get("email"):
                user.email = google_info["email"]
            # No password was ever collected — this account only ever signs
            # in via Google. Django supports this natively (this isn't a
            # blank/guessable password, authenticate() always rejects it).
            user.set_unusable_password()
        else:
            user.set_password(validated_data["password"])
        user.save()

        return user