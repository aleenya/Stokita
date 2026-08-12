import secrets
import string

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from .models import Business, User

UserModel = get_user_model()

_SLUG_ALPHABET = string.ascii_lowercase + string.digits
_SLUG_SUFFIX_LEN = 6


def _random_business_slug(base):
    """base + random suffix so the join code can't be guessed from the
    business name — it's shared like an invite code, not a public handle."""
    suffix = "".join(secrets.choice(_SLUG_ALPHABET) for _ in range(_SLUG_SUFFIX_LEN))
    return f"{base}-{suffix}"


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
    username = serializers.CharField(max_length=150)  # login username si user
    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(required=False, allow_blank=True, max_length=150)

    # Dipake kalau role == owner
    business_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    # Dipake di DUA konteks beda tergantung role:
    # - owner: slug custom (opsional, auto-generate dari business_name kalau kosong)
    # - staff: kode business yang mau di-join (wajib)
    business_username = serializers.CharField(required=False, allow_blank=True, max_length=50)

    def validate_username(self, value):
        if UserModel.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username ini sudah dipakai, coba yang lain.")
        return value

    def validate(self, data):
        role = data.get("role")

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
        password = validated_data["password"]
        full_name = validated_data.get("full_name", "").strip()

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
        user.set_password(password)
        user.save()

        return user