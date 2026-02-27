from rest_framework.permissions import BasePermission


def user_roles(user):
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return {'admin'}
    return set(user.groups.values_list('name', flat=True))


class HasAnyRole(BasePermission):
    allowed_roles = set()

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(user_roles(request.user).intersection(self.allowed_roles))


class InvoicePermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        roles = user_roles(request.user)
        is_staff = request.user.is_staff or request.user.is_superuser

        if view.action in ['list', 'retrieve', 'download', 'generate_control_number']:
            return True
        if view.action in ['control_numbers', 'control_history']:
            return bool(roles.intersection({'cashier', 'admin', 'manager'})) or is_staff

        if not is_staff:
            return False

        if view.action in ['list', 'retrieve']:
            return bool(roles.intersection({'admin', 'manager', 'cashier'}))
        if view.action in ['create', 'update', 'partial_update']:
            return bool(roles.intersection({'admin', 'manager'}))
        if view.action == 'destroy':
            return 'admin' in roles
        return False


class PaymentPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        roles = user_roles(request.user)
        is_staff = request.user.is_staff or request.user.is_superuser

        if view.action in ['list', 'retrieve', 'create']:
            return True
        if view.action == 'monthly_report':
            return is_staff

        if not is_staff:
            return False

        if view.action in ['list', 'retrieve']:
            return bool(roles.intersection({'admin', 'manager', 'cashier'}))
        if view.action == 'create':
            return bool(roles.intersection({'admin', 'cashier'}))
        if view.action in ['update', 'partial_update', 'destroy']:
            return 'admin' in roles
        return False


class AdminOnlyPermission(BasePermission):
    def has_permission(self, request, view):
        return 'admin' in user_roles(request.user)
