"""Business logic for recording a sale: F4 deducts stock (F1) and snapshots
cost so profit (F3) can be computed later. Runs in a single transaction."""
from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import F, DecimalField, ExpressionWrapper, Sum
from django.utils import timezone
from inventory.models import Ingredient, StockMovement
from menus.models import Menu
from .models import Sale, SaleItem


def classify_margin_state(margin_pct, target):
    """Shared F3 threshold logic — used by both /analytics/profit (sales)
    and the daily brief context builder (briefs), so they always agree."""
    if margin_pct >= target:
        return "high"
    if margin_pct >= target * 0.6:
        return "stable"
    return "low"


def compute_menu_profit_states(business, date_from=None, date_to=None):
    """F3: per-menu revenue/cost/margin, aggregated in ONE grouped query
    instead of one aggregate query per menu — used by both
    /analytics/profit (sales) and the daily brief context builder
    (briefs), which previously duplicated this as a per-menu N+1 loop."""
    items_qs = SaleItem.objects.filter(sale__business=business)
    if date_from:
        items_qs = items_qs.filter(sale__sale_date__gte=date_from)
    if date_to:
        items_qs = items_qs.filter(sale__sale_date__lte=date_to)

    agg_rows = items_qs.values("menu_id").annotate(
        revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=DecimalField())),
        cost=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=DecimalField())),
    )
    agg_by_menu = {row["menu_id"]: row for row in agg_rows}

    results = []
    for menu in Menu.objects.filter(business=business):
        agg = agg_by_menu.get(menu.id, {})
        revenue = agg.get("revenue") or 0
        cost = agg.get("cost") or 0
        if revenue:
            margin_pct = float((revenue - cost) / revenue * 100)
            state = classify_margin_state(margin_pct, float(menu.target_margin))
        else:
            # Belum pernah kejual — jangan dipaksa masuk skala high/stable/low,
            # itu bikin menu tanpa data ke-klaim "sehat" secara keliru.
            margin_pct = 0
            state = "no_data"
        results.append({
            "menu_id": str(menu.id),
            "name": menu.name,
            "margin_pct": round(margin_pct, 1),
            "state": state,
        })
    return results


def resolve_period_range(period, date_from=None, date_to=None):
    """Turns a period key (+ optional custom bounds) into a (start, end,
    prev_start, prev_end) tuple, where the previous range is the same
    length immediately before start — used to compute period-over-period
    trend for the Performance page."""
    today = timezone.localdate()
    if period == "today":
        start = end = today
    elif period == "7d":
        end = today
        start = today - timedelta(days=6)
    elif period == "30d":
        end = today
        start = today - timedelta(days=29)
    elif period == "custom":
        start = date.fromisoformat(date_from) if date_from else today - timedelta(days=6)
        end = date.fromisoformat(date_to) if date_to else today
    else:
        end = today
        start = today - timedelta(days=6)
    if end < start:
        start, end = end, start

    length = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return start, end, prev_start, prev_end


def _sale_items_qs(business, start, end, menu_id=None):
    qs = SaleItem.objects.filter(
        sale__business=business, sale__sale_date__gte=start, sale__sale_date__lte=end,
    )
    if menu_id:
        qs = qs.filter(menu_id=menu_id)
    return qs


def _aggregate_items(qs):
    r = qs.aggregate(
        revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=DecimalField())),
        cost=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=DecimalField())),
        volume=Sum("quantity"),
    )
    revenue = float(r["revenue"] or 0)
    cost = float(r["cost"] or 0)
    volume = int(r["volume"] or 0)
    return {"revenue": revenue, "cost": cost, "profit": revenue - cost, "volume": volume}


