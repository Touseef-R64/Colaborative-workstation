from rest_framework import serializers

from .models import Board, Element


class ElementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Element
        fields = ["id", "board", "type", "props", "z_index", "created_by", "updated_at"]
        read_only_fields = ["created_by", "updated_at"]


class BoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = ["id", "name", "owner", "created_at", "updated_at"]
        read_only_fields = ["owner", "created_at", "updated_at"]


