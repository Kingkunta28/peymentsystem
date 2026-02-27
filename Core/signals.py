from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile


def _next_uid():
    latest = UserProfile.objects.order_by('-id').first()
    if not latest:
        return 'UID001'
    try:
        current = int(latest.uid.replace('UID', ''))
    except ValueError:
        current = latest.id
    return f'UID{current + 1:03d}'


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    # UID is reserved for non-staff users only.
    if instance.is_staff or instance.is_superuser:
        UserProfile.objects.filter(user=instance).delete()
        return
    if created:
        UserProfile.objects.create(user=instance, uid=_next_uid())
        return
    if not hasattr(instance, 'profile'):
        UserProfile.objects.create(user=instance, uid=_next_uid())
