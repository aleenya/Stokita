"""Seeds a full, realistic demo dataset (business, users, ingredients, menus
with recipes, and ~6 weeks of sales history) for product showcase purposes.

Usage:
    python manage.py seed_demo_data              # create (fails if it already exists)
    python manage.py seed_demo_data --reset       # wipe the demo business and recreate it
    python manage.py seed_demo_data --days 60     # longer sales history

Everything is scoped to ONE Business (slug "warung-demo") so it never
touches real data, and --reset only ever deletes that one business
(cascades to its users/ingredients/menus/sales via FK on_delete=CASCADE).
"""
import random
from contextlib import contextmanager
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone as djtimezone

from accounts.models import Business, StaffFeatureGrant, User
from inventory.models import Ingredient, StockMovement
from menus.models import Menu, MenuRecipe
from sales.models import Sale, SaleItem

BUSINESS_SLUG = "warung-demo"

INGREDIENTS = [
    # name, unit, cost_per_unit, low_stock_threshold
    ("Beras", "kg", 13000, 5),
    ("Minyak Goreng", "liter", 17000, 3),
    ("Ayam Fillet", "kg", 38000, 3),
    ("Telur", "kg", 28000, 2),
    ("Bawang Merah", "kg", 32000, 1),
    ("Bawang Putih", "kg", 30000, 1),
    ("Cabai Rawit", "kg", 55000, 1),
    ("Kecap Manis", "liter", 24000, 1),
    ("Tahu", "pcs", 800, 20),
    ("Tempe", "pcs", 900, 20),
    ("Mie Telur", "kg", 19000, 2),
    ("Sawi Hijau", "kg", 9000, 2),
    ("Gula Pasir", "kg", 15000, 2),
    ("Teh Celup", "pcs", 300, 30),
    ("Jeruk Nipis", "kg", 16000, 1),
    ("Es Batu", "kg", 3000, 5),
]

# name, sell_price, target_margin, popularity weight, recipe {ingredient: qty_per_serving}
MENUS = [
    ("Nasi Goreng Spesial", 22000, 55, 22, {
        "Beras": "0.2", "Minyak Goreng": "0.03", "Ayam Fillet": "0.07", "Telur": "0.06",
        "Bawang Merah": "0.015", "Bawang Putih": "0.01", "Kecap Manis": "0.02",
        "Cabai Rawit": "0.008", "Sawi Hijau": "0.03",
    }),
    ("Ayam Geprek Sambal Bawang", 20000, 50, 25, {
        "Ayam Fillet": "0.16", "Minyak Goreng": "0.05", "Cabai Rawit": "0.025",
        "Bawang Putih": "0.012", "Bawang Merah": "0.01", "Beras": "0.18",
    }),
    ("Mie Goreng Jawa", 18000, 50, 14, {
        "Mie Telur": "0.15", "Minyak Goreng": "0.03", "Telur": "0.06",
        "Kecap Manis": "0.02", "Sawi Hijau": "0.04", "Bawang Putih": "0.01",
    }),
    ("Nasi + Ayam Goreng", 19000, 48, 12, {
        "Beras": "0.2", "Ayam Fillet": "0.15", "Minyak Goreng": "0.04",
        "Bawang Putih": "0.012", "Bawang Merah": "0.008",
    }),
    ("Tahu Tempe Geprek", 12000, 45, 8, {
        "Tahu": "2", "Tempe": "2", "Minyak Goreng": "0.03",
        "Cabai Rawit": "0.02", "Bawang Putih": "0.006",
    }),
    ("Es Teh Manis", 5000, 60, 30, {
        "Teh Celup": "1", "Gula Pasir": "0.03", "Es Batu": "0.15",
    }),
    ("Es Jeruk", 8000, 55, 15, {
        "Jeruk Nipis": "0.08", "Gula Pasir": "0.02", "Es Batu": "0.15",
    }),
]

WEEKDAY_FACTOR = [0.75, 0.8, 0.85, 0.9, 1.1, 1.35, 1.2]  # Mon..Sun
TZ = djtimezone.get_current_timezone()


def _aware(day, hour, minute=0):
    return djtimezone.make_aware(datetime.combine(day, time(hour, minute)), TZ)


@contextmanager
def _backdatable(model):
    """auto_now_add=True fields ignore any explicit value passed in and get
    overwritten with now() on every insert, bulk_create included (Field.pre_save
    forces it during the INSERT). Temporarily flipping the flag off is the
    standard way to backdate created_at when seeding history."""
    field = model._meta.get_field("created_at")
    field.auto_now_add = False
    try:
        yield
    finally:
        field.auto_now_add = True


