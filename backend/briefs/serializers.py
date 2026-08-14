from rest_framework import serializers
from .models import DailyBrief, BriefAction, ActionImpactCheck
 
 
class BriefActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BriefAction
        fields = ["id", "action_type", "title", "message", "reasoning", "discount_pct",
                  "related_menu", "related_ingredient", "rupiah_impact", "status", "acted_at"]


class DailyBriefSerializer(serializers.ModelSerializer):
    actions = BriefActionSerializer(many=True, read_only=True)

    class Meta:
        model = DailyBrief
        fields = ["id", "brief_date", "summary", "actions", "created_at"]


class ActionImpactCheckSerializer(serializers.ModelSerializer):
    action_title = serializers.CharField(source="action.title", read_only=True)
    action_message = serializers.CharField(source="action.message", read_only=True)
    action_type = serializers.CharField(source="action.action_type", read_only=True)

    class Meta:
        model = ActionImpactCheck
        fields = ["id", "action", "action_title", "action_message", "action_type",
                  "week_start", "followup_snapshot", "answer", "reasoning", "created_at"]