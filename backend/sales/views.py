from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from menus.models import Menu
from .models import Sale
from .serializers import RecordSaleSerializer, SaleSerializer
from .services import record_sale, InsufficientStockError, compute_menu_profit_states
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
        qs = Sale.objects.filter(business=self.request.user.business).prefetch_related("items")
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
    
            decoded = file.read().decode("utf-8-sig")
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
            menu_choices = list(Menu.objects.filter(business=business).values_list("id", "name"))
    
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
    """F3: per-menu profit and health classification."""
    permission_classes = [IsAuthenticated, feature_required("profit_analytics")]

    def list(self, request):
        business = request.user.business
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        results = compute_menu_profit_states(business, date_from, date_to)
        return Response({"menus": results})

   
