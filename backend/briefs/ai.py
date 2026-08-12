"""
AI integration stub for Stokita (F5 Purchase Recommendation).
 
Right now this uses simple RULE-BASED logic so the whole system works
end-to-end without any AI. Later, you can replace the body of
`generate_recommendations` with a Gemini call that takes the same
`context` dict and returns the same list shape.
 
That way nothing else in the codebase has to change when you add AI.
"""
from decimal import Decimal
from datetime import date, timedelta
import logging
import json
from django.conf import settings
logger = logging.getLogger(__name__)
 
 
def _rule_based_recommendations(context):
    """Baseline logic: works today, no AI needed."""
    actions = []
 
    # 1. low-stock -> restock
    for ing in context["ingredients"]:
        if ing["low_stock_threshold"] is not None and \
           ing["current_stock"] <= ing["low_stock_threshold"]:
            actions.append({
                "action_type": "restock",
                "message": f"{ing['name']} is low ({ing['current_stock']} {ing['unit']} left). Consider restocking.",
                "related_ingredient_id": ing["id"],
                "rupiah_impact": 0,
            })
 
    # 2. worrying-margin menus -> review
    for menu in context["profit"]:
        if menu["state"] == "worrying":
            actions.append({
                "action_type": "review_menu",
                "message": f"{menu['name']} margin is worrying ({menu['margin_pct']}%). Review pricing or recipe.",
                "related_menu_id": menu["menu_id"],
                "rupiah_impact": 0,
            })
 
    # 3. expiring stock -> discount
    for ing in context["expiring_soon"]:
        actions.append({
            "action_type": "discount",
            "message": f"{ing['name']} expires soon. Consider a discount to clear it before waste.",
            "related_ingredient_id": ing["id"],
            "rupiah_impact": 0,
        })
 
    return actions
 
_VALID_ACTION_TYPES = {"restock", "discount", "review_menu", "expiry_alert"}


def _build_prompt(context):
    """Turn the context dict into a plain-language + JSON prompt for Gemini."""
    return f"""
Anda adalah asisten pendukung keputusan untuk pemilik usaha F&B skala kecil.
Berdasarkan data bisnis di bawah ini, rekomendasikan tindakan konkret yang harus diambil pemilik hari ini. Dasarkan setiap rekomendasi pada angka aktual yang diberikan — jangan mengarang bahan, menu, atau angka yang tidak ada di dalam data.

Data bisnis:
{json.dumps(context, indent=2, default=str)}

Balas HANYA dengan array JSON (tanpa format markdown, tanpa teks tambahan apa pun), di mana setiap item memiliki format persis seperti ini:
[
  {{
    "action_type": "restock" | "discount" | "review_menu" | "expiry_alert",
    "message": "rekomendasi singkat dan jelas dalam bahasa Indonesia",
    "related_ingredient_id": "string uuid atau null",
    "related_menu_id": "string uuid atau null",
    "rupiah_impact": perkiraan dampak dalam satuan rupiah (integer), isi 0 jika tidak diketahui
  }}
]

Aturan:
- related_ingredient_id harus menggunakan salah satu nilai "id" bahan (ingredient) yang ada di dalam data, atau null.
- related_menu_id harus menggunakan salah satu nilai "menu_id" yang ada di dalam data, atau null.
- Hanya rekomendasikan restock bahan jika bahan tersebut muncul di dalam data stok menipis (low-stock).
- Hanya rekomendasikan peninjauan (review) menu jika menu tersebut muncul di dalam data profit dengan status "worrying" (mengkhawatirkan) atau rendah.
- Batasi array maksimal 8 tindakan, prioritaskan yang memiliki dampak (impact) tertinggi.
"""


def _parse_gemini_response(text, context):
    """Parse and validate Gemini's JSON output against the context we sent."""
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    actions = json.loads(cleaned)

    valid_ingredient_ids = {i["id"] for i in context["ingredients"]}
    valid_menu_ids = {m["menu_id"] for m in context["profit"]}

    validated = []
    for a in actions:
        if a.get("action_type") not in _VALID_ACTION_TYPES:
            continue
        if not a.get("message"):
            continue

        ingredient_id = a.get("related_ingredient_id")
        if ingredient_id not in valid_ingredient_ids:
            ingredient_id = None

        menu_id = a.get("related_menu_id")
        if menu_id not in valid_menu_ids:
            menu_id = None

        validated.append({
            "action_type": a["action_type"],
            "message": a["message"],
            "related_ingredient_id": ingredient_id,
            "related_menu_id": menu_id,
            "rupiah_impact": a.get("rupiah_impact") or 0,
        })

    return validated


def _gemini_recommendations(context):
    from google import genai

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    prompt = _build_prompt(context)

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=prompt,
        config={"response_mime_type": "application/json"},
    )
    return _parse_gemini_response(response.text, context)


def generate_recommendations(context):
    """
    Public entry point. Returns a list of action dicts.

    Tries Gemini first (if GEMINI_API_KEY is set). Falls back to
    rule-based logic if the key is missing, the API call fails, or
    the response can't be parsed/validated — so the brief always
    generates something, even if Gemini is down.
    """
    if settings.GEMINI_API_KEY:
        try:
            actions = _gemini_recommendations(context)
            if actions:
                return actions
            logger.warning("Gemini returned no valid actions, falling back to rules.")
        except Exception:
            logger.exception("Gemini call failed, falling back to rule-based recommendations.")

    return _rule_based_recommendations(context)

def _build_impact_prompt(action_message, baseline, followup, other_context):
    return f"""
        Kamu membantu bisnis F&B kecil mengevaluasi apakah sebuah aksi yang
        direkomendasikan benar-benar berdampak ke bisnis mereka.

        Aksi yang dilakukan: {action_message}

        Metrik SEBELUM aksi dilakukan (baseline, agregat 7 hari):
        {json.dumps(baseline, indent=2, default=str)}

        Metrik SETELAH beberapa waktu berjalan (follow-up, agregat 7 hari terbaru):
        {json.dumps(followup, indent=2, default=str)}

        Konteks lain yang mungkin relevan (aksi lain yang terjadi di periode yang
        sama):
        {other_context or "Tidak ada konteks tambahan."}

        Pikirkan langkah demi langkah sebelum menjawab:
        1. Bandingkan angka baseline vs follow-up — naik, turun, atau stabil?
        2. Apakah besarnya perubahan itu masuk akal disebabkan oleh aksi yang dilakukan?
        3. Apakah ada faktor lain di "konteks lain" yang lebih mungkin jadi penyebab?
        4. Kalau datanya belum cukup jelas, jangan memaksakan jawaban positif/negatif.

        Jawab HANYA dalam format JSON berikut, tanpa markdown:
        {{
        "answer": "positive" | "negative" | "inconclusive" | "external",
        "reasoning": "penjelasan singkat dalam Bahasa Indonesia, sebutkan angka konkret yang dibandingkan"
        }}
    """


def analyze_impact(action_message: str, baseline: dict, followup: dict, other_context: str = ""):
    """
    Return dict {"answer": str, "reasoning": str} atau None kalau gagal
    (key gak ada, API error, atau response gak valid JSON).
    """
    from google import genai

    if not settings.GEMINI_API_KEY:
        return None

    prompt = _build_impact_prompt(action_message, baseline, followup, other_context)
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        result = json.loads(response.text)
        if result.get("answer") not in {"positive", "negative", "inconclusive", "external"}:
            return None
        if not result.get("reasoning"):
            return None
        return result
    except Exception:
        logger.exception("Gemini impact analysis failed")
        return None
