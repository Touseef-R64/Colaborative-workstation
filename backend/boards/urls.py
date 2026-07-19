from rest_framework.routers import DefaultRouter

from .views import BoardViewSet, ElementViewSet

router = DefaultRouter()
router.register("boards", BoardViewSet, basename="board")
router.register("elements", ElementViewSet, basename="element")

urlpatterns = router.urls