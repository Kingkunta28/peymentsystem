from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create default roles/groups for RBAC.'

    def handle(self, *args, **options):
        for role in ['admin', 'manager', 'cashier']:
            Group.objects.get_or_create(name=role)
        self.stdout.write(self.style.SUCCESS('Roles seeded: admin, manager, cashier'))
