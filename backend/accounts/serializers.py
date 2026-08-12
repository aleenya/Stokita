from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from .models import Business, User

UserModel = get_user_model()


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ["id", "name", "username", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "full_name", "role", "business"]

    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return obj.get_full_name()

class StaffSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    granted_features = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "role", "granted_features"]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_granted_features(self, obj):
        return list(obj.feature_grants.values_list("feature", flat=True))
