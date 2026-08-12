from django.db.models import Sum, F, DecimalField, ExpressionWrapper
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from menus.models import Menu
from .models import Sale, SaleItem
from .serializers import SaleSerializer
from .services import record_sale
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsOwner
from accounts.permissions import feature_required
 
 
class SaleViewSet(viewsets.ModelViewSet):
    serializer_class = SaleSerializer
 
    def get_queryset(self):
        qs = Sale.objects.filter(business=self.request.user.business)
        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(sale_date=date)
        return qs
 
    def create(self, request):
        sale = record_sale(
            business=request.user.business,
            user=request.user,
            sale_date=request.data["sale_date"],
            items=request.data["items"],
        )
        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)
 
 
class ProfitAnalyticsViewSet(viewsets.ViewSet):
    """F3: per-menu profit and health classification."""
    permission_classes = [IsAuthenticated, feature_required("profit_analytics")]

    def _classify(self, margin_pct, target):
        # thresholds are initial configurable rules, not fixed standards
        if margin_pct >= target:
            return "high"
        if margin_pct >= target * 0.6:
            return "stable"
        return "worrying"
 
    def list(self, request):
        business = request.user.business
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
 
        results = []
        for menu in Menu.objects.filter(business=business):
            items = SaleItem.objects.filter(menu=menu, sale__business=business)
            if date_from:
                items = items.filter(sale__sale_date__gte=date_from)
            if date_to:
                items = items.filter(sale__sale_date__lte=date_to)
 
            agg = items.aggregate(
                revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"),
                            output_field=DecimalField())),
                cost=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"),
                         output_field=DecimalField())),
            )
            revenue = agg["revenue"] or 0
            cost = agg["cost"] or 0
            margin_pct = float((revenue - cost) / revenue * 100) if revenue else 0
            results.append({
                "menu_id": str(menu.id),
                "name": menu.name,
                "margin_pct": round(margin_pct, 1),
                "state": self._classify(margin_pct, float(menu.target_margin)),
            })
        return Response({"menus": results})
