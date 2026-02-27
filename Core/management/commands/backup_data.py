import json
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand
from django.core.serializers.json import DjangoJSONEncoder

from Core.backup_utils import backup_payload


class Command(BaseCommand):
    help = 'Backup users, invoices, and payments to a JSON file.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default='',
            help='Output file path. Defaults to backups/backup_YYYYmmdd_HHMMSS.json',
        )

    def handle(self, *args, **options):
        output = options['output']
        if not output:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output = f'backups/backup_{timestamp}.json'

        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        payload = backup_payload()

        output_path.write_text(
            json.dumps(payload, cls=DjangoJSONEncoder, indent=2),
            encoding='utf-8',
        )
        self.stdout.write(self.style.SUCCESS(f'Backup saved to {output_path}'))
