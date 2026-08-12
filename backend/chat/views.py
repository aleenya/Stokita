from unittest import result

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils import timezone

from .ai import chat_with_gemini, execute_action
from .models import PendingAction

class ChatMessageView(APIView):
    """
    POST /api/v1/chat/message/

    User sends a normal chat message.
    Gemini decides whether this is an answer or an action.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = (request.data.get("message") or "").strip()

        if not message:
            return Response(
                {"error": "message wajib diisi"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        business = request.user.business

        if not business:
            return Response(
                {"error": "User belum memiliki business"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = chat_with_gemini(
            business=business,
            message=message,
        )

        if result is None:
            return Response(
                {
                    "type": "ai_unavailable",
                    "reason": "unknown",
                    "message": "Stokita AI sedang tidak tersedia.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if result.get("type") == "ai_unavailable":
            return Response(
                result,
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # =========================
        # CASE 1: NORMAL ANSWER
        # =========================

        if result.get("type") == "answer":
            return Response({
                "type": "answer",
                "answer": result.get("answer", ""),
                "suggested_actions": result.get(
                    "suggested_actions",
                    [],
                ),
            })

        # =========================
        # CASE 2: ACTION
        # =========================

        if result.get("type") == "action":

            ingredient_id = result.get("ingredient_id")
            quantity = result.get("quantity")
            unit = result.get("unit")
            intent = result.get("intent")

            if not ingredient_id or not quantity:
                return Response(
                    {"error": "AI menghasilkan action yang tidak lengkap"},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            pending = PendingAction.objects.create(
                user=request.user,
                business=business,
                intent=intent,
                ingredient_id=ingredient_id,
                quantity=quantity,
                unit=unit,
                message=result.get("message", ""),
            )

            return Response({
                "type": "action",
                "action": {
                    "id": str(pending.id),
                    "intent": pending.intent,
                    "ingredient_id": str(pending.ingredient_id),
                    "quantity": float(pending.quantity),
                    "unit": pending.unit,
                    "message": pending.message,
                    "confirmation_required": True,
                },
            })

        return Response(
            {"error": "Response AI tidak dikenali"},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class ConfirmChatActionView(APIView):
    """
    POST /api/v1/chat/actions/<action_id>/confirm/

    User confirms a previously generated action.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, action_id):

        try:
            pending = PendingAction.objects.select_related(
                "ingredient",
                "business",
            ).get(
                id=action_id,
                user=request.user,
                business=request.user.business,
            )

        except PendingAction.DoesNotExist:
            return Response(
                {"error": "Action tidak ditemukan"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if pending.status != PendingAction.PENDING:
            return Response(
                {
                    "error": (
                        f"Action sudah berstatus "
                        f"'{pending.status}'"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ====================================
        # Lock pending action during execution
        # ====================================

        with transaction.atomic():

            pending = PendingAction.objects.select_for_update().get(
                id=action_id,
                user=request.user,
                business=request.user.business,
            )

            if pending.status != PendingAction.PENDING:
                return Response(
                    {"error": "Action sudah diproses"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            action = {
                "intent": pending.intent,
                "ingredient_id": str(pending.ingredient_id),
                "quantity": pending.quantity,
            }

            result = execute_action(
                business=request.user.business,
                user=request.user,
                action=action,
            )

            if not result.get("success"):
                return Response(
                    result,
                    status=status.HTTP_400_BAD_REQUEST,
                )

            pending.status = PendingAction.CONFIRMED
            pending.confirmed_at = timezone.now()
            pending.save(
                update_fields=[
                    "status",
                    "confirmed_at",
                ]
            )

        return Response({
            "type": "action_confirmed",
            "action_id": str(pending.id),
            "result": result,
        })

class CancelChatActionView(APIView):
    """
    POST /api/v1/chat/actions/<action_id>/cancel/
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, action_id):

        try:
            pending = PendingAction.objects.get(
                id=action_id,
                user=request.user,
                business=request.user.business,
            )

        except PendingAction.DoesNotExist:
            return Response(
                {"error": "Action tidak ditemukan"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if pending.status != PendingAction.PENDING:
            return Response(
                {"error": "Action sudah diproses"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pending.status = PendingAction.CANCELLED
        pending.save(update_fields=["status"])

        return Response({
            "type": "action_cancelled",
            "action_id": str(pending.id),
        })