class Command(BaseCommand):
    help = "Seed a realistic demo business (ingredients, menus, ~6 weeks of sales) for showcase."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete the existing demo business first.")
        parser.add_argument("--days", type=int, default=42, help="How many days of sales history to generate.")
        parser.add_argument("--seed", type=int, default=1337, help="Random seed, for reproducible output.")

    def handle(self, *args, **options):
        random.seed(options["seed"])
        days = options["days"]

        existing = Business.objects.filter(username=BUSINESS_SLUG).first()
        if existing:
            if not options["reset"]:
                self.stderr.write(self.style.ERROR(
                    f"Business '{BUSINESS_SLUG}' udah ada. Pakai --reset kalau mau bikin ulang."
                ))
                return
            self.stdout.write(f"Menghapus data demo lama ({existing.name})...")
            # SaleItem.menu and MenuRecipe.ingredient are on_delete=PROTECT,
            # which blocks Business.delete()'s cascade even though those
            # rows would themselves be deleted along the way — clear the
            # protected references first, in dependency order.
            SaleItem.objects.filter(sale__business=existing).delete()
            Sale.objects.filter(business=existing).delete()
            MenuRecipe.objects.filter(menu__business=existing).delete()
            StockMovement.objects.filter(ingredient__business=existing).delete()
            Menu.objects.filter(business=existing).delete()
            Ingredient.objects.filter(business=existing).delete()
            existing.delete()

        with transaction.atomic():
            business, owner, staff = self._create_business_and_users()
            ingredients = self._create_ingredients(business)
            menus = self._create_menus(business, ingredients)
            self._create_sales_history(business, owner, staff, menus, ingredients, days)

        self.stdout.write(self.style.SUCCESS("\nSelesai! Demo data siap dipakai.\n"))
        self.stdout.write("Login owner   -> username: demo_owner  password: Demo1234!")
        self.stdout.write("Login staff   -> username: demo_staff  password: Staff1234!")
        self.stdout.write(f"Kode business -> {business.username}")

    def _create_business_and_users(self):
        business = Business.objects.create(name="Warung Bu Sari", username=BUSINESS_SLUG)

        owner = User(username="demo_owner", role=User.OWNER, business=business, first_name="Sari", last_name="Wulandari")
        owner.set_password("Demo1234!")
        owner.save()

        staff = User(username="demo_staff", role=User.STAFF, business=business, first_name="Budi", last_name="Santoso", is_active=True)
        staff.set_password("Staff1234!")
        staff.save()

        StaffFeatureGrant.objects.bulk_create([
            StaffFeatureGrant(staff=staff, feature="menus_manage", granted_by=owner),
            StaffFeatureGrant(staff=staff, feature="profit_analytics", granted_by=owner),
        ])

        return business, owner, staff

    def _create_ingredients(self, business):
        objs = {
            name: Ingredient(
                business=business, name=name, unit=unit,
                cost_per_unit=Decimal(str(cost)), low_stock_threshold=Decimal(str(threshold)),
                current_stock=Decimal("0"),
            )
            for name, unit, cost, threshold in INGREDIENTS
        }
        Ingredient.objects.bulk_create(objs.values())
        return objs

    def _create_menus(self, business, ingredients):
        menu_objs = {}
        recipe_rows = []
        for name, price, margin, weight, recipe in MENUS:
            menu = Menu(
                business=business, name=name, sell_price=Decimal(str(price)),
                target_margin=Decimal(str(margin)),
            )
            menu_objs[name] = {"obj": menu, "weight": weight, "recipe": recipe}
            for ing_name, qty in recipe.items():
                recipe_rows.append((menu, ingredients[ing_name], Decimal(qty)))

        Menu.objects.bulk_create([m["obj"] for m in menu_objs.values()])
        MenuRecipe.objects.bulk_create([
            MenuRecipe(menu=menu, ingredient=ing, qty_per_serving=qty)
            for menu, ing, qty in recipe_rows
        ])
        return menu_objs

    def _create_sales_history(self, business, owner, staff, menus, ingredients, days):
        today = djtimezone.localdate()
        start = today - timedelta(days=days - 1)
        menu_names = list(menus.keys())
        weights = [menus[n]["weight"] for n in menu_names]
        recorders = [owner, staff]

        cost_per_unit = {n: Decimal(str(c)) for n, _, c, _ in INGREDIENTS}
        unit_cost = {
            name: sum(
                (Decimal(qty) * cost_per_unit[ing_name] for ing_name, qty in menus[name]["recipe"].items()),
                Decimal("0"),
            )
            for name in menu_names
        }

        sales_rows = []
        sale_items_rows = []
        # ingredient_name -> {day: Decimal consumed}
        consumption = {name: {} for name in ingredients}

        num_days = (today - start).days + 1
        for i in range(num_days):
            day = start + timedelta(days=i)
            trend = 0.85 + (0.35 * i / max(num_days - 1, 1))  # slow growth over the period
            noise = random.uniform(0.85, 1.15)
            base_orders = 22 * WEEKDAY_FACTOR[day.weekday()] * trend * noise
            num_orders = max(3, round(base_orders))

            for _ in range(num_orders):
                num_items = random.choices([1, 2, 3], weights=[55, 35, 10])[0]
                picked = random.choices(menu_names, weights=weights, k=num_items)
                line_qty = {}
                for name in picked:
                    qty = random.choices([1, 2], weights=[80, 20])[0]
                    line_qty[name] = line_qty.get(name, 0) + qty

                sale = Sale(
                    business=business, sale_date=day, recorded_by=random.choice(recorders),
                    created_at=_aware(day, random.randint(10, 20), random.randint(0, 59)),
                )
                sales_rows.append(sale)

                for name, qty in line_qty.items():
                    sale_items_rows.append(SaleItem(
                        sale=sale, menu=menus[name]["obj"], quantity=qty,
                        unit_price=menus[name]["obj"].sell_price, unit_cost=unit_cost[name],
                    ))
                    for ing_name, per_serving in menus[name]["recipe"].items():
                        used = Decimal(per_serving) * qty
                        consumption[ing_name][day] = consumption[ing_name].get(day, Decimal("0")) + used

        with _backdatable(Sale):
            Sale.objects.bulk_create(sales_rows, batch_size=500)
        SaleItem.objects.bulk_create(sale_items_rows, batch_size=500)
        self.stdout.write(f"{len(sales_rows)} transaksi penjualan ({len(sale_items_rows)} item) dibuat.")

        self._simulate_stock(ingredients, consumption, start, today)

    def _simulate_stock(self, ingredients, consumption, start, today):
        num_days = (today - start).days + 1
        num_weeks = max(1, -(-num_days // 7))  # ceil division
        week_starts = {start + timedelta(days=7 * w) for w in range(num_weeks)}
        movements = []

        for name, ingredient in ingredients.items():
            total_used = sum(consumption[name].values(), Decimal("0"))
            weekly_avg = (total_used / num_weeks) if total_used else Decimal("0")
            # a bit of baseline usage even for lightly-used items so restocks aren't zero
            weekly_avg = max(weekly_avg, Decimal("0.5"))

            stock = weekly_avg * Decimal("1.3")
            day = start
            while day <= today:
                if day in week_starts:
                    restock_amt = (weekly_avg * Decimal("1.15")).quantize(Decimal("0.001"))
                    stock += restock_amt
                    shelf_life = _shelf_life_days(ingredient.unit, name)
                    movements.append(StockMovement(
                        ingredient=ingredient, change_qty=restock_amt,
                        movement_type=StockMovement.RESTOCK,
                        expiry_date=day + timedelta(days=shelf_life) if shelf_life else None,
                        created_by=None, created_at=_aware(day, 8),
                    ))

                used = consumption[name].get(day)
                if used:
                    stock -= used
                    movements.append(StockMovement(
                        ingredient=ingredient, change_qty=-used,
                        movement_type=StockMovement.SALE_DEDUCTION,
                        created_by=None, created_at=_aware(day, 21),
                    ))
                day += timedelta(days=1)

            ingredient.current_stock = max(stock, Decimal("0")).quantize(Decimal("0.001"))

        # --- narrative overrides, so the demo always has something to point at ---
        cabai = ingredients["Cabai Rawit"]
        cabai.current_stock = (cabai.low_stock_threshold * Decimal("0.6")).quantize(Decimal("0.001"))

        tahu = ingredients["Tahu"]
        fresh_batch = Decimal("15")
        tahu.current_stock += fresh_batch
        movements.append(StockMovement(
            ingredient=tahu, change_qty=fresh_batch, movement_type=StockMovement.RESTOCK,
            expiry_date=today + timedelta(days=2), created_by=None, created_at=_aware(today, 8),
        ))

        with _backdatable(StockMovement):
            StockMovement.objects.bulk_create(movements, batch_size=500)
        Ingredient.objects.bulk_update(ingredients.values(), ["current_stock"])
        self.stdout.write(f"{len(movements)} pergerakan stok dibuat.")

        # Tie the low-stock ingredient's expiring batch to an active discount on
        # the menu that uses it, so the Menus page shows a live "diskon aktif".
        tahu_tempe = Menu.objects.get(business=tahu.business, name="Tahu Tempe Geprek")
        tahu_tempe.active_discount_pct = Decimal("20")
        tahu_tempe.active_discount_ingredient = tahu
        tahu_tempe.active_discount_expiry_date = today + timedelta(days=2)
        tahu_tempe.save(update_fields=["active_discount_pct", "active_discount_ingredient", "active_discount_expiry_date"])


def _shelf_life_days(unit, name):
    """Rough shelf life for realistic restock expiry dates — dry goods get
    None (no meaningful expiry tracked), perishables get a short window."""
    perishable = {
        "Ayam Fillet": 3, "Telur": 14, "Tahu": 4, "Tempe": 5,
        "Sawi Hijau": 4, "Bawang Merah": 21, "Bawang Putih": 21,
        "Cabai Rawit": 10, "Jeruk Nipis": 14,
    }
    return perishable.get(name)
