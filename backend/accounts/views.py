from django.contrib.auth.models import User

from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from .serializers import RegisterSerializer,  UserSearchSerializer, BoardMemberSerializer
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
        })
    
class UserSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response([])

        users = (
            User.objects.filter(username__icontains=q)
            .exclude(id=request.user.id)
            .order_by("username")[:10]
        )
        return Response(UserSearchSerializer(users, many=True).data)