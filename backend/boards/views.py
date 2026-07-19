from rest_framework import permissions, status, viewsets
from django.contrib.auth.models import User
from .models import Board, Element, BoardMember
from .serializers import BoardSerializer, ElementSerializer
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.serializers import BoardMemberSerializer
class BoardViewSet(viewsets.ModelViewSet):
    serializer_class = BoardSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Board.objects.filter(members__user=self.request.user).distinct()

    def perform_create(self, serializer):
        board = serializer.save(owner=self.request.user)
        board.members.create(user=self.request.user, role="owner")

    @action(detail=True, methods=["get", "post"])
    def members(self, request, pk=None):
        board = self.get_object()

        if request.method == "GET":
            members = board.members.select_related("user").order_by("invited_at")
            return Response(BoardMemberSerializer(members, many=True).data)

        if board.owner_id != request.user.id:
            return Response(
                {"detail": "Only the board owner can invite people."},
                status=status.HTTP_403_FORBIDDEN,
            )

        username = request.data.get("username")
        role = request.data.get("role", "editor")
        if role not in dict(BoardMember.ROLE_CHOICES):
            return Response({"detail": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "No user with that username."}, status=status.HTTP_404_NOT_FOUND)

        member, created = BoardMember.objects.get_or_create(
            board=board, user=user, defaults={"role": role}
        )
        if not created:
            return Response({"detail": "That user is already a member."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BoardMemberSerializer(member).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path="members/(?P<member_id>[^/.]+)")
    def remove_member(self, request, pk=None, member_id=None):
        board = self.get_object()
        if board.owner_id != request.user.id:
            return Response(
                {"detail": "Only the board owner can remove people."},
                status=status.HTTP_403_FORBIDDEN,
            )
        deleted, _ = board.members.filter(id=member_id).exclude(role="owner").delete()
        if not deleted:
            return Response({"detail": "Member not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)



class ElementViewSet(viewsets.ModelViewSet):
    """REST fallback for element CRUD (initial board load, non-realtime clients).

    Live collaborative edits go through the WebSocket consumer instead —
    see boards/consumers.py.
    """

    serializer_class = ElementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Element.objects.filter(board__members__user=self.request.user)
        board_id = self.request.query_params.get("board")
        if board_id:
            qs = qs.filter(board_id=board_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
