from django.contrib import admin
from .models import Invoice, Payment, UserProfile


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'amount', 'due_date', 'status', 'created_at')
    search_fields = ('customer__username', 'customer__profile__uid')
    list_filter = ('status', 'due_date')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'invoice', 'amount', 'payment_method', 'payment_date', 'created_at')
    search_fields = ('invoice__customer__username', 'invoice__customer__profile__uid')
    list_filter = ('payment_method', 'payment_date')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('uid', 'user')
    search_fields = ('uid', 'user__username')
