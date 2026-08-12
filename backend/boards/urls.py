from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import BoardViewSet, ElementViewSet, SaveGroupAsTemplateView, SavedGroupTemplateViewSet

router = DefaultRouter()
router.register("boards", BoardViewSet, basename="board")
router.register("elements", ElementViewSet, basename="element")
router.register("templates", SavedGroupTemplateViewSet, basename="template")

urlpatterns = [
    path("templates/save-group/", SaveGroupAsTemplateView.as_view()),
] + router.urls