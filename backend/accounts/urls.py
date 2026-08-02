from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView
)

from . import views 


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
        views.RegisterView.as_view()
    ),
    path("auth/me/", views.MeView.as_view()),
    path("search/", views.UserSearchView.as_view()),
    path("auth/password/", views.ChangePasswordView.as_view()),
    path("auth/email/", views.RequestEmailChangeView.as_view()),
    path("auth/email/confirm/", views.ConfirmEmailChangeView.as_view()),

]