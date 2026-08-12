"""Business logic for stock changes (F1) — shared by the single-item restock
action and bulk-restock, so both get the same locking and cost averaging."""
from decimal import Decimal

from django.db import transaction

from .models import Ingredient, StockMovement


def apply_restock(ingredient, qty, total_cost=None, expiry_date=None, user=None):
    """
    Add qty to ingredient.current_stock, weighted-averaging total_cost (if
    given) into cost_per_unit first. Locks the row so two concurrent
    restocks can't clobber each other's update.
    """
    with transaction.atomic():
        ingredient = Ingredient.objects.select_for_update().get(pk=ingredient.pk)

        if total_cost and total_cost > 0:
            nilai_lama = ingredient.current_stock * ingredient.cost_per_unit
            ingredient.cost_per_unit = (nilai_lama + total_cost) / (ingredient.current_stock + qty)

        ingredient.current_stock += qty
        ingredient.save(update_fields=["current_stock", "cost_per_unit"])

        StockMovement.objects.create(
            ingredient=ingredient, change_qty=qty,
            movement_type=StockMovement.RESTOCK,
            expiry_date=expiry_date, created_by=user,
        )

    return ingredient


def apply_waste(ingredient, qty, user=None):
    """Write off qty as spoiled/wasted stock. Same locking as apply_restock."""
    with transaction.atomic():
        ingredient = Ingredient.objects.select_for_update().get(pk=ingredient.pk)

        if qty <= 0 or qty > ingredient.current_stock:
            raise ValueError("qty harus lebih dari 0 dan gak boleh lebih dari stok yang ada.")

        ingredient.current_stock -= qty
        ingredient.save(update_fields=["current_stock"])

        StockMovement.objects.create(
            ingredient=ingredient, change_qty=-qty,
            movement_type=StockMovement.ADJUSTMENT,
            created_by=user,
        )

    return ingredient
