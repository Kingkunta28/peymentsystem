import json
from pathlib import Path

from django.db import transaction
from django.core.management.base import BaseCommand, CommandError

from Core.backup_utils import restore_payload


class Command(BaseCommand):
    help = 'Restore users, invoices, and payments from a JSON backup.'

    def add_arguments(self, parser):
        parser.add_argument('input', type=str, help='Path to backup JSON file.')
        parser.add_argument(
            '--wipe',
            action='store_true',
            help='Delete existing invoices/payments before restore.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        input_path = Path(options['input'])
        if not input_path.exists():
            raise CommandError(f'Backup file not found: {input_path}')

        payload = json.loads(input_path.read_text(encoding='utf-8'))
        counts = restore_payload(payload, wipe=options['wipe'])

        self.stdout.write(
            self.style.SUCCESS(
                "Restore completed from "
                f"{input_path}: {counts['users']} users, {counts['invoices']} invoices, {counts['payments']} payments."
            )
        )
