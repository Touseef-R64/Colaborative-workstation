import secrets
from django.contrib.auth.models import User
from django.conf import settings
from django.core.mail import send_mail
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from .serializers import (RegisterSerializer,  UserSearchSerializer, BoardMemberSerializer, EmailChangeRequestSerializer,
    PasswordChangeSerializer,
    UsernameUpdateSerializer,
    UserSerializer)
from rest_framework.response import Response
from rest_framework import permissions, status
from rest_framework.permissions import IsAuthenticated
from .models import EmailChangeRequest

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

    def patch(self, request):
        serializer = UsernameUpdateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.username = serializer.validated_data["username"]
        request.user.save(update_fields=["username"])
        return Response(UserSerializer(request.user).data)
    
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

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
 
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated. Please log in again."})

class RequestEmailChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
 
    def post(self, request):
        serializer = EmailChangeRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        new_email = serializer.validated_data["new_email"]
 
        change_request = EmailChangeRequest.objects.create(
            user=request.user, new_email=new_email, token=secrets.token_urlsafe(32)
        )
 
        verify_url = f"{settings.FRONTEND_URL}/verify-email?token={change_request.token}"
        send_mail(
            subject="Confirm your new email — Miro Lite",
            message=(
                f"Hi {request.user.username},\n\n"
                f"Confirm your new email address by visiting:\n{verify_url}\n\n"
                f"This link expires in 24 hours. If you didn't request this, ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[new_email],
        )
        return Response({"detail": "Verification email sent to your new address."})

class ConfirmEmailChangeView(APIView):
    permission_classes = [permissions.AllowAny]  # the link is clicked from an email client, no auth session there
 
    def post(self, request):
        token = request.data.get("token")
        try:
            change_request = EmailChangeRequest.objects.get(token=token, confirmed=False)
        except EmailChangeRequest.DoesNotExist:
            return Response(
                {"detail": "Invalid or already-used verification link."},
                status=status.HTTP_400_BAD_REQUEST,
            )
 
        if change_request.is_expired():
            return Response(
                {"detail": "This verification link has expired."}, status=status.HTTP_400_BAD_REQUEST
            )
 
        user = change_request.user
        user.email = change_request.new_email
        user.save(update_fields=["email"])
        change_request.confirmed = True
        change_request.save(update_fields=["confirmed"])
 
        return Response({"detail": "Email updated successfully."})