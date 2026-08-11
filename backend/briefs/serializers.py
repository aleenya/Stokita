from rest_framework import serializers
from .models import DailyBrief, BriefAction
 
 
class BriefActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BriefAction
        fields = ["id", "action_type", "message", "related_menu",
                  "related_ingredient", "rupiah_impact", "status"]
 
 
class DailyBriefSerializer(serializers.ModelSerializer):
    actions = BriefActionSerializer(many=True, read_only=True)
 
    class Meta:
        model = DailyBrief
        fields = ["id", "brief_date", "summary", "actions", "created_at"]
