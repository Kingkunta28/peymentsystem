from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    BackupView,
    CurrentUserView,
    InvoiceViewSet,
    LoginView,
    RegisterCashierView,
    RegisterView,
    LogoutView,
    PaymentViewSet,
    RestoreView,
    UserDirectoryView,
    UserViewSet,
)

router = DefaultRouter()
router.register('invoices', InvoiceViewSet, basename='invoice')
router.register('payments', PaymentViewSet, basename='payment')
router.register('users', UserViewSet, basename='user')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/register-cashier/', RegisterCashierView.as_view(), name='register-cashier'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('users/directory/', UserDirectoryView.as_view(), name='user-directory'),
    path('admin/backup/', BackupView.as_view(), name='backup'),
    path('admin/restore/', RestoreView.as_view(), name='restore'),
    path('', include(router.urls)),
]
