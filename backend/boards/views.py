from rest_framework import permissions, status, viewsets
from django.contrib.auth.models import User
from .models import Board, Element, BoardMember, SavedGroupTemplate
from .serializers import (
    BoardSerializer, ElementSerializer, SavedGroupTemplateSerializer,
)
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.decorators import action
from accounts.serializers import BoardMemberSerializer
from rest_framework.views import APIView


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






def _serialize_subtree(element):
    return {
        "type": element.type,
        "props": element.props,
        "children": [_serialize_subtree(child) for child in element.children.order_by("z_index")],
    }


def _instantiate_snapshot(node, board_id, parent_id, x_offset, y_offset, created_by, sibling_index=0):
    props = dict(node.get("props", {}))
    if "x" in props:
        props["x"] = props["x"] + x_offset
    if "y" in props:
        props["y"] = props["y"] + y_offset
    if "points" in props and isinstance(props["points"], list):
        # freehand strokes store points as a flat [x0,y0,x1,y1,...] array
        props["points"] = [
            v + (x_offset if i % 2 == 0 else y_offset) for i, v in enumerate(props["points"])
        ]

    element = Element.objects.create(
        board_id=board_id,
        parent_id=parent_id,
        type=node["type"],
        props=props,
        z_index=sibling_index * 1000,
        created_by=created_by,
    )
    created_ids = [str(element.id)]
    for i, child in enumerate(node.get("children", [])):
        created_ids += _instantiate_snapshot(
            child, board_id, element.id, x_offset, y_offset, created_by, sibling_index=i
        )
    return created_ids


class SavedGroupTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = SavedGroupTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedGroupTemplate.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        template = self.get_object()
        board_id = request.data.get("board")
        x_offset = request.data.get("x", 0)
        y_offset = request.data.get("y", 0)

        if not Board.objects.filter(id=board_id, members__user=request.user).exists():
            return Response({"detail": "Not a member of that board."}, status=403)

        created_ids = _instantiate_snapshot(
            template.snapshot, board_id=board_id, parent_id=None,
            x_offset=x_offset, y_offset=y_offset, created_by=request.user,
        )
        return Response({"created": created_ids})


class SaveGroupAsTemplateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        group_id = request.data.get("element")
        name = request.data.get("name")
        try:
            root = Element.objects.get(id=group_id, board__members__user=request.user)
        except Element.DoesNotExist:
            return Response({"detail": "Element not found."}, status=404)

        snapshot = _serialize_subtree(root)
        template = SavedGroupTemplate.objects.create(owner=request.user, name=name, snapshot=snapshot)
        return Response(SavedGroupTemplateSerializer(template).data, status=201)
