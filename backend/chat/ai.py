import json
import logging
from unittest import result

from django.conf import settings

from briefs.services import _build_context

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from inventory.models import Ingredient, StockMovement


logger = logging.getLogger(__name__)


def _build_chat_prompt(context, message):
    return f"""
You are Stokita AI Business Copilot for a small F&B business owner.

Your job is to understand the owner's message and classify it into
ONE of two types:

1. "answer"
   The owner is asking a question, requesting analysis, brainstorming,
   or asking for advice. Do NOT modify any data.

2. "action"
   The owner is explicitly asking Stokita to perform an operation
   that can change business data.

Currently supported action:
- restock an existing ingredient

Examples of ACTION:
- "Tambah 10 kg ayam"
- "Add 5 kg chicken breast to my stock"
- "Restock susu sebanyak 20 liter"

Examples of ANSWER:
- "Stok apa yang paling perlu saya perhatikan?"
- "Kenapa profit saya turun?"
- "Menurutmu saya harus restock ayam?"
- "Menu mana yang paling menguntungkan?"

IMPORTANT RULES:

- Use only the business data provided below.
- Do not invent ingredients, IDs, quantities, units, or numbers.
- For an ACTION, the ingredient MUST exist in the provided ingredient data.
- Never execute an action yourself.
- An action always requires confirmation from the owner before execution.
- If the owner asks for advice about whether to restock, classify it as
  "answer", NOT "action".
- Only classify something as "action" when the owner explicitly instructs
  Stokita to change the inventory.
- If the requested action is not currently supported, classify it as
  "answer" and explain that the requested operation is not currently
  supported.
- Answer in clear, concise Bahasa Indonesia.

BUSINESS DATA:
{json.dumps(context, indent=2, default=str)}

OWNER MESSAGE:
{message}

Return ONLY valid JSON using EXACTLY one of these structures.

For an ANSWER:
{{
    "type": "answer",
    "answer": "jawaban dalam Bahasa Indonesia",
    "suggested_actions": [
        {{
            "label": "Restock susu",
            "intent": "restock",
            "ingredient_id": "UUID ingredient yang sesuai",
            "ingredient_name": "nama ingredient",
            "quantity": 10,
            "unit": "kg"
        }}
    ]
}}

Rules for suggested_actions:
- suggested_actions are OPTIONAL.
- Only suggest an action when it is directly useful based on the answer.
- Never invent an ingredient.
- ingredient_id MUST come from the provided business data.
- intent currently supported is only "restock".
- quantity must be a reasonable positive number.
- unit should match the ingredient's unit.
- Do NOT execute the action.
- The owner must still confirm before execution.
- If there is no useful action, return [].

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

For an unsupported or unclear request, use:
{{
    "type": "answer",
    "answer": "penjelasan bahwa permintaan belum dapat dilakukan",
    "suggested_actions": []
}}
"""


