"""
AI integration stub for Stokita (F5 Purchase Recommendation).
"""
from decimal import Decimal
from datetime import date, timedelta
import logging
import json
from django.conf import settings

# Tambahkan import ini untuk tipe data dan skema
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ==========================================
# 1. DEFINISI SCHEMA UNTUK GEMINI
# ==========================================

class RecommendationItem(BaseModel):
    action_type: Literal["discount", "review_menu"]
    title: str = Field(description="Judul SANGAT singkat (maks ~6 kata), langsung actionable.")
    message: str = Field(description="1 kalimat singkat alasannya, nama menu/bahan di awal.")
    discount_pct: Optional[int] = Field(description="Angka 5-50. null jika review_menu.")
    related_ingredient_id: Optional[str] = Field(description="String uuid dari bahan terkait, atau null")
    related_menu_id: Optional[str] = Field(description="String uuid dari menu terkait, atau null")
    rupiah_impact: int = Field(description="Perkiraan dampak rupiah, isi 0 jika tidak tahu")

class RecommendationResponse(BaseModel):
    reasoning: str = Field(description="Berpikir langkah demi langkah: analisis data yang diberikan sebelum memutuskan tindakan. Tuliskan dalam Bahasa Indonesia.")
    recommendations: List[RecommendationItem]

class ImpactAnalysisResponse(BaseModel):
    reasoning: str = Field(description="Analisis perbandingan angka baseline vs followup langkah demi langkah.")
    answer: Literal["positive", "negative", "inconclusive", "external"]


# ==========================================
# 2. LOGIC & HELPER FUNCTIONS
# ==========================================

def _rule_based_recommendations(context):
    """ Baseline PRICING logic: works today, no AI needed. """
    actions = []

    for menu in context.get("profit", []):
        if menu["state"] == "worrying":
            actions.append({
                "action_type": "review_menu",
                "title": f"Review Harga Menu {menu['name']}",
                "message": f"Margin {menu['name']} sedang bermasalah ({menu.get('margin_pct', 0)}%). Tinjau ulang harga jual atau resepnya.",
                "related_menu_id": menu["menu_id"],
                "discount_pct": None,
                "rupiah_impact": 0,
            })

    FALLBACK_DISCOUNT_PCT = 20
    for ing in context.get("expiring_soon", []):
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

def _build_prompt(context):
    """ Turn the pricing context dict into a plain-language prompt for Gemini. """
    return f"""
Anda adalah asisten pendukung keputusan HARGA untuk pemilik usaha F&B skala kecil.
Tugas Anda HANYA dua hal:
1. Menyarankan diskon (dengan PERSENTASE spesifik) untuk bahan yang akan segera kedaluwarsa (supaya cepat terjual sebelum terbuang).
2. Menyarankan peninjauan/kenaikan harga untuk menu yang marginnya sedang bermasalah.

Anda TIDAK menangani keputusan stok/restock — itu di luar tugas Anda.

Dasarkan setiap rekomendasi pada angka aktual yang diberikan di bawah ini.

Data bisnis:
{json.dumps(context, indent=2, default=str)}

Aturan:
- related_ingredient_id harus dari data "expiring_soon", atau null.
- related_menu_id harus dari data "profit", atau null.
- "discount" WAJIB punya discount_pct terisi (jangan null, jangan 0).
- Batasi rekomendasi maksimal 8 tindakan, prioritaskan dampak tertinggi.
"""

def _parse_gemini_response(text, context):
    """Parse and validate Gemini's JSON output."""
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    data = json.loads(cleaned)
    
    # Ambil list recommendations dari dalam objek
    actions = data.get("recommendations", [])

    valid_ingredient_ids = {i["id"] for i in context.get("expiring_soon", [])}
    valid_menu_ids = {m["menu_id"] for m in context.get("profit", [])}

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
                    continue 
            except (TypeError, ValueError):
                continue 
        else:
            discount_pct = None 

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
        config={
            "response_mime_type": "application/json",
            "response_schema": RecommendationResponse,
            "temperature": 0.4, 
        },
    )
    return _parse_gemini_response(response.text, context)

def generate_recommendations(context):
    if settings.GEMINI_API_KEY:
        try:
            actions = _gemini_recommendations(context)
            if actions:
                return actions
            logger.warning("Gemini returned no valid actions, falling back to rules.")
        except Exception:
            logger.exception("Gemini call failed, falling back to rule-based recommendations.")

    return _rule_based_recommendations(context)


# ==========================================
# 3. IMPACT ANALYSIS (DETERMINISTIC)
# ==========================================

def _build_impact_prompt(action_message, baseline, followup, other_context):
    return f"""
Kamu membantu bisnis F&B kecil mengevaluasi apakah sebuah aksi yang 
direkomendasikan benar-benar berdampak ke bisnis mereka.

Aksi yang dilakukan: {action_message}

Metrik SEBELUM aksi dilakukan (baseline, agregat 7 hari):
{json.dumps(baseline, indent=2, default=str)}

Metrik SETELAH beberapa waktu berjalan (follow-up, agregat 7 hari terbaru):
{json.dumps(followup, indent=2, default=str)}

Konteks lain yang mungkin relevan:
{other_context or "Tidak ada konteks tambahan."}
"""

def analyze_impact(action_message: str, baseline: dict, followup: dict, other_context: str = ""):
    from google import genai

    if not settings.GEMINI_API_KEY:
        return None

    prompt = _build_impact_prompt(action_message, baseline, followup, other_context)
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": ImpactAnalysisResponse,
                "temperature": 0.0, 
            },
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