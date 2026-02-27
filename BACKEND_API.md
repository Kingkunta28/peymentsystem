# Payment Management System Backend (Django)

## Setup

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_roles
python manage.py createsuperuser
python manage.py runserver
```

Base URL: `http://127.0.0.1:8000/api/`

## Authentication (JWT)

- `POST /api/auth/register/`
  - Body: `{ "username": "...", "email": "...", "password": "..." }`
  - Creates user and auto-assigns next UID (e.g. `UID005`)
- `POST /api/auth/login/`
  - Body: `{ "username": "...", "password": "..." }`
- `POST /api/auth/refresh/`
  - Body: `{ "refresh": "..." }`
- `POST /api/auth/logout/`
  - Body: `{ "refresh": "..." }`
- `GET /api/auth/me/`

Use header:

```http
Authorization: Bearer <access_token>
```

## Roles

Supported roles: `admin`, `manager`, `cashier` (stored as Django groups).
Only non-staff users get an automatic unique ID in format `UID001`, `UID002`, etc.
Staff users (admin/manager/superuser) do not get a UID.

- Admin: full access (users, invoices, payments)
- Manager: view/create/update invoices, read payments
- Cashier: read invoices, create/read payments (normal user, non-staff)

Assign roles by adding users to groups via Django admin or `POST /api/users/` as admin.

## Invoice Endpoints

- `GET /api/invoices/`
- `POST /api/invoices/`
- `GET /api/invoices/{id}/`
- `GET /api/invoices/{id}/download/` (downloads invoice PDF file)
- `PUT/PATCH /api/invoices/{id}/`
- `DELETE /api/invoices/{id}/` (admin only)

Invoice fields:
- `customer` (user numeric id)
- `customer_uid` (read-only)
- `customer_username` (read-only)
- `amount`
- `due_date`
- `status` (auto-managed: paid/unpaid)
- `total_paid` (read-only)

User directory for UID selection:
- `GET /api/users/directory/` -> `[{ id, uid, username }]`
  - Available to staff only.

Customer access rule:
- Non-staff users can only view/download their own invoices and create/view payments for their own invoices.
- Non-staff users cannot create/update/delete invoices.

## Payment Endpoints

- `GET /api/payments/`
- `POST /api/payments/`
- `GET /api/payments/{id}/`
- `PUT/PATCH /api/payments/{id}/` (admin only)
- `DELETE /api/payments/{id}/` (admin only)

Payment fields:
- `invoice`
- `amount`
- `payment_date`
- `payment_method` (`cash`, `bank_transfer`, `mobile_money`, `card`)
- `notes`

When a payment is created/updated/deleted, invoice status is recalculated automatically.

## User Management (Admin only)

- `GET /api/users/`
- `POST /api/users/`
- `GET /api/users/{id}/`
- `PUT/PATCH /api/users/{id}/`
- `DELETE /api/users/{id}/`

Request body for create/update can include:
- `username`
- `email`
- `password`
- `role_names` (e.g. `["cashier"]`)

## Backup and Recovery

Web API (admin only):
- `GET /api/admin/backup/` returns backup payload JSON
- `POST /api/admin/restore/` with body:
  - `{ "payload": { ...backup_json... }, "wipe": true|false }`

Backup now includes:
- users (roles + UID info)
- invoices
- payments

Backup:

```bash
python manage.py backup_data
python manage.py backup_data --output backups/my_snapshot.json
```

Restore:

```bash
python manage.py restore_data backups/my_snapshot.json
python manage.py restore_data backups/my_snapshot.json --wipe
```

`--wipe` removes current invoices/payments before restore.
