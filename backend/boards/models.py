import uuid

from django.conf import settings
from django.db import models


class Board(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, default="Untitled board")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="boards"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class BoardMember(models.Model):
    ROLE_CHOICES = [("owner", "Owner"), ("editor", "Editor"), ("viewer", "Viewer")]

    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,related_name="board_memberships")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="editor")
    invited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("board", "user")


class Element(models.Model):
    """One row per canvas object (sticky note, shape, text, image, stroke).

    Keeping elements as separate rows — rather than one JSON blob per board —
    is what makes per-element locking and incremental WebSocket diffs possible.
    """

    TYPE_CHOICES = [
        ("sticky", "Sticky note"),
        ("shape", "Shape"),
        ("text", "Text"),
        ("image", "Image"),
        ("stroke", "Freehand stroke"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="elements")
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    # x, y, width, height, rotation, fill, text, points, src, etc. — shape depends on `type`
    props = models.JSONField(default=dict)
    z_index = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["z_index", "created_at"]

    def __str__(self):
        return f"{self.type} on {self.board_id}"
