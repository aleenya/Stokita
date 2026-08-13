import json
import logging
from decimal import Decimal, InvalidOperation
from datetime import date, timedelta
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.db.models import (
    F,
    DecimalField,
    ExpressionWrapper,
    Sum,
)

from inventory.models import Ingredient, StockMovement
from menus.models import Menu
from sales.models import SaleItem
from sales.services import classify_margin_state


logger = logging.getLogger(__name__)


# ============================================================
# CHAT CONTEXT
# ============================================================

def _build_chat_context(business):
    """
    Build business context specifically for the Chatbot.

    Chatbot context is intentionally separated from Daily Brief
    context so changes in briefs/services.py do not break chat.

    The context contains:
    - ingredients / current stock
    - low-stock ingredients
    - expiring ingredients
    - menus
    - menu cost and margin
    - recent sales
    """

    # --------------------------------------------------------
    # 1. INGREDIENT / INVENTORY
    # --------------------------------------------------------

    ingredients = Ingredient.objects.filter(
        business=business
    ).order_by("name")

    ingredient_data = []

    for ingredient in ingredients:
        is_low_stock = (
            ingredient.low_stock_threshold is not None
            and ingredient.current_stock
            <= ingredient.low_stock_threshold
        )

        ingredient_data.append({
            "id": str(ingredient.id),
            "name": ingredient.name,
            "unit": ingredient.unit,
            "current_stock": float(ingredient.current_stock),
            "cost_per_unit": float(ingredient.cost_per_unit),
            "low_stock_threshold": (
                float(ingredient.low_stock_threshold)
                if ingredient.low_stock_threshold is not None
                else None
            ),
            "is_low_stock": is_low_stock,
        })

    # --------------------------------------------------------
    # 2. EXPIRING STOCK
    # --------------------------------------------------------

    today = date.today()
    expiry_limit = today + timedelta(days=3)

    expiring_movements = (
        StockMovement.objects.filter(
            ingredient__business=business,
            movement_type=StockMovement.RESTOCK,
            expiry_date__isnull=False,
            expiry_date__lte=expiry_limit,
            expiry_date__gte=today,
        )
        .select_related("ingredient")
        .order_by("expiry_date")
    )

    expiring_data = []

    for movement in expiring_movements:
        days_until_expiry = (
            movement.expiry_date - today
        ).days

        expiring_data.append({
            "ingredient_id": str(movement.ingredient.id),
            "ingredient_name": movement.ingredient.name,
            "expiry_date": movement.expiry_date.isoformat(),
            "days_until_expiry": days_until_expiry,
            "restock_quantity": float(movement.change_qty),
        })

    # --------------------------------------------------------
    # 3. MENU + PROFIT
    # --------------------------------------------------------

    menus = Menu.objects.filter(
        business=business
    ).prefetch_related(
        "recipe_lines__ingredient"
    ).order_by("name")

    menu_data = []

    for menu in menus:

        items = SaleItem.objects.filter(
            menu=menu,
            sale__business=business,
        )

        aggregate = items.aggregate(
            revenue=Sum(
                ExpressionWrapper(
                    F("unit_price") * F("quantity"),
                    output_field=DecimalField(),
                )
            ),
            cost=Sum(
                ExpressionWrapper(
                    F("unit_cost") * F("quantity"),
                    output_field=DecimalField(),
                )
            ),
            quantity_sold=Sum("quantity"),
        )

        revenue = aggregate["revenue"] or Decimal("0")
        cost = aggregate["cost"] or Decimal("0")
        quantity_sold = aggregate["quantity_sold"] or 0

        if revenue:
            margin_pct = float(
                (revenue - cost) / revenue * 100
            )
        else:
            margin_pct = 0.0

        target_margin = float(menu.target_margin)

        menu_data.append({
            "id": str(menu.id),
            "name": menu.name,
            "sell_price": float(menu.sell_price),
            "target_margin": target_margin,
            "unit_cost": float(menu.unit_cost()),
            "margin_pct": round(margin_pct, 1),
            "margin_state": classify_margin_state(
                margin_pct,
                target_margin,
            ),
            "quantity_sold": int(quantity_sold),
            "is_active": menu.is_active,
            "active_discount_pct": (
                float(menu.active_discount_pct)
                if menu.active_discount_pct is not None
                else None
            ),
        })

    # --------------------------------------------------------
    # 4. RECENT SALES
    # --------------------------------------------------------

    recent_sales_cutoff = today - timedelta(days=30)

    recent_sale_items = (
        SaleItem.objects.filter(
            sale__business=business,
            sale__sale_date__gte=recent_sales_cutoff,
        )
        .select_related("sale", "menu")
        .order_by("-sale__sale_date")
    )

    sales_data = []

    for item in recent_sale_items[:100]:
        revenue = item.unit_price * item.quantity
        cost = item.unit_cost * item.quantity
        profit = revenue - cost

        sales_data.append({
            "sale_date": item.sale.sale_date.isoformat(),
            "menu_id": str(item.menu.id),
            "menu_name": item.menu.name,
            "quantity": item.quantity,
            "unit_price": float(item.unit_price),
            "unit_cost": float(item.unit_cost),
            "revenue": float(revenue),
            "profit": float(profit),
        })

    # --------------------------------------------------------
    # 5. SUMMARY
    # --------------------------------------------------------

    low_stock = [
        ingredient
        for ingredient in ingredient_data
        if ingredient["is_low_stock"]
    ]

    context = {
        "business": {
            "id": str(business.id),
            "name": business.name,
        },

        "ingredients": ingredient_data,

        "low_stock_ingredients": low_stock,

        "expiring_soon": expiring_data,

        "menus": menu_data,

        "recent_sales": sales_data,

        "context_notes": {
            "today": today.isoformat(),
            "expiry_window_days": 3,
            "sales_history_days": 30,
        },
    }

    return context


