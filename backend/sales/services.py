"""Business logic for recording a sale: F4 deducts stock (F1) and snapshots
cost so profit (F3) can be computed later. Runs in a single transaction."""
from decimal import Decimal
from django.db import transaction
from inventory.models import StockMovement
from menus.models import Menu
from .models import Sale, SaleItem


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
        menu = Menu.objects.select_for_update().get(id=line["menu_id"], business=business)
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
