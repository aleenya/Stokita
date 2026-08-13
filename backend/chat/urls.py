from django.urls import path

from .views import (
    ChatMessageView,
    ConfirmChatActionView,
    CancelChatActionView,
)


urlpatterns = [
    path(
        "message/",
        ChatMessageView.as_view(),
        name="chat-message",
    ),

    path(
        "actions/<uuid:action_id>/confirm/",
        ConfirmChatActionView.as_view(),
        name="chat-action-confirm",
    ),

    path(
        "actions/<uuid:action_id>/cancel/",
        CancelChatActionView.as_view(),
        name="chat-action-cancel",
    ),
]