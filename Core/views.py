import calendar
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpResponse
from decimal import Decimal
from datetime import date, datetime
from io import BytesIO
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .backup_utils import backup_payload, restore_payload
from .models import Invoice, Payment
from .permissions import AdminOnlyPermission, InvoicePermission, PaymentPermission
from .serializers import (
    CashierRegistrationSerializer,
    ControlNumberInvoiceSerializer,
    CurrentUserSerializer,
    InvoiceSerializer,
    PaymentSerializer,
    RegisterSerializer,
    RoleAwareTokenObtainPairSerializer,
    UserDirectorySerializer,
    UserWithRolesSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = RoleAwareTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response(
                {'detail': 'Invalid refresh token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({'detail': 'Logged out successfully.'})


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(CurrentUserSerializer(request.user).data)


class RegisterView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            CurrentUserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class RegisterCashierView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        roles = set(request.user.groups.values_list('name', flat=True))
        if not (request.user.is_superuser or roles.intersection({'admin', 'manager'})):
            return Response(
                {'detail': 'Only admin or manager can register cashier.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CashierRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            CurrentUserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('customer', 'customer__profile').all()
    serializer_class = InvoiceSerializer
    permission_classes = [InvoicePermission]

    def get_queryset(self):
        qs = super().get_queryset()
        roles = set(self.request.user.groups.values_list('name', flat=True))
        if self.request.user.is_staff or self.request.user.is_superuser:
            return qs
        if 'cashier' in roles:
            return qs
        return qs.filter(customer=self.request.user)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        if request.user.is_staff or request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Staff users cannot download invoices.')
        invoice = self.get_object()
        customer_uid = getattr(getattr(invoice.customer, 'profile', None), 'uid', 'N/A')
        customer_username = getattr(invoice.customer, 'username', 'N/A')
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        x = 20 * mm
        y = height - (25 * mm)

        pdf.setFont('Helvetica-Bold', 16)
        pdf.drawString(x, y, f'Invoice #{invoice.id}')
        y -= 12 * mm

        pdf.setFont('Helvetica', 11)
        lines = [
            f'Customer UID: {customer_uid}',
            f'Customer Username: {customer_username}',
            f'Amount: {invoice.amount}',
            f'Due Date: {invoice.due_date}',
            f'Status: {invoice.status}',
            f'Total Paid: {invoice.total_paid}',
        ]
        for line in lines:
            pdf.drawString(x, y, line)
            y -= 8 * mm

        pdf.showPage()
        pdf.save()
        buffer.seek(0)

        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="invoice_{invoice.id}.pdf"'
        return response

    @action(detail=True, methods=['post'])
    def generate_control_number(self, request, pk=None):
        invoice = self.get_object()
        if request.user.is_staff or request.user.is_superuser:
            return Response(
                {'detail': 'Only normal users can generate control number.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if invoice.status == Invoice.STATUS_PAID:
            return Response(
                {'detail': 'Control number is only for unpaid invoices.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        already_exists = bool(invoice.control_number)
        control_number = invoice.generate_control_number(save=True)
        return Response(
            {
                'invoice_id': invoice.id,
                'control_number': control_number,
                'generated': not already_exists,
            }
        )

    @action(detail=False, methods=['get'])
    def control_numbers(self, request):
        roles = set(request.user.groups.values_list('name', flat=True))
        if not (request.user.is_staff or request.user.is_superuser or roles.intersection({'cashier', 'admin', 'manager'})):
            return Response([], status=status.HTTP_200_OK)

        query = request.query_params.get('q', '').strip()
        qs = Invoice.objects.select_related('customer', 'customer__profile').filter(
            status=Invoice.STATUS_UNPAID
        ).exclude(control_number__isnull=True).exclude(control_number='')
        if query:
            qs = qs.filter(control_number__icontains=query)
        serializer = ControlNumberInvoiceSerializer(qs.order_by('due_date', 'id')[:200], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def control_history(self, request):
        roles = set(request.user.groups.values_list('name', flat=True))
        if not (request.user.is_staff or request.user.is_superuser or roles.intersection({'cashier', 'admin', 'manager'})):
            return Response([], status=status.HTTP_200_OK)

        query = request.query_params.get('q', '').strip()
        status_filter = request.query_params.get('status', '').strip().lower()
        qs = Invoice.objects.select_related('customer', 'customer__profile').exclude(
            control_number__isnull=True
        ).exclude(control_number='')
        if query:
            qs = qs.filter(control_number__icontains=query)
        if status_filter in [Invoice.STATUS_PAID, Invoice.STATUS_UNPAID]:
            qs = qs.filter(status=status_filter)
        serializer = ControlNumberInvoiceSerializer(qs.order_by('-updated_at', '-id')[:500], many=True)
        return Response(serializer.data)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('invoice', 'invoice__customer', 'invoice__customer__profile').all()
    serializer_class = PaymentSerializer
    permission_classes = [PaymentPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_staff or self.request.user.is_superuser:
            return qs
        return qs.filter(invoice__customer=self.request.user)

    def perform_create(self, serializer):
        invoice = serializer.validated_data['invoice']
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            roles = set(self.request.user.groups.values_list('name', flat=True))
            is_cashier = 'cashier' in roles
            if is_cashier:
                if not invoice.control_number:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({'invoice': 'Invoice has no generated control number.'})
                if invoice.status == Invoice.STATUS_PAID:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({'invoice': 'Invoice is already paid.'})
                serializer.save()
                return
            if invoice.customer_id != self.request.user.id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You can only pay your own invoices.')
            amount = serializer.validated_data.get('amount', Decimal('0'))
            if amount != invoice.amount:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'amount': 'Payment amount must equal invoice amount.'})
        serializer.save()

    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff users can download transaction reports.')

        month = request.query_params.get('month')
        if not month:
            month = datetime.now().strftime('%Y-%m')

        try:
            parsed = datetime.strptime(month, '%Y-%m')
        except ValueError:
            return Response(
                {'detail': 'month must be in YYYY-MM format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_day = date(parsed.year, parsed.month, 1)
        last_day = date(parsed.year, parsed.month, calendar.monthrange(parsed.year, parsed.month)[1])
        transactions = self.get_queryset().filter(payment_date__gte=first_day, payment_date__lte=last_day)

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        x = 15 * mm
        y = height - (20 * mm)

        pdf.setFont('Helvetica-Bold', 14)
        pdf.drawString(x, y, f'Transaction Report - {month}')
        y -= 10 * mm
        pdf.setFont('Helvetica', 10)
        pdf.drawString(x, y, 'payment_id | invoice_id | customer_uid | amount | payment_date | method')
        y -= 7 * mm

        for tx in transactions:
            if y < 20 * mm:
                pdf.showPage()
                y = height - (20 * mm)
                pdf.setFont('Helvetica', 10)
            row = (
                f"{tx.id} | {tx.invoice_id} | "
                f"{getattr(getattr(tx.invoice.customer, 'profile', None), 'uid', '')} | "
                f"{tx.amount} | {tx.payment_date} | {tx.payment_method}"
            )
            pdf.drawString(x, y, row[:115])
            y -= 6 * mm

        pdf.showPage()
        pdf.save()
        buffer.seek(0)

        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="transactions_{month}.pdf"'
        return response


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('profile').all().order_by('username')
    serializer_class = UserWithRolesSerializer
    permission_classes = [AdminOnlyPermission]


class UserDirectoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response([])
        users = (
            User.objects.select_related('profile')
            .filter(is_staff=False, is_superuser=False, profile__isnull=False)
            .order_by('profile__uid')
        )
        return Response(UserDirectorySerializer(users, many=True).data)


class BackupView(APIView):
    permission_classes = [AdminOnlyPermission]

    def get(self, request):
        return Response(backup_payload())


class RestoreView(APIView):
    permission_classes = [AdminOnlyPermission]

    @transaction.atomic
    def post(self, request):
        payload = request.data.get('payload')
        if not isinstance(payload, dict):
            return Response(
                {'detail': 'payload object is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        wipe = bool(request.data.get('wipe', False))
        counts = restore_payload(payload, wipe=wipe)
        return Response(
            {
                'detail': 'Restore completed.',
                'restored': counts,
            }
        )
