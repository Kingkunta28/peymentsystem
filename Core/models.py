from django.db import models
from django.db.models import Sum
from django.contrib.auth.models import User
from django.utils import timezone
from random import SystemRandom


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    uid = models.CharField(max_length=20, unique=True)

    class Meta:
        ordering = ['uid']

    def __str__(self):
        return f'{self.uid} - {self.user.username}'


class Invoice(models.Model):
    STATUS_UNPAID = 'unpaid'
    STATUS_PAID = 'paid'
    STATUS_CHOICES = [
        (STATUS_UNPAID, 'Unpaid'),
        (STATUS_PAID, 'Paid'),
    ]

    customer = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='invoices',
        null=True,
        blank=True,
    )
    control_number = models.CharField(max_length=9, unique=True, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=STATUS_UNPAID,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        customer = self.customer.profile.uid if self.customer_id and hasattr(self.customer, 'profile') else 'N/A'
        return f"Invoice #{self.pk} - {customer}"

    @property
    def total_paid(self):
        aggregate = self.payments.aggregate(total=Sum('amount'))
        return aggregate.get('total') or 0

    def refresh_status_from_payments(self, save=True):
        self.status = (
            self.STATUS_PAID
            if self.total_paid >= self.amount
            else self.STATUS_UNPAID
        )
        if save:
            self.save(update_fields=['status', 'updated_at'])

    def generate_control_number(self, save=True):
        if self.control_number:
            return self.control_number
        rng = SystemRandom()
        for _ in range(100):
            candidate = str(rng.randrange(0, 1_000_000_000)).zfill(9)
            if not Invoice.objects.filter(control_number=candidate).exclude(id=self.id).exists():
                self.control_number = candidate
                break
        else:
            raise ValueError('Unable to generate unique control number.')
        if save:
            self.save(update_fields=['control_number', 'updated_at'])
        return self.control_number


class Payment(models.Model):
    METHOD_CASH = 'cash'
    METHOD_BANK_TRANSFER = 'bank_transfer'
    METHOD_MOBILE_MONEY = 'mobile_money'
    METHOD_CARD = 'card'
    METHOD_CHOICES = [
        (METHOD_CASH, 'Cash'),
        (METHOD_BANK_TRANSFER, 'Bank transfer'),
        (METHOD_MOBILE_MONEY, 'Mobile money'),
        (METHOD_CARD, 'Card payment'),
    ]

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField(default=timezone.now)
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"Payment #{self.pk} for invoice #{self.invoice_id}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.invoice.refresh_status_from_payments(save=True)

    def delete(self, *args, **kwargs):
        invoice = self.invoice
        super().delete(*args, **kwargs)
        invoice.refresh_status_from_payments(save=True)
