"""Text-based expiry estimation for restock (F1)."""
import json
import logging
from django.conf import settings
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Definisi Skema untuk Gemini

class ShelfLifeResponse(BaseModel):
    reasoning: str = Field(description="Berpikir langkah demi langkah mengenai karakteristik bahan dan cara penyimpanan standar sebelum menentukan estimasi hari.")
    estimated_days: int = Field(description="SATU angka pasti (integer). Gunakan ANGKA BATAS BAWAH dari rentang umur simpan agar konservatif/aman.")
    confidence: Literal["high", "medium", "low"]
    note: str = Field(description="Alasan singkat dalam Bahasa Indonesia, boleh mencantumkan rentang aslinya di sini.")

class ReceiptItem(BaseModel):
    name: str = Field(description="Nama bahan makanan/minuman (singkat & umum).")
    quantity: float = Field(description="Jumlah yang dibeli. Gunakan 1 sebagai default jika tidak jelas.")
    unit: str = Field(description="Satuan berat/volume (contoh: kg, g, pcs, liter, ml).")
    total_price: Optional[float] = Field(description="Harga TOTAL baris itu dalam Rupiah. Isi null jika tidak terlihat jelas. JANGAN menebak.")

class ReceiptResponse(BaseModel):
    reasoning: str = Field(description="Analisis langkah demi langkah untuk membaca struk, mengenali bahan makanan, dan membuang item non-bahan makanan (seperti pajak/kantong plastik).")
    items: List[ReceiptItem]

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
    """

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[prompt],
            config={
                "response_mime_type": "application/json",
                "response_schema": ShelfLifeResponse,
                "temperature": 0.0, # Deterministik & faktual
            },
        )
        result = json.loads(response.text)
        if result.get("estimated_days") is None:
            return None
            
        # Mengembalikan dictionary persis seperti format awal (membuang key 'reasoning')
        return {
            "estimated_days": result["estimated_days"],
            "confidence": result["confidence"],
            "note": result["note"]
        }
    except Exception:
        logger.exception("Gemini expiry estimation failed")
        return None

def parse_receipt(image_bytes: bytes, mime_type: str):
    """
    OCR struk belanja. Vision di sini cuma buat BACA TEKS (nama & qty item),
    bukan buat nebak kesegaran — jadi tetep akurat. Return list of dict
    [{"name": str, "quantity": float, "unit": str, "total_price": float|None}, ...] 
    atau [] kalau gagal.
    """
    from google import genai
    from google.genai import types

    if not settings.GEMINI_API_KEY:
        return []

    prompt = """
    Baca struk belanja pada foto ini. Ekstrak setiap item bahan makanan/minuman
    yang dibeli (abaikan item non-bahan makanan seperti kantong plastik, biaya
    layanan, pajak, dsb).
    
    Kalau tidak ada item yang bisa dikenali, pastikan array list item kosong.
    """
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt,
            ],
            config={
                "response_mime_type": "application/json",
                "response_schema": ReceiptResponse,
                "temperature": 0.0, # Ekstraksi teks/OCR harus sangat deterministik
            },
        )
        data = json.loads(response.text)
        
        # Ambil hanya array 'items' untuk di-return, mengabaikan 'reasoning'
        items = data.get("items", [])
        return items if isinstance(items, list) else []
    except Exception:
        logger.exception("Gemini receipt parsing failed")
        return []