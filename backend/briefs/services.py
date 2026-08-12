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

BRIEF_COOLDOWN = timedelta(hours=24)


class BriefCooldownError(Exception):
    """Raised when owner tries to generate before the 24h cooldown is over."""
    def __init__(self, next_available_at):
        self.next_available_at = next_available_at
        super().__init__(f"Brief masih cooldown sampai {next_available_at.isoformat()}")


def get_brief_cooldown_status(business):
    """
    Return (last_brief_or_None, can_generate_now: bool, next_available_at_or_None).
    Dipakai baik oleh generate_daily_brief() maupun GET /briefs/today
    (buat nampilin status tombol generate di frontend).
    """
    last = DailyBrief.objects.filter(business=business).order_by("-created_at").first()
    if not last:
        return None, True, None

    next_available_at = last.created_at + BRIEF_COOLDOWN
    if timezone.now() >= next_available_at:
        return last, True, None
    return last, False, next_available_at


def _build_pricing_context(business):
    """
    Context buat AI — SENGAJA cuma soal harga. Ingredients & stock
    threshold TIDAK dikirim ke sini; itu domain inventory app (live
    endpoint), gak masuk brief ini.
    """
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

    return {"profit": profit, "expiring_soon": expiring_soon}


def generate_daily_brief(business):
    """
    Generate brief baru. TIDAK ADA lagi 'force' atau get_or_create by date —
    satu-satunya gate adalah cooldown 24 jam berbasis timestamp
    (lihat get_brief_cooldown_status). Kalau masih dalam cooldown,
    raise BriefCooldownError; caller (view) yang tangani jadi HTTP 429.

    Brief ini SEKARANG CUMA berisi rekomendasi HARGA (discount/review_menu).
    Restock & expiry alert TIDAK lagi bagian dari brief — itu status stok
    real-time, dilayani inventory app lewat endpoint sendiri yang selalu
    fresh (GET /ingredients/low-stock/, GET /ingredients/expiring/),
    gak kena cooldown 24 jam, dan gak checklist-able seperti actions di sini.
    """
    last, can_generate, next_available_at = get_brief_cooldown_status(business)
    if not can_generate:
        raise BriefCooldownError(next_available_at)

    brief = DailyBrief.objects.create(business=business, brief_date=date.today())

    actions = generate_recommendations(_build_pricing_context(business))

    for a in actions:
        BriefAction.objects.create(
            brief=brief,
            action_type=a["action_type"],
            title=a["title"],
            message=a["message"],
            discount_pct=a.get("discount_pct"),
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
    """
    Dipanggil pas user checklist action di brief (status -> acted).

    TODO (nunggu file menus/models.py & sales creation logic): kalau
    action.action_type == "discount", di sini juga harus ngaktifin
    diskon di Menu terkait (action.related_menu, action.discount_pct),
    dengan kondisi mati "stok 0 ATAU expired, mana yg duluan" — belum
    diimplement karena butuh liat struktur Menu & kode POST /sales dulu.
    """
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