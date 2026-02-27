from datetime import date, datetime
from decimal import Decimal

from django.contrib.auth.models import Group, User

from .models import Invoice, Payment, UserProfile


def backup_payload():
    return {
        'metadata': {'generated_at': datetime.now().isoformat()},
        'users': [
            {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'is_active': user.is_active,
                'roles': list(user.groups.values_list('name', flat=True)),
                'uid': getattr(getattr(user, 'profile', None), 'uid', None),
            }
            for user in User.objects.all().order_by('id')
        ],
        'invoices': list(
            Invoice.objects.values(
                'id',
                'customer_id',
                'control_number',
                'amount',
                'due_date',
                'status',
                'created_at',
                'updated_at',
            )
        ),
        'payments': list(
            Payment.objects.values(
                'id',
                'invoice_id',
                'amount',
                'payment_date',
                'payment_method',
                'notes',
                'created_at',
            )
        ),
    }


def restore_payload(payload, wipe=False):
    users = payload.get('users', [])
    invoices = payload.get('invoices', [])
    payments = payload.get('payments', [])

    if wipe:
        Payment.objects.all().delete()
        Invoice.objects.all().delete()

    user_id_map = {}
    for item in users:
        username = item.get('username')
        if not username:
            continue

        user = User.objects.filter(id=item.get('id')).first()
        if user and user.username != username and User.objects.filter(username=username).exclude(id=user.id).exists():
            username = f'{username}_restored_{item.get("id")}'

        if not user:
            user = User.objects.filter(username=username).first()

        if user:
            user.username = username
            user.email = item.get('email', '')
            user.is_staff = bool(item.get('is_staff', False))
            user.is_superuser = bool(item.get('is_superuser', False))
            user.is_active = bool(item.get('is_active', True))
            user.save()
        else:
            user = User.objects.create(
                id=item.get('id'),
                username=username,
                email=item.get('email', ''),
                is_staff=bool(item.get('is_staff', False)),
                is_superuser=bool(item.get('is_superuser', False)),
                is_active=bool(item.get('is_active', True)),
            )
            user.set_unusable_password()
            user.save()

        role_names = item.get('roles', [])
        groups = Group.objects.filter(name__in=role_names)
        user.groups.set(groups)

        uid = item.get('uid')
        if not user.is_staff and not user.is_superuser and uid:
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.uid = uid
            profile.save()
        else:
            UserProfile.objects.filter(user=user).delete()

        user_id_map[item.get('id')] = user.id

    invoice_ids = set()
    for item in invoices:
        backup_customer_id = item.get('customer_id')
        resolved_customer_id = user_id_map.get(backup_customer_id, backup_customer_id)
        if resolved_customer_id and not User.objects.filter(id=resolved_customer_id).exists():
            resolved_customer_id = None

        invoice, _ = Invoice.objects.update_or_create(
            id=item['id'],
            defaults={
                'customer_id': resolved_customer_id,
                'control_number': item.get('control_number', ''),
                'amount': Decimal(str(item['amount'])),
                'due_date': date.fromisoformat(item['due_date']),
                'status': item.get('status', Invoice.STATUS_UNPAID),
            },
        )
        invoice_ids.add(invoice.id)

    for item in payments:
        if item['invoice_id'] not in invoice_ids and not Invoice.objects.filter(id=item['invoice_id']).exists():
            continue
        Payment.objects.update_or_create(
            id=item['id'],
            defaults={
                'invoice_id': item['invoice_id'],
                'amount': Decimal(str(item['amount'])),
                'payment_date': date.fromisoformat(item['payment_date']),
                'payment_method': item['payment_method'],
                'notes': item.get('notes', ''),
            },
        )

    for invoice in Invoice.objects.all():
        invoice.refresh_status_from_payments(save=True)

    return {'users': len(users), 'invoices': len(invoices), 'payments': len(payments)}
