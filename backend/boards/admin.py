from django.contrib import admin

from .models import Board, BoardMember, Element

admin.site.register(Board)
admin.site.register(BoardMember)
admin.site.register(Element)
