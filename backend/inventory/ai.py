"""Text-based expiry estimation for restock (F1)."""
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def estimate_shelf_life(ingredient_name: str, notes: str = ""):
    """
    Minta Gemini estimasi umur simpan (hari) berdasarkan nama bahan,
    dengan asumsi bahan baru dibeli fresh hari ini & disimpan normal
    (kulkas/suhu ruang sesuai jenisnya).
    Return dict {"estimated_days": int, "confidence": str, "note": str} atau None.
    """
    from google import genai

    if not settings.GEMINI_API_KEY:
        return None

    prompt = f"""
        Kamu membantu bisnis F&B kecil memperkirakan berapa lama sebuah bahan
        akan bertahan, dengan asumsi bahan tersebut baru dibeli dalam kondisi
        segar hari ini dan disimpan secara normal (kulkas/suhu ruang, sesuai
        jenis bahannya).

        Nama bahan: {ingredient_name}
        {"Catatan tambahan dari user: " + notes if notes else ""}

        Jawab HANYA dalam format JSON berikut, tanpa markdown, tanpa penjelasan
        di luar JSON. Isi "note" wajib menggunakan Bahasa Indonesia:
        {{
        "estimated_days": integer,
        "confidence": "high" | "medium" | "low",
        "note": "alasan singkat, misalnya umur simpan umum untuk jenis bahan ini"
        }}
    """
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[prompt],
            config={"response_mime_type": "application/json"},
        )
        result = json.loads(response.text)
        if result.get("estimated_days") is None:
            return None
        return result
    except Exception:
        logger.exception("Gemini expiry estimation failed")
        return None