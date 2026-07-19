from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView
)

from .views import RegisterView, MeView, UserSearchView


urlpatterns = [

    path(
        "auth/login/",
        TokenObtainPairView.as_view(),
        name="login"
    ),

    path(
        "auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh"
    ),

    path(
        "auth/register/",
        RegisterView.as_view()
    ),
    path("auth/me/", MeView.as_view()),
    path("search/", UserSearchView.as_view()),

]