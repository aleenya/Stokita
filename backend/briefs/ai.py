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
    """
    Baseline PRICING logic: works today, no AI needed.
    NOTE: restock TIDAK ditangani di sini / di file ini sama sekali —
    itu sepenuhnya domain inventory app (live endpoint, bukan bagian
    dari brief).
    """
    actions = []

    # 1. worrying-margin menus -> review
    for menu in context["profit"]:
        if menu["state"] == "worrying":
            actions.append({
                "action_type": "review_menu",
                "title": f"Review Harga Menu {menu['name']}",
                "message": f"Margin {menu['name']} sedang bermasalah ({menu['margin_pct']}%). Tinjau ulang harga jual atau resepnya.",
                "related_menu_id": menu["menu_id"],
                "discount_pct": None,
                "rupiah_impact": 0,
            })

    # 2. expiring stock -> discount (flat 20% fallback since no AI reasoning available)
    FALLBACK_DISCOUNT_PCT = 20
    for ing in context["expiring_soon"]:
        actions.append({
            "action_type": "discount",
            "title": f"Diskon {FALLBACK_DISCOUNT_PCT}% Bahan {ing['name']}",
            "message": f"{ing['name']} akan segera kedaluwarsa. Diskon disarankan supaya cepat terjual sebelum terbuang.",
            "related_ingredient_id": ing["id"],
            "discount_pct": FALLBACK_DISCOUNT_PCT,
            "rupiah_impact": 0,
        })

    return actions
 
_VALID_ACTION_TYPES = {"discount", "review_menu"}
# NOTE: "restock" sengaja TIDAK dimasukkan di sini. Restock adalah keputusan
# deterministik berbasis threshold, dan sepenuhnya domain inventory app
# (live endpoint, bukan bagian dari brief ini sama sekali) — jadi AI
# tidak pernah diminta atau diizinkan membuat action_type "restock".
# Kalau model tetap balikin "restock", _parse_gemini_response akan drop item itu.


def _build_prompt(context):
    """
    Turn the pricing context dict into a plain-language + JSON prompt for Gemini.

    Scope sengaja dipersempit: AI di sini HANYA memutuskan hal-hal terkait
    HARGA (diskon untuk bahan yang mau expired, atau review/naikkan harga
    untuk menu yang marginnya jelek). Keputusan stok/restock TIDAK lewat
    fungsi ini sama sekali — itu sepenuhnya domain inventory app (live
    endpoint), karena "restock atau tidak" adalah perbandingan angka
    terhadap threshold, bukan keputusan yang butuh reasoning AI.
    """
    return f"""
Anda adalah asisten pendukung keputusan HARGA untuk pemilik usaha F&B skala kecil.
Tugas Anda HANYA dua hal:
1. Menyarankan diskon (dengan PERSENTASE spesifik) untuk bahan yang akan segera kedaluwarsa (supaya cepat terjual sebelum terbuang).
2. Menyarankan peninjauan/kenaikan harga untuk menu yang marginnya sedang bermasalah.

Anda TIDAK menangani keputusan stok/restock — itu di luar tugas Anda, jangan buat rekomendasi soal itu sama sekali.

Dasarkan setiap rekomendasi pada angka aktual yang diberikan — jangan mengarang bahan, menu, atau angka yang tidak ada di dalam data.

Data bisnis (harga & margin per menu, dan bahan yang segera kedaluwarsa):
{json.dumps(context, indent=2, default=str)}

Balas HANYA dengan array JSON (tanpa format markdown, tanpa teks tambahan apa pun), di mana setiap item memiliki format persis seperti ini:
[
  {{
    "action_type": "discount" | "review_menu",
    "title": "Judul SANGAT singkat (maks ~6 kata), langsung actionable. Untuk discount WAJIB sebutkan persentase & nama menu/bahan, contoh: 'Diskon 20% Menu Nasi Goreng'. Untuk review_menu, contoh: 'Naikkan Harga Menu Ayam Geprek'.",
    "message": "1 kalimat singkat alasannya (reasoning), nama menu/bahan di awal kalimat. Contoh: 'Bahan Nasi Goreng akan kedaluwarsa dalam 2 hari.'",
    "discount_pct": "Angka 5-50 (integer, persen). WAJIB diisi kalau action_type discount. null kalau review_menu.",
    "related_ingredient_id": "String uuid atau null",
    "related_menu_id": "String uuid atau null",
    "rupiah_impact": Perkiraan dampak dalam satuan rupiah (integer), isi 0 jika tidak diketahui
  }}
]

Aturan:
- related_ingredient_id harus menggunakan salah satu nilai "id" bahan yang ada di dalam data "expiring_soon", atau null.
- related_menu_id harus menggunakan salah satu nilai "menu_id" yang ada di dalam data "profit", atau null.
- Hanya rekomendasikan "discount" untuk bahan yang benar-benar muncul di dalam data "expiring_soon". Kalau bahan itu dipakai di sebuah menu yang datanya ada di "profit", sertakan related_menu_id-nya juga supaya title bisa menyebut nama menu (bukan cuma nama bahan).
- Hanya rekomendasikan "review_menu" untuk menu yang muncul di dalam data "profit" dengan status "worrying" (mengkhawatirkan) atau rendah.
- "discount" WAJIB punya discount_pct terisi (jangan null, jangan 0).
- Jangan pernah membuat action_type selain "discount" atau "review_menu".
- Batasi array maksimal 8 tindakan, prioritaskan yang memiliki dampak (impact) tertinggi.
"""


def _parse_gemini_response(text, context):
    """Parse and validate Gemini's JSON output against the context we sent."""
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    actions = json.loads(cleaned)

    valid_ingredient_ids = {i["id"] for i in context["expiring_soon"]}
    valid_menu_ids = {m["menu_id"] for m in context["profit"]}

    validated = []
    for a in actions:
        if a.get("action_type") not in _VALID_ACTION_TYPES:
            continue
        if not a.get("message") or not a.get("title"):
            continue

        ingredient_id = a.get("related_ingredient_id")
        if ingredient_id not in valid_ingredient_ids:
            ingredient_id = None

        menu_id = a.get("related_menu_id")
        if menu_id not in valid_menu_ids:
            menu_id = None

        discount_pct = a.get("discount_pct")
        if a["action_type"] == "discount":
            try:
                discount_pct = float(discount_pct)
                if not (0 < discount_pct <= 90):
                    continue  # nonsense percentage, skip this action entirely
            except (TypeError, ValueError):
                continue  # discount without a usable percentage is useless downstream, skip
        else:
            discount_pct = None  # review_menu never carries a discount_pct

        validated.append({
            "action_type": a["action_type"],
            "title": a["title"],
            "message": a["message"],
            "discount_pct": discount_pct,
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