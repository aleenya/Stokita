"""F6: build the day's brief from current data, using F5's recommendation engine."""
from datetime import date, timedelta

from django.db.models import F, DecimalField, ExpressionWrapper, Sum
from inventory.models import Ingredient, StockMovement
from menus.models import Menu
from sales.models import SaleItem
from sales.services import classify_margin_state
from .models import DailyBrief, BriefAction, ActionImpactCheck
from .ai import generate_recommendations, analyze_impact
from django.utils import timezone

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
            "state": classify_margin_state(margin_pct, float(menu.target_margin)),
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


def generate_daily_brief(business, brief_date=None, force=False):
    """
    Generate (or return existing) brief for the day.

    Kalau brief hari ini SUDAH ada dan force=False, langsung return brief
    yang ada tanpa manggil AI lagi — jadi tombol "Generate" di empty state
    aman diklik berkali-kali (misal double-click) tanpa boros API call.

    force=True (dari tombol "Regenerate" manual) selalu bikin ulang.
    """
    brief_date = brief_date or date.today()
    brief, created = DailyBrief.objects.get_or_create(business=business, brief_date=brief_date)

    if not created and not force:
        return brief  # udah ada hari ini, gak usah panggil AI lagi

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


def _get_week_start(d=None):
    d = d or date.today()
    return d - timedelta(days=d.weekday())  # Senin dari minggu ini


def _capture_snapshot(action):
    """
    Agregat 7 hari terakhir, relevan sama tipe action-nya.
    Dipakai baik buat baseline (pas acted) maupun follow-up (pas dicek).
    """
    window_start = timezone.now() - timedelta(days=7)
    snapshot = {"captured_at": timezone.now().isoformat()}

    if action.related_menu_id:
        items = SaleItem.objects.filter(
            menu_id=action.related_menu_id,
            sale__business=action.brief.business,
            sale__created_at__gte=window_start,
        )
        agg = items.aggregate(
            revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=DecimalField())),
            cost=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=DecimalField())),
            qty=Sum("quantity"),
        )
        revenue = float(agg["revenue"] or 0)
        cost = float(agg["cost"] or 0)
        snapshot.update({
            "menu_revenue_7d": revenue,
            "menu_cost_7d": cost,
            "menu_margin_pct_7d": round((revenue - cost) / revenue * 100, 1) if revenue else 0,
            "menu_qty_sold_7d": float(agg["qty"] or 0),
        })

    if action.related_ingredient_id:
        ing = Ingredient.objects.filter(id=action.related_ingredient_id).first()
        if ing:
            snapshot["ingredient_current_stock"] = float(ing.current_stock)

    return snapshot


def mark_action_acted(action):
    """Dipanggil pas user centang aksi di brief (status -> acted)."""
    action.status = BriefAction.ACTED
    action.acted_at = timezone.now()
    action.baseline_snapshot = _capture_snapshot(action)
    action.save(update_fields=["status", "acted_at", "baseline_snapshot"])
    return action


def generate_weekly_impact_checks(business, week_start=None, force=False):
    """
    Jalanin pengecekan dampak buat semua acted action milik `business`
    yang di-acted dalam 30 hari terakhir dan belum dicek di minggu ini.

    force=True dipakai buat tombol manual demo — tetep hormatin
    unique_together (gak generate ulang kalau udah ada di minggu ini,
    kecuali kamu mau override itu juga, tapi defaultnya kita cegah
    double-generate).

    Return list of ActionImpactCheck yang baru dibuat.
    """
    week_start = week_start or _get_week_start()
    cutoff = timezone.now() - timedelta(days=30)

    eligible_actions = BriefAction.objects.filter(
        brief__business=business,
        status=BriefAction.ACTED,
        acted_at__isnull=False,
        acted_at__gte=cutoff,
        baseline_snapshot__isnull=False,
    ).exclude(
        impact_checks__week_start=week_start,  # udah pernah dicek minggu ini, skip
    )

    created = []
    for act in eligible_actions:
        followup = _capture_snapshot(act)

        concurrent = BriefAction.objects.filter(
            brief__business=business, status=BriefAction.ACTED,
            acted_at__gte=act.acted_at,
        ).exclude(id=act.id).values_list("message", flat=True)[:5]
        other_context = "; ".join(concurrent)

        result = analyze_impact(act.message, act.baseline_snapshot, followup, other_context)
        if result is None:
            continue  # skip action ini, lanjut ke action berikutnya, jangan gagalin semua batch

        check, _ = ActionImpactCheck.objects.get_or_create(
            action=act, week_start=week_start,
            defaults={
                "followup_snapshot": followup,
                "answer": result["answer"],
                "reasoning": result["reasoning"],
            },
        )
        created.append(check)

    return created