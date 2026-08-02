from django.contrib.auth.models import User
from rest_framework import serializers
from boards.models import BoardMember
from django.contrib.auth.password_validation import validate_password

class UserSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]

class BoardMemberSerializer(serializers.ModelSerializer):
    user = UserSearchSerializer(read_only=True)

    class Meta:
        model = BoardMember
        fields = ["id", "user", "role", "invited_at"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
        ]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email"),
            password=validated_data["password"],
        )

        return user
    
class UsernameUpdateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
 
    def validate_username(self, value):
        qs = User.objects.filter(username=value)
        request_user = self.context["request"].user
        if request_user.is_authenticated:
            qs = qs.exclude(id=request_user.id)
        if qs.exists():
            raise serializers.ValidationError("That username is already taken.")
        return value
 
 
class EmailChangeRequestSerializer(serializers.Serializer):
    new_email = serializers.EmailField()
 
    def validate_new_email(self, value):
        request_user = self.context["request"].user
        if User.objects.filter(email=value).exclude(id=request_user.id).exists():
            raise serializers.ValidationError("That email is already in use.")
        return value
 
 
class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
 
    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
    def validate_new_password(self, value):
        validate_password(value)
        return value
 