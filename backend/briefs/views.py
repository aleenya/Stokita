from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import DailyBrief, BriefAction, ActionImpactCheck
from .serializers import DailyBriefSerializer, ActionImpactCheckSerializer
from .services import generate_daily_brief, mark_action_acted, generate_weekly_impact_checks
from .models import DailyBrief, BriefAction
from .serializers import DailyBriefSerializer
from .services import generate_daily_brief
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsOwner
 
 
class BriefViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsOwner]

    def _get_business(self):
        return self.request.user.business
 
    @action(detail=False, methods=["get"])
    def today(self, request):
        brief = DailyBrief.objects.filter(
            business=self._get_business(), brief_date=date.today()
        ).first()
        if not brief:
            return Response({"detail": "No brief yet. Generate one."}, status=404)
        return Response(DailyBriefSerializer(brief).data)
 
    @action(detail=False, methods=["post"])
    def generate(self, request):
        brief = generate_daily_brief(self._get_business())
        return Response(DailyBriefSerializer(brief).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="generate-weekly-impact")
    def generate_weekly_impact(self, request):
        """Tombol manual: jalanin pengecekan dampak mingguan sekarang juga."""
        checks = generate_weekly_impact_checks(self._get_business())
        return Response({
            "generated_count": len(checks),
            "results": ActionImpactCheckSerializer(checks, many=True).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="impact-history")
    def impact_history(self, request):
        """Buat tab Performance: semua hasil pengecekan, terbaru duluan."""
        checks = ActionImpactCheck.objects.filter(
            action__brief__business=self._get_business()
        ).select_related("action").order_by("-week_start")
        return Response(ActionImpactCheckSerializer(checks, many=True).data)

 
class BriefActionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsOwner]

    def partial_update(self, request, pk=None):
        try:
            act = BriefAction.objects.get(
                id=pk, brief__business=request.user.business)
        except BriefAction.DoesNotExist:
            return Response(status=404)

        new_status = request.data.get("status")
        if new_status == BriefAction.ACTED:
            act = mark_action_acted(act)  # <- nyimpen acted_at + baseline_snapshot otomatis
        elif new_status == BriefAction.DISMISSED:
            act.status = new_status
            act.save(update_fields=["status"])
        else:
            return Response({"error": "status harus 'acted' atau 'dismissed'"}, status=400)

        return Response({"status": act.status})
