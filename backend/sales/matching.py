"""Fuzzy matching CSV row -> existing Menu, tanpa AI (murni string similarity)."""
from rapidfuzz import fuzz, process

MENU_HEADER_ALIASES = {"menu", "item", "nama", "nama menu", "product", "product name", "menu name"}
QTY_HEADER_ALIASES = {"qty", "quantity", "jumlah", "terjual", "sold", "unit"}

HIGH_CONFIDENCE = 85


def detect_columns(headers, sample_rows=None):
    """
    Coba tebak kolom menu & qty. Dua lapis:
    1. Cocokin nama header ke alias yang dikenal (paling reliable).
    2. Kalau gagal & kolomnya cuma 2, tebak dari tipe data isinya
       (kolom yang isinya angka semua = qty, sisanya = menu).
    Return (menu_col, qty_col) atau (None, None) kalau dua-duanya gagal.
    """
    normalized = {h: h.strip().lower() for h in headers}
    menu_col = next((h for h, n in normalized.items() if n in MENU_HEADER_ALIASES), None)
    qty_col = next((h for h, n in normalized.items() if n in QTY_HEADER_ALIASES), None)

    if menu_col and qty_col:
        return menu_col, qty_col

    # fallback: cuma dicoba kalau PERSIS 2 kolom, dan sample rows tersedia
    if len(headers) == 2 and sample_rows:
        return detect_columns_by_dtype(headers, sample_rows)

    return None, None


def detect_columns_by_dtype(headers, sample_rows):
    """
    Cuma dipanggil kalau ada persis 2 kolom. Kolom yang isinya BISA
    di-parse jadi angka di semua sample row -> qty. Kolom satunya -> menu.
    Kalau dua-duanya numerik atau dua-duanya bukan numerik, gak bisa
    disimpulkan -> return (None, None), biar user mapping manual.
    """
    def is_numeric_column(col):
        values = [row.get(col, "").strip() for row in sample_rows]
        values = [v for v in values if v]  # skip cell kosong
        if not values:
            return False
        return all(_is_number(v) for v in values)

    col_a, col_b = headers[0], headers[1]
    a_numeric = is_numeric_column(col_a)
    b_numeric = is_numeric_column(col_b)

    if a_numeric and not b_numeric:
        return col_b, col_a   # col_b = menu (string), col_a = qty (angka)
    if b_numeric and not a_numeric:
        return col_a, col_b   # col_a = menu (string), col_b = qty (angka)

    return None, None  # ambigu (dua-duanya numerik / dua-duanya bukan)


def _is_number(value):
    try:
        float(value)
        return True
    except ValueError:
        return False


def match_menu_name(csv_name, menu_choices):
    if not menu_choices:
        return {"menu_id": None, "score": 0, "candidates": []}

    names = [name for _, name in menu_choices]
    results = process.extract(csv_name, names, scorer=fuzz.WRatio, limit=3)

    candidates = []
    for matched_name, score, idx in results:
        menu_id, _ = menu_choices[idx]
        candidates.append({"id": str(menu_id), "name": matched_name, "score": round(score)})

    best = candidates[0] if candidates else None
    best_id = best["id"] if best and best["score"] >= HIGH_CONFIDENCE else None

    return {"menu_id": best_id, "score": best["score"] if best else 0, "candidates": candidates}