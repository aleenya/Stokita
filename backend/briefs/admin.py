from django.contrib import admin
from .models import DailyBrief, BriefAction


@admin.register(DailyBrief)
class DailyBriefAdmin(admin.ModelAdmin):
    list_display = ["brief_date", "business", "summary", "created_at"]


@admin.register(BriefAction)
class BriefActionAdmin(admin.ModelAdmin):
    list_display = ["brief", "action_type", "status", "rupiah_impact"]