# ============================================================
# PROMPT
# ============================================================

def _build_chat_prompt(context, message):
    return f"""
You are Stokita AI Business Copilot for a small F&B business owner.

Your job is to understand the owner's message and classify it into
ONE of two types:

1. "answer"

The owner is asking a question, requesting analysis, brainstorming,
or asking for advice.

Do NOT modify any data.

2. "action"

The owner is explicitly asking Stokita to perform an operation
that changes business data.

Currently supported action:
- restock an existing ingredient

3. "unsupported"
   The user is asking Stokita to perform or access a capability that
   is not currently supported through chat.

Examples:
- "Import CSV sales saya"
- "Edit recipe ayam geprek"
- "Hapus transaksi terakhir"
- "Kelola staff saya"

IMPORTANT:
- Do NOT classify unsupported requests as "action".
- Do NOT pretend that the operation was completed.
- Explain briefly that the operation is not available through chat
  and, when appropriate, tell the user which existing feature they
  can use instead.

==================================================
SUPPORTED ACTION
==================================================

The ONLY currently supported action is:

RESTOCK INGREDIENT

Examples:

- "Tambah 10 kg ayam"
- "Tambahkan 5 kg susu ke stok"
- "Restock chicken breast sebanyak 20 kg"
- "Masukkan 10 liter susu ke inventory"

These are ACTION requests.

==================================================
ANSWER REQUESTS
==================================================

Examples:

- "Stok apa yang paling perlu saya perhatikan?"
- "Kenapa profit saya turun?"
- "Menu mana yang margin-nya paling rendah?"
- "Menu mana yang paling laku?"
- "Menurutmu saya harus restock ayam?"
- "Apa yang harus saya perhatikan dari inventory saya?"
- "Bagaimana performa penjualan saya?"

These are ANSWER requests.

If the owner asks whether something SHOULD be done,
this is advice and therefore an ANSWER.

Example:

"Haruskah saya restock ayam?"

=> ANSWER

NOT ACTION.

Only classify as ACTION when the owner explicitly instructs
Stokita to change the inventory.

==================================================
IMPORTANT RULES
==================================================

- Use ONLY the business data provided below.
- Do not invent ingredients.
- Do not invent IDs.
- Do not invent quantities.
- Do not invent sales.
- Do not invent profit numbers.
- Do not invent stock numbers.
- For ACTION, the ingredient MUST exist in the provided
  ingredient data.
- Never execute an action yourself.
- An action ALWAYS requires confirmation from the owner.
- If an action is not currently supported, classify it as
  "answer" and explain that the requested operation is not
  currently supported.
- Do not pretend that an unsupported operation was executed.
- Answer in clear and concise Bahasa Indonesia.

==================================================
IMPORTANT ABOUT UNSUPPORTED FEATURES
==================================================

The application may have features that are not currently
available as Chatbot actions.

For example:

- importing CSV sales history
- editing menus
- changing menu recipes
- deleting sales
- managing staff
- changing permissions
- activating discounts
- bulk inventory changes

If the owner asks the chatbot to perform one of these
operations, DO NOT classify it as an action.

Instead return:

"type": "answer"

and explain briefly that the operation is not currently
supported through Chatbot, without claiming that it was done.

If useful, mention that the operation can be performed through
the corresponding Stokita application feature.

==================================================
BUSINESS DATA
==================================================

{json.dumps(context, indent=2, default=str)}

==================================================
OWNER MESSAGE
==================================================

{message}

==================================================
OUTPUT FORMAT
==================================================

Return ONLY valid JSON.

For an ANSWER:

{{
    "type": "answer",
    "answer": "jawaban dalam Bahasa Indonesia",
    "suggested_actions": []
}}

For an ACTION:

{{
    "type": "action",
    "intent": "restock",
    "ingredient_id": "UUID ingredient yang sesuai",
    "ingredient_name": "nama ingredient",
    "quantity": 10,
    "unit": "kg",
    "confirmation_required": true,
    "message": "Konfirmasi singkat mengenai aksi yang akan dilakukan"
}}

For an UNSUPPORTED request:
{{
    "type": "unsupported",
    "capability": "csv_import",
    "answer": "Import CSV belum dapat dilakukan melalui chat. Silakan gunakan fitur Import CSV pada halaman Sales.",
    "suggested_actions": []
}}

For an unsupported or unclear request:

{{
    "type": "answer",
    "answer": "penjelasan bahwa permintaan belum dapat dilakukan melalui Chatbot",
    "suggested_actions": []
}}

IMPORTANT:

Return JSON only.
Do not use Markdown.
Do not include explanations outside the JSON.
"""


