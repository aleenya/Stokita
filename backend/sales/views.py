from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from menus.models import Menu
from .models import Sale
from .serializers import RecordSaleSerializer, SaleSerializer
from .services import (
    record_sale, InsufficientStockError, compute_menu_profit_states, delete_sale,
    compute_performance_overview, compute_menu_breakdown, compute_menu_compare,
)
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsOwner
from accounts.permissions import feature_required
import csv
import io
from .matching import detect_columns, match_menu_name


class SaleViewSet(viewsets.ModelViewSet):
    serializer_class = SaleSerializer

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsOwner()]
        return [IsAuthenticated()]

    def get_queryset(self):
        # No ordering = Postgres makes no guarantee about row order, so
        # "Recent Sales" could render in a different order on every
        # request/page load instead of consistently newest-first.
        qs = Sale.objects.filter(
            business=self.request.user.business
        ).prefetch_related("items").order_by("-sale_date", "-created_at")
        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(sale_date=date)
        return qs
 
    def create(self, request):
        input_serializer = RecordSaleSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated = input_serializer.validated_data

        try:
            sale = record_sale(
                business=request.user.business,
                user=request.user,
                sale_date=validated["sale_date"],
                items=[
                    {"menu_id": str(item["menu_id"]), "quantity": item["quantity"]}
                    for item in validated["items"]
                ],
            )
        except InsufficientStockError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Menu.DoesNotExist:
            return Response({"error": "Menu gak ditemukan."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        delete_sale(instance)

    @action(detail=False, methods=["post"], url_path="parse-csv")
    def parse_csv(self, request):
            """
            Tahap 1 (menu_column/qty_column belum dikirim): deteksi kolom,
            balikin buat DIKONFIRMASI dulu — belum ada matching, belum ada
            processing berat.
    
            Tahap 2 (menu_column/qty_column dikirim eksplisit, hasil konfirmasi
            user): baru jalanin fuzzy matching penuh, balikin rows siap-review.
            """
            file = request.FILES.get("file")
            if not file:
                return Response({"error": "file CSV wajib diisi"}, status=status.HTTP_400_BAD_REQUEST)

            raw = file.read()
            try:
                decoded = raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                # CSV yang diexport dari Excel di Windows sering kepake
                # cp1252 (mis. tanda kutip pintar/karakter beraksen), bukan
                # UTF-8 — sebelumnya ini nge-raise UnicodeDecodeError yang
                # gak ketangkep sama sekali (500), bukannya pesan yang jelas.
                try:
                    decoded = raw.decode("cp1252")
                except UnicodeDecodeError:
                    return Response(
                        {"error": "Gagal baca file CSV — pastiin file disimpan dengan encoding UTF-8."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            reader = csv.DictReader(io.StringIO(decoded))
            rows = list(reader)
            if not rows:
                return Response({"error": "CSV kosong"}, status=status.HTTP_400_BAD_REQUEST)
    
            headers = reader.fieldnames
            menu_col = request.data.get("menu_column")
            qty_col = request.data.get("qty_column")
    
            # --- Tahap 1: belum dikonfirmasi user, cuma deteksi + preview ---
            if not menu_col or not qty_col:
                detected_menu, detected_qty = detect_columns(headers, sample_rows=rows[:5])
                return Response({
                    "confirmed": False,
                    "headers": headers,
                    "sample_rows": rows[:3],
                    "suggested_menu_column": detected_menu,  # bisa null kalau gak kedeteksi
                    "suggested_qty_column": detected_qty,     # bisa null kalau gak kedeteksi
                })
    
            # --- Tahap 2: user udah confirm/pilih kolom, proses penuh ---
            business = request.user.business
            # is_active=True: record_sale() only ever resolves active menus,
            # so matching CSV rows against inactive ones used to "succeed"
            # here with high confidence, then fail the whole batch at
            # submit time with a confusing "Menu gak ditemukan" — and the
            # matched menu wouldn't even appear in the frontend's (active-
            # only) dropdown, so the row looked blank despite being matched.
            menu_choices = list(
                Menu.objects.filter(business=business, is_active=True).values_list("id", "name")
            )
    
            results = []
            for row in rows:
                csv_name = (row.get(menu_col) or "").strip()
                qty_raw = (row.get(qty_col) or "").strip()
                if not csv_name or not qty_raw:
                    continue
                try:
                    qty = int(float(qty_raw))
                except ValueError:
                    continue
    
                match = match_menu_name(csv_name, menu_choices)
                results.append({
                    "csv_name": csv_name,
                    "quantity": qty,
                    "matched_menu_id": match["menu_id"],
                    "confidence_score": match["score"],
                    "candidates": match["candidates"],
                })
    
            return Response({"confirmed": True, "rows": results})
 
 
class ProfitAnalyticsViewSet(viewsets.ViewSet):
    """F3: per-menu profit and health classification, plus the Performance
    page's period-based overview/breakdown/compare views below."""
    permission_classes = [IsAuthenticated, feature_required("profit_analytics")]

    def list(self, request):
        business = request.user.business
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        results = compute_menu_profit_states(business, date_from, date_to)
        return Response({"menus": results})

    @action(detail=False, methods=["get"])
    def overview(self, request):
        business = request.user.business
        period = request.query_params.get("period", "7d")
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        menu_id = request.query_params.get("menu") or None
        return Response(compute_performance_overview(business, period, date_from, date_to, menu_id))

    @action(detail=False, methods=["get"], url_path="menus")
    def menu_breakdown(self, request):
        business = request.user.business
        period = request.query_params.get("period", "7d")
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        menu_id = request.query_params.get("menu") or None
        return Response(compute_menu_breakdown(business, period, date_from, date_to, menu_id))

    @action(detail=False, methods=["get"])
    def compare(self, request):
        business = request.user.business
        period = request.query_params.get("period", "30d")
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        menu_a = request.query_params.get("menu_a")
        menu_b = request.query_params.get("menu_b")
        if not menu_a or not menu_b:
            return Response(
                {"error": "menu_a dan menu_b wajib diisi."}, status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(compute_menu_compare(business, period, menu_a, menu_b, date_from, date_to))

   
