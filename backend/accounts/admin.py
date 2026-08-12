from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Business, User, StaffFeatureGrant


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ["name", "created_at"]


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Stokita", {"fields": ("business", "role")}),
    )
    list_display = ["username", "email", "business", "role", "is_staff"]

@admin.register(StaffFeatureGrant)
class StaffFeatureGrantAdmin(admin.ModelAdmin):
    list_display = ["staff", "feature", "granted_by", "granted_at"]


