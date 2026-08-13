from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import DailyBrief, BriefAction, ActionImpactCheck
from .serializers import BriefActionSerializer, DailyBriefSerializer, ActionImpactCheckSerializer
from .services import (
    generate_daily_brief, mark_action_acted, generate_weekly_impact_checks,
    get_brief_cooldown_status, BriefCooldownError,
    get_impact_cooldown_status, ImpactCooldownError, NoEligibleActionsError,
)
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsOwner
from accounts.permissions import feature_required
 
 
class BriefViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, feature_required("brief")]

    def _get_business(self):
        return self.request.user.business
 
    @action(detail=False, methods=["get"])
    def today(self, request):
        """
        Balikin brief TERAKHIR yang ada (bukan lagi strict 'brief tanggal
        hari ini', karena generate sekarang gate-nya 24 jam rolling, bukan
        per tanggal kalender). Tambah can_generate_now / next_generate_at
        biar frontend bisa disable + kasih countdown di tombol generate.
        """
        business = self._get_business()
        brief = DailyBrief.objects.filter(business=business).order_by("-created_at").first()
        _, can_generate_now, next_available_at = get_brief_cooldown_status(business)

        if not brief:
            return Response({
                "detail": "Belum ada brief. Generate dulu satu.",
                "can_generate_now": can_generate_now,
                "next_generate_at": None,
            }, status=404)

        data = DailyBriefSerializer(brief).data
        data["can_generate_now"] = can_generate_now
        data["next_generate_at"] = next_available_at.isoformat() if next_available_at else None
        return Response(data)
 
    @action(detail=False, methods=["post"])
    def generate(self, request):
        """
        Generate brief baru. Kalau masih dalam cooldown 24 jam sejak brief
        terakhir dibuat, tolak dengan 429 + next_available_at — supaya
        frontend (dan siapapun yang hit endpoint ini langsung) gak bisa
        bypass batas 1x/24 jam cuma dengan disable tombol di client.
        """
        try:
            brief = generate_daily_brief(self._get_business())
        except BriefCooldownError as e:
            return Response({
                "detail": "Brief baru bisa digenerate lagi setelah 24 jam sejak generate terakhir.",
                "next_available_at": e.next_available_at.isoformat(),
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        return Response(DailyBriefSerializer(brief).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="generate-weekly-impact")
    def generate_weekly_impact(self, request):
        """Tombol manual: jalanin pengecekan dampak mingguan sekarang juga."""
        try:
            checks = generate_weekly_impact_checks(self._get_business())
        except ImpactCooldownError as e:
            return Response({
                "detail": "Impact summary baru bisa digenerate lagi setelah 3 hari.",
                "next_available_at": e.next_available_at.isoformat(),
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except NoEligibleActionsError as e:
            return Response({
                "detail": str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "generated_count": len(checks),
            "results": ActionImpactCheckSerializer(checks, many=True).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="impact-history")
    def impact_history(self, request):
        """Buat tab Performance: semua hasil pengecekan, terbaru duluan."""
        business = self._get_business()
        checks = ActionImpactCheck.objects.filter(
            action__brief__business=business,
        ).select_related("action").order_by("-week_start")

        _, can_generate_now, next_available_at = get_impact_cooldown_status(business)

        return Response({
            "results": ActionImpactCheckSerializer(checks, many=True).data,
            "can_generate_now": can_generate_now,
            "next_generate_at": next_available_at.isoformat() if next_available_at else None,
        })

 
class BriefActionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, feature_required("brief")]
    def list(self, request):
        """History: semua action ber-status 'acted', lintas semua brief,
        terbaru duluan. Dipakai Dashboard buat panel Action History."""
        acted = BriefAction.objects.filter(
            brief__business=request.user.business, status=BriefAction.ACTED,
        ).order_by("-acted_at")[:50]
        return Response(BriefActionSerializer(acted, many=True).data)
    
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