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

        PENTING: "estimated_days" harus berupa SATU angka pasti, bukan rentang.
        Kalau umur simpan bahan ini biasanya berupa rentang (misal 10-14 hari),
        gunakan ANGKA BATAS BAWAH dari rentang tersebut (contoh: 10, bukan 12
        atau 14). Lebih baik konservatif/aman daripada terlalu optimis, supaya
        bahan tidak dianggap masih layak pakai padahal sebenarnya sudah lewat
        waktu amannya.

        Jawab HANYA dalam format JSON berikut, tanpa markdown, tanpa penjelasan
        di luar JSON. Isi "note" wajib menggunakan Bahasa Indonesia, dan boleh
        tetap menyebutkan rentang aslinya di situ untuk konteks:
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

def parse_receipt(image_bytes: bytes, mime_type: str):
    """
    OCR struk belanja. Vision di sini cuma buat BACA TEKS (nama & qty item),
    bukan buat nebak kesegaran — jadi tetep akurat. Return list of dict
    [{"name": str, "quantity": float, "unit": str}, ...] atau [] kalau gagal.
    """
    from google import genai
    from google.genai import types

    if not settings.GEMINI_API_KEY:
        return []

    prompt = """
            Baca struk belanja pada foto ini. Ekstrak setiap item bahan makanan/minuman
            yang dibeli (abaikan item non-bahan makanan seperti kantong plastik, biaya
            layanan, pajak, dsb).

            Jawab HANYA dalam format JSON array, tanpa markdown:
            [
            {"name": "nama bahan (singkat & umum)", "quantity": number, "unit": "kg|g|pcs|liter|ml"}
            ]

            Kalau quantity tidak jelas dari struk, gunakan 1 sebagai default.
            Kalau tidak ada item yang bisa dikenali, jawab array kosong [].
        """
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt,
            ],
            config={"response_mime_type": "application/json"},
        )
        items = json.loads(response.text)
        return items if isinstance(items, list) else []
    except Exception:
        logger.exception("Gemini receipt parsing failed")
        return []