def _parse_chat_response(text, context):
    """
    Parse and validate Gemini response.

    Gemini is NOT trusted to decide which database entity can be modified.
    IDs and quantities are validated here before anything reaches the
    execution layer.
    """

    cleaned = (
        text.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )

    result = json.loads(cleaned)

    if result.get("type") == "answer":
        valid_ingredients = {
            str(i["id"]): i
            for i in context["ingredients"]
        }

        validated_suggestions = []

        for suggestion in result.get("suggested_actions", []):
            if not isinstance(suggestion, dict):
                continue

            if suggestion.get("intent") != "restock":
                continue

            ingredient_id = str(
                suggestion.get("ingredient_id", "")
            )

            if ingredient_id not in valid_ingredients:
                continue

            ingredient = valid_ingredients[ingredient_id]

            try:
                quantity = float(suggestion.get("quantity"))
            except (TypeError, ValueError):
                continue

            if quantity <= 0:
                continue

            # Unit authoritative tetap dari database
            unit = ingredient["unit"]

            validated_suggestions.append({
                "label": suggestion.get(
                    "label",
                    f"Restock {ingredient['name']}"
                ),
                "intent": "restock",
                "ingredient_id": ingredient_id,
                "ingredient_name": ingredient["name"],
                "quantity": quantity,
                "unit": unit,
            })

        return {
            "type": "answer",
            "answer": result.get("answer", ""),
            "suggested_actions": validated_suggestions,
        }  

    if result.get("type") == "action":
        if result.get("intent") != "restock":
            return {
                "type": "answer",
                "answer": "Aksi tersebut belum didukung oleh Stokita.",
                "suggested_actions": [],
            }

        valid_ingredients = {
            str(i["id"]): i
            for i in context["ingredients"]
        }

        ingredient_id = str(result.get("ingredient_id", ""))

        if ingredient_id not in valid_ingredients:
            return {
                "type": "answer",
                "answer": "Bahan yang ingin diubah tidak ditemukan di inventory.",
                "suggested_actions": [],
            }

        try:
            quantity = float(result.get("quantity"))
        except (TypeError, ValueError):
            return {
                "type": "answer",
                "answer": "Jumlah stok yang diminta tidak valid.",
                "suggested_actions": [],
            }

        if quantity <= 0:
            return {
                "type": "answer",
                "answer": "Jumlah stok harus lebih besar dari 0.",
                "suggested_actions": [],
            }

        ingredient = valid_ingredients[ingredient_id]

        # Jangan percaya unit yang diberikan Gemini.
        # Gunakan unit yang tersimpan di database.
        unit = ingredient["unit"]

        return {
            "type": "action",
            "intent": "restock",
            "ingredient_id": ingredient_id,
            "ingredient_name": ingredient["name"],
            "quantity": quantity,
            "unit": unit,
            "confirmation_required": True,
            "message": (
                f"Tambahkan {quantity:g} {unit} "
                f"{ingredient['name']} ke inventory?"
            ),
        }

    return {
        "type": "answer",
        "answer": "Maaf, saya tidak dapat memahami permintaan tersebut.",
        "suggested_actions": [],
    }


def chat_with_gemini(business, message):
    if not settings.GEMINI_API_KEY:
        return None

    try:
        from google import genai

        context = _build_context(business)
        prompt = _build_chat_prompt(context, message)

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

        logger.exception("Gemini chat failed")

        if "RESOURCE_EXHAUSTED" in error_text or "quota" in error_text.lower():
            return {
                "type": "ai_unavailable",
                "reason": "quota_exceeded",
                "message": (
                    "Stokita AI sedang mencapai batas penggunaan. "
                    "Silakan coba lagi nanti."
                ),
            }

        return {
            "type": "ai_unavailable",
            "reason": "api_error",
            "message": (
                "Stokita AI sedang tidak tersedia. "
                "Silakan coba lagi nanti."
            ),
        }


def execute_action(business, user, action):
    """
    Execute a validated AI action.

    Gemini hanya menginterpretasikan intent.
    Function ini yang menentukan apakah database boleh diubah.
    """

    if not action:
        return {
            "success": False,
            "error": "Action tidak ditemukan.",
        }

    if action.get("intent") != "restock":
        return {
            "success": False,
            "error": "Action tersebut belum didukung.",
        }

    ingredient_id = action.get("ingredient_id")

    if not ingredient_id:
        return {
            "success": False,
            "error": "Ingredient ID tidak ditemukan.",
        }

    # Pastikan ingredient memang milik business user
    try:
        ingredient = Ingredient.objects.get(
            id=ingredient_id,
            business=business,
        )
    except Ingredient.DoesNotExist:
        return {
            "success": False,
            "error": "Ingredient tidak ditemukan.",
        }

    # Validasi quantity
    try:
        quantity = Decimal(str(action.get("quantity")))
    except (InvalidOperation, TypeError, ValueError):
        return {
            "success": False,
            "error": "Jumlah stok tidak valid.",
        }

    if quantity <= 0:
        return {
            "success": False,
            "error": "Jumlah stok harus lebih besar dari 0.",
        }

    # Jangan percaya unit dari Gemini.
    # Unit authoritative tetap dari database.
    unit = ingredient.unit

    # Atomic transaction:
    # StockMovement + current_stock harus berhasil bersama-sama.
    with transaction.atomic():

        StockMovement.objects.create(
            ingredient=ingredient,
            change_qty=quantity,
            movement_type=StockMovement.RESTOCK,
            created_by=user,
        )

        ingredient.current_stock += quantity
        ingredient.save(update_fields=["current_stock"])

    return {
        "success": True,
        "message": (
            f"Berhasil menambahkan {quantity:g} {unit} "
            f"{ingredient.name} ke inventory."
        ),
        "ingredient_id": str(ingredient.id),
        "ingredient_name": ingredient.name,
        "quantity_added": float(quantity),
        "unit": unit,
        "current_stock": float(ingredient.current_stock),
    }