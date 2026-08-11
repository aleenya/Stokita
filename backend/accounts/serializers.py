from rest_framework import serializers
from .models import Business, User


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ["id", "name", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "full_name", "role", "business"]

    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return obj.get_full_name()