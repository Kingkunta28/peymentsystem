import os

from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create/update default admin and manager users from environment variables."

    def handle(self, *args, **options):
        admin_username = os.getenv("ADMIN_USERNAME", "Admin")
        admin_password = os.getenv("ADMIN_PASSWORD", "Admin@123")
        manager_username = os.getenv("MANAGER_USERNAME", "Manager")
        manager_password = os.getenv("MANAGER_PASSWORD", "Manager@123")

        admin, _ = User.objects.get_or_create(username=admin_username)
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password(admin_password)
        admin.save()
        admin_group, _ = Group.objects.get_or_create(name="admin")
        admin.groups.set([admin_group])

        manager, _ = User.objects.get_or_create(username=manager_username)
        manager.is_staff = True
        manager.is_superuser = False
        manager.set_password(manager_password)
        manager.save()

        manager_group, _ = Group.objects.get_or_create(name="manager")
        manager.groups.add(manager_group)

        self.stdout.write(
            self.style.SUCCESS(
                f"Default users configured: {admin_username} (admin), {manager_username} (manager)"
            )
        )