def compute_performance_overview(business, period, date_from=None, date_to=None, menu_id=None):
    """F3: totals + day-by-day series for the selected period, plus the
    same totals for the immediately preceding period of equal length so
    the frontend can show a trend %."""
    start, end, prev_start, prev_end = resolve_period_range(period, date_from, date_to)
    current = _aggregate_items(_sale_items_qs(business, start, end, menu_id))
    previous = _aggregate_items(_sale_items_qs(business, prev_start, prev_end, menu_id))

    daily_rows = (
        _sale_items_qs(business, start, end, menu_id)
        .values("sale__sale_date")
        .annotate(
            revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=DecimalField())),
            cost=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=DecimalField())),
            volume=Sum("quantity"),
        )
    )
    by_date = {row["sale__sale_date"]: row for row in daily_rows}

    daily_series = []
    cursor = start
    while cursor <= end:
        row = by_date.get(cursor)
        revenue = float(row["revenue"] or 0) if row else 0.0
        cost = float(row["cost"] or 0) if row else 0.0
        volume = int(row["volume"] or 0) if row else 0
        daily_series.append({
            "date": cursor.isoformat(), "revenue": revenue, "cost": cost,
            "profit": revenue - cost, "volume": volume,
        })
        cursor += timedelta(days=1)

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "previous_range": {"start": prev_start.isoformat(), "end": prev_end.isoformat()},
        "current": current,
        "previous": previous,
        "daily_series": daily_series,
    }


def compute_menu_breakdown(business, period, date_from=None, date_to=None, menu_id=None):
    """F3: per-menu qty/revenue/cost/margin for the period, plus each
    menu's revenue in the previous period (for a per-row trend %).
    Includes menus with zero sales in the period (qty/revenue 0), same
    as compute_menu_profit_states, so a menu doesn't just vanish from
    the table because it hasn't sold yet."""
    start, end, prev_start, prev_end = resolve_period_range(period, date_from, date_to)

    current_rows = (
        _sale_items_qs(business, start, end, menu_id)
        .values("menu_id")
        .annotate(
            qty=Sum("quantity"),
            revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=DecimalField())),
            cost=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=DecimalField())),
        )
    )
    current_by_menu = {row["menu_id"]: row for row in current_rows}

    prev_rows = (
        _sale_items_qs(business, prev_start, prev_end, menu_id)
        .values("menu_id")
        .annotate(revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=DecimalField())))
    )
    prev_revenue_by_menu = {row["menu_id"]: float(row["revenue"] or 0) for row in prev_rows}

    menus_qs = Menu.objects.filter(business=business)
    if menu_id:
        menus_qs = menus_qs.filter(id=menu_id)

    results = []
    for menu in menus_qs:
        row = current_by_menu.get(menu.id)
        qty = int(row["qty"] or 0) if row else 0
        revenue = float(row["revenue"] or 0) if row else 0.0
        cost = float(row["cost"] or 0) if row else 0.0
        if revenue > 0:
            margin_pct = round((revenue - cost) / revenue * 100, 1)
        else:
            # No sales this period — fall back to the recipe-based margin
            # (same idea as compute_menu_profit_states' "no_data" case)
            # instead of implying a 0-revenue menu is somehow 0% margin.
            recipe_cost = float(menu.unit_cost())
            sell_price = float(menu.sell_price)
            margin_pct = round((sell_price - recipe_cost) / sell_price * 100, 1) if sell_price else 0.0
        results.append({
            "menu_id": str(menu.id),
            "name": menu.name,
            "qty": qty,
            "revenue": revenue,
            "cost": cost,
            "margin_pct": margin_pct,
            "prev_revenue": prev_revenue_by_menu.get(menu.id, 0.0),
        })
    results.sort(key=lambda r: r["revenue"], reverse=True)

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "previous_range": {"start": prev_start.isoformat(), "end": prev_end.isoformat()},
        "menus": results,
    }


