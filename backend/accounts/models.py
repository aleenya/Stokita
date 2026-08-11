import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class Business(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "business"

    def __str__(self):
        return self.name


class User(AbstractUser):
    OWNER = "owner"
    STAFF = "staff"
    ROLE_CHOICES = [(OWNER, "Owner"), (STAFF, "Staff")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name="users",
        null=True, blank=True,
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=STAFF)

    def is_owner(self):
        return self.role == self.OWNER