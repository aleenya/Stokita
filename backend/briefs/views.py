from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
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
 
 
class BriefActionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsOwner]

    def partial_update(self, request, pk=None):
        try:
            act = BriefAction.objects.get(
                id=pk, brief__business=request.user.business)
        except BriefAction.DoesNotExist:
            return Response(status=404)
        new_status = request.data.get("status")
        if new_status in (BriefAction.ACTED, BriefAction.DISMISSED):
            act.status = new_status
            act.save(update_fields=["status"])
        return Response({"status": act.status})