# ============================================================
# PARSE + VALIDATE GEMINI RESPONSE
# ============================================================

def _parse_chat_response(text, context):
    """
    Parse and validate Gemini response.

    Gemini is NOT trusted to decide which database entity
    can be modified.

    Database entities and quantities are validated here
    before anything reaches execute_action().
    """

    cleaned = (
        text.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )

    result = json.loads(cleaned)

    # --------------------------------------------------------
    # ANSWER
    # --------------------------------------------------------

    if result.get("type") == "answer":

        return {
            "type": "answer",
            "answer": result.get("answer", ""),
            "suggested_actions": result.get(
                "suggested_actions",
                [],
            ),
        }

    # --------------------------------------------------------
    # ACTION
    # --------------------------------------------------------

    if result.get("type") == "action":

        if result.get("intent") != "restock":
            return {
                "type": "answer",
                "answer": (
                    "Aksi tersebut belum didukung "
                    "oleh Stokita."
                ),
                "suggested_actions": [],
            }

        # ----------------------------------------------------
        # Validate ingredient
        # ----------------------------------------------------

        valid_ingredients = {
            str(i["id"]): i
            for i in context["ingredients"]
        }

        ingredient_id = str(
            result.get("ingredient_id", "")
        )

        if ingredient_id not in valid_ingredients:
            return {
                "type": "answer",
                "answer": (
                    "Bahan yang ingin diubah "
                    "tidak ditemukan di inventory."
                ),
                "suggested_actions": [],
            }

        # ----------------------------------------------------
        # Validate quantity
        # ----------------------------------------------------

        try:
            quantity = Decimal(
                str(result.get("quantity"))
            )
        except (
            InvalidOperation,
            TypeError,
            ValueError,
        ):
            return {
                "type": "answer",
                "answer": (
                    "Jumlah stok yang diminta "
                    "tidak valid."
                ),
                "suggested_actions": [],
            }

        if quantity <= 0:
            return {
                "type": "answer",
                "answer": (
                    "Jumlah stok harus lebih besar dari 0."
                ),
                "suggested_actions": [],
            }

        # ----------------------------------------------------
        # Use database-authoritative ingredient data
        # ----------------------------------------------------

        ingredient = valid_ingredients[ingredient_id]

        unit = ingredient["unit"]

        return {
            "type": "action",
            "intent": "restock",
            "ingredient_id": ingredient_id,
            "ingredient_name": ingredient["name"],
            "quantity": float(quantity),
            "unit": unit,
            "confirmation_required": True,
            "message": (
                f"Tambahkan {quantity:g} {unit} "
                f"{ingredient['name']} ke inventory?"
            ),
        }

    # --------------------------------------------------------
    # Unknown response
    # --------------------------------------------------------
    if result.get("type") == "unsupported":
        return {
            "type": "unsupported",
            "capability": result.get("capability", "unknown"),
            "answer": result.get(
                "answer",
                "Fitur tersebut belum tersedia melalui chat."
            ),
            "suggested_actions": result.get(
                "suggested_actions",
                [],
            ),
        }

    return {
        "type": "answer",
        "answer": (
            "Maaf, saya tidak dapat memahami "
            "permintaan tersebut."
        ),
        "suggested_actions": [],
    }


# ============================================================
# GEMINI CHAT
# ============================================================

def chat_with_gemini(business, message):
    """
    Main entry point for Chatbot.

    Returns:

    ANSWER:
    {
        "type": "answer",
        ...
    }

    ACTION:
    {
        "type": "action",
        ...
    }

    AI UNAVAILABLE:
    {
        "type": "ai_unavailable",
        ...
    }
    """

    if not settings.GEMINI_API_KEY:
        return {
            "type": "ai_unavailable",
            "reason": "missing_api_key",
            "message": (
                "Stokita AI belum dikonfigurasi."
            ),
        }

    try:
        from google import genai

        # Build chatbot-specific context.
        context = _build_chat_context(business)

        prompt = _build_chat_prompt(
            context,
            message,
        )

        client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
            },
        )

        return _parse_chat_response(
            response.text,
            context,
        )

    except Exception as e:

        error_text = str(e)

        logger.exception(
            "Gemini chat failed"
        )

        # ----------------------------------------------------
        # Gemini quota exceeded
        # ----------------------------------------------------

        if (
            "RESOURCE_EXHAUSTED" in error_text
            or "quota" in error_text.lower()
        ):
            return {
                "type": "ai_unavailable",
                "reason": "quota_exceeded",
                "message": (
                    "Stokita AI sedang mencapai "
                    "batas penggunaan. "
                    "Silakan coba lagi nanti."
                ),
            }

        # ----------------------------------------------------
        # Other Gemini/API errors
        # ----------------------------------------------------

        return {
            "type": "ai_unavailable",
            "reason": "api_error",
            "message": (
                "Stokita AI sedang tidak tersedia. "
                "Silakan coba lagi nanti."
            ),
        }


# ============================================================
# EXECUTE ACTION
# ============================================================

def execute_action(business, user, action):
    """
    Execute a validated AI action.

    Gemini hanya menginterpretasikan intent.

    Function ini yang menentukan apakah database boleh
    diubah.

    Currently supported:
    - restock ingredient
    """

    # --------------------------------------------------------
    # Validate action
    # --------------------------------------------------------

    if not action:
        return {
            "success": False,
            "error": "Action tidak ditemukan.",
        }

    if action.get("intent") != "restock":
        return {
            "success": False,
            "error": (
                "Action tersebut belum didukung."
            ),
        }

    # --------------------------------------------------------
    # Validate ingredient ID
    # --------------------------------------------------------

    ingredient_id = action.get(
        "ingredient_id"
    )

    if not ingredient_id:
        return {
            "success": False,
            "error": (
                "Ingredient ID tidak ditemukan."
            ),
        }

    # --------------------------------------------------------
    # IMPORTANT:
    # Ensure ingredient belongs to this business.
    # --------------------------------------------------------
    try:
        ingredient_uuid = UUID(str(ingredient_id))
    except (ValueError, TypeError, AttributeError):
        return {
            "success": False,
            "error": "Ingredient tidak ditemukan.",
        }

    try:
        ingredient = Ingredient.objects.get(
            id=ingredient_uuid,
            business=business,
        )
    except Ingredient.DoesNotExist:
        return {
            "success": False,
            "error": "Ingredient tidak ditemukan.",
        }

    # --------------------------------------------------------
    # Validate quantity
    # --------------------------------------------------------

    try:
        quantity = Decimal(
            str(action.get("quantity"))
        )

    except (
        InvalidOperation,
        TypeError,
        ValueError,
    ):
        return {
            "success": False,
            "error": (
                "Jumlah stok tidak valid."
            ),
        }

    if quantity <= 0:
        return {
            "success": False,
            "error": (
                "Jumlah stok harus lebih besar dari 0."
            ),
        }

    # --------------------------------------------------------
    # Database is authoritative for unit
    # --------------------------------------------------------

    unit = ingredient.unit

    # --------------------------------------------------------
    # Atomic transaction
    #
    # StockMovement + current_stock must succeed together.
    # --------------------------------------------------------

    with transaction.atomic():

        StockMovement.objects.create(
            ingredient=ingredient,
            change_qty=quantity,
            movement_type=StockMovement.RESTOCK,
            created_by=user,
        )

        ingredient.current_stock += quantity

        ingredient.save(
            update_fields=["current_stock"]
        )

    # --------------------------------------------------------
    # Return execution result
    # --------------------------------------------------------

    return {
        "success": True,
        "message": (
            f"Berhasil menambahkan "
            f"{quantity:g} {unit} "
            f"{ingredient.name} "
            f"ke inventory."
        ),
        "ingredient_id": str(
            ingredient.id
        ),
        "ingredient_name": ingredient.name,
        "quantity_added": float(
            quantity
        ),
        "unit": unit,
        "current_stock": float(
            ingredient.current_stock
        ),
    }