def compute_menu_compare(business, period, menu_a_id, menu_b_id, date_from=None, date_to=None):
    """F3: side-by-side current + previous period stats for two specific
    menus, for the Compare Menus view."""
    start, end, prev_start, prev_end = resolve_period_range(period, date_from, date_to)

    out = {}
    for key, mid in (("a", menu_a_id), ("b", menu_b_id)):
        menu = Menu.objects.filter(business=business, id=mid).first()
        if not menu:
            out[key] = None
            continue
        current = _aggregate_items(_sale_items_qs(business, start, end, mid))
        previous = _aggregate_items(_sale_items_qs(business, prev_start, prev_end, mid))
        margin_pct = round(current["profit"] / current["revenue"] * 100, 1) if current["revenue"] else 0.0
        out[key] = {
            "menu_id": str(menu.id), "name": menu.name,
            "current": current, "previous": previous, "margin_pct": margin_pct,
        }

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "previous_range": {"start": prev_start.isoformat(), "end": prev_end.isoformat()},
        "a": out["a"],
        "b": out["b"],
    }


class InsufficientStockError(Exception):
    def __init__(self, ingredient_name, available, required):
        self.ingredient_name = ingredient_name
        self.available = available
        self.required = required
        super().__init__(
            f"Stok '{ingredient_name}' gak cukup: tersedia {available}, butuh {required}"
        )

def _effective_unit_price(menu):
    if menu.active_discount_pct and menu.active_discount_ingredient_id:
        ing = menu.active_discount_ingredient
        expired = menu.active_discount_expiry_date and menu.active_discount_expiry_date < date.today()
        if ing.current_stock <= 0 or expired:
            menu.active_discount_pct = None
            menu.active_discount_ingredient = None
            menu.active_discount_expiry_date = None
            menu.save(update_fields=["active_discount_pct", "active_discount_ingredient", "active_discount_expiry_date"])
        else:
            return menu.sell_price * (1 - menu.active_discount_pct / 100)
    return menu.sell_price

@transaction.atomic
def record_sale(business, user, sale_date, items):
    """
    items = [{"menu_id": ..., "quantity": N}, ...]
    Creates the Sale + SaleItems, deducts ingredient stock per recipe,
    and writes stock movements. Returns the Sale.
    Raises InsufficientStockError (rolling back the whole sale) if any
    recipe ingredient doesn't have enough stock to cover the sale.
    """
    sale = Sale.objects.create(business=business, sale_date=sale_date, recorded_by=user)

    for line in items:
        menu = Menu.objects.select_for_update().get(
            id=line["menu_id"], business=business, is_active=True,
        )
        qty = int(line["quantity"])

        # snapshot price and cost at sale time
        SaleItem.objects.create(
            sale=sale, menu=menu, quantity=qty,
            unit_price=_effective_unit_price(menu), 
            unit_cost=menu.unit_cost(),
        )

        # deduct each recipe ingredient from stock (locked to avoid a
        # concurrent sale reading the same stock before this one commits)
        for recipe_line in menu.recipe_lines.select_related("ingredient").select_for_update():
            used = recipe_line.qty_per_serving * qty
            ingredient = recipe_line.ingredient
            if ingredient.current_stock < used:
                raise InsufficientStockError(
                    ingredient.name, ingredient.current_stock, used,
                )
            ingredient.current_stock -= used
            ingredient.save(update_fields=["current_stock"])
            StockMovement.objects.create(
                ingredient=ingredient, change_qty=-used,
                movement_type=StockMovement.SALE_DEDUCTION,
                related_sale=sale, created_by=user,
            )

    return sale


@transaction.atomic
def delete_sale(sale):
    """B7: deleting a sale must give back the stock it deducted, or a
    wrong/duplicate entry that gets removed leaves ingredients
    permanently short by that amount. StockMovement.related_sale is
    SET_NULL, so without this the movements would just survive orphaned
    and current_stock would never be corrected."""
    for movement in sale.stock_movements.all():
        ingredient = Ingredient.objects.select_for_update().get(pk=movement.ingredient_id)
        ingredient.current_stock -= movement.change_qty  # change_qty is negative for sale deductions, so this adds it back
        ingredient.save(update_fields=["current_stock"])
    sale.delete()
