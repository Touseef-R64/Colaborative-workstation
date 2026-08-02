import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


def generate_token():
    return secrets.token_urlsafe(32)


class EmailChangeRequest(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_change_requests"
    )
    new_email = models.EmailField()
    token = models.CharField(max_length=64, unique=True, default=generate_token)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed = models.BooleanField(default=False)

    def is_expired(self) -> bool:
        return timezone.now() - self.created_at > timezone.timedelta(hours=24)