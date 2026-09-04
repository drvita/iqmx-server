#!/usr/bin/env python3
"""
IQISSMexico - Consola de Gestión y Comandos Artisan-like.
Proporciona comandos de terminal para administración, tareas cron y utilidades de backend.

Uso:
  python manage.py --help
  python manage.py subscriptions:cron [--dry-run]
  python manage.py admin:reset-password
"""

import sys
import argparse
from pathlib import Path

# Asegurar path de importación
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


def main():
    parser = argparse.ArgumentParser(
        prog="python manage.py",
        description="IQISSMexico CLI - Comandos de Gestión y Operación"
    )
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponibles")

    # Comando 1: subscriptions:cron
    sub_cron = subparsers.add_parser(
        "subscriptions:cron",
        help="Ejecuta la tarea diaria de expirar membresías vencidas y activar las programadas."
    )
    sub_cron.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula la ejecución sin alterar la base de datos."
    )

    # Comando 2: admin:reset-password
    subparsers.add_parser(
        "admin:reset-password",
        help="Herramienta interactiva para restablecer la contraseña de un usuario administrador."
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "subscriptions:cron":
        from scripts.cron_subscriptions import run_cron
        run_cron(dry_run=args.dry_run)

    elif args.command == "admin:reset-password":
        from scripts.reset_admin_password import run_reset
        run_reset()

    else:
        print(f"Comando desconocido: {args.command}")
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
