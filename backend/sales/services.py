"""Business logic for recording a sale: F4 deducts stock (F1) and snapshots
cost so profit (F3) can be computed later. Runs in a single transaction."""
from decimal import Decimal
from django.db import transaction
from django.db.models import F, DecimalField, ExpressionWrapper, Sum
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


class InsufficientStockError(Exception):
    def __init__(self, ingredient_name, available, required):
        self.ingredient_name = ingredient_name
        self.available = available
        self.required = required
        super().__init__(
            f"Stok '{ingredient_name}' gak cukup: tersedia {available}, butuh {required}"
        )


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
            unit_price=menu.sell_price, unit_cost=menu.unit_cost(),
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
