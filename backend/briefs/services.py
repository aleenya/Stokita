"""F6: build the day's brief from current data, using F5's recommendation engine."""
from datetime import date, timedelta
from django.db.models import F, DecimalField, ExpressionWrapper, Sum
from inventory.models import Ingredient, StockMovement
from menus.models import Menu
from sales.views import ProfitAnalyticsViewSet
from sales.models import SaleItem
from .models import DailyBrief, BriefAction
from .ai import generate_recommendations
 
def _classify(margin_pct, target):
    """Same thresholds as sales.views.ProfitAnalyticsViewSet._classify."""
    if margin_pct >= target:
        return "high"
    if margin_pct >= target * 0.6:
        return "stable"
    return "low"
 
def _build_context(business):
    # ingredients snapshot
    ingredients = [{
        "id": str(i.id), "name": i.name, "unit": i.unit,
        "current_stock": float(i.current_stock),
        "low_stock_threshold": float(i.low_stock_threshold) if i.low_stock_threshold else None,
    } for i in Ingredient.objects.filter(business=business)]
 
    # profit states (reuse F3 logic)
    profit = []
    for menu in Menu.objects.filter(business=business):
        items = SaleItem.objects.filter(menu=menu, sale__business=business)
        agg = items.aggregate(
            revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"),
                        output_field=DecimalField())),
            cost=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"),
                     output_field=DecimalField())),
        )
        revenue = agg["revenue"] or 0
        cost = agg["cost"] or 0
        margin_pct = float((revenue - cost) / revenue * 100) if revenue else 0
        profit.append({
            "menu_id": str(menu.id),
            "name": menu.name,
            "margin_pct": round(margin_pct, 1),
            "state": _classify(margin_pct, float(menu.target_margin)),
        })
 
    # expiring soon (within 3 days)
    soon = date.today() + timedelta(days=3)
    expiring = StockMovement.objects.filter(
        ingredient__business=business, expiry_date__lte=soon,
        expiry_date__isnull=False, movement_type=StockMovement.RESTOCK,
    ).select_related("ingredient")
    expiring_soon = [{
        "id": str(m.ingredient.id), "name": m.ingredient.name,
    } for m in expiring]
 
    return {"ingredients": ingredients, "profit": profit, "expiring_soon": expiring_soon}
 
 
def generate_daily_brief(business, brief_date=None):
    brief_date = brief_date or date.today()
    brief, _ = DailyBrief.objects.get_or_create(business=business, brief_date=brief_date)
    brief.actions.all().delete()
 
    context = _build_context(business)
    actions = generate_recommendations(context)
 
    for a in actions:
        BriefAction.objects.create(
            brief=brief,
            action_type=a["action_type"],
            message=a["message"],
            related_menu_id=a.get("related_menu_id"),
            related_ingredient_id=a.get("related_ingredient_id"),
            rupiah_impact=a.get("rupiah_impact", 0),
        )
 
    brief.summary = f"{len(actions)} actions to protect margin today"
    brief.save(update_fields=["summary"])
    return brief
