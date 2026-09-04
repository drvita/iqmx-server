#!/usr/bin/env python3
"""
Script / Job de Cron para la Gestión Automatizada de Membresías.
Diseñado para ejecutarse periódicamente en Coolify, Docker o crontab (e.g. diario a las 00:01).

Acciones realizadas:
1. Expira membresías activas o de prueba ('active', 'trial') cuya fecha de vigencia ya concluyó.
2. Activa membresías en espera programada ('scheduled') cuya fecha de inicio haya llegado.

Uso:
  python scripts/cron_subscriptions.py
  python scripts/cron_subscriptions.py --dry-run
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime

# Asegurar que el directorio raíz de la API esté en el path de importaciones
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.database import SessionLocal
from app.services.subscription_service import (
    expire_due_subscriptions,
    activate_due_scheduled_subscriptions,
)
from app.models.customer_subscription import CustomerSubscription


def run_cron(dry_run: bool = False):
    print("=" * 64)
    print("  IQISSMexico - Tarea Cron de Membresías y Vigencias")
    print(f"  Fecha y Hora UTC: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    if dry_run:
        print("  MODO: SIMULACIÓN (--dry-run). No se aplicarán cambios a la BD.")
    print("=" * 64)

    db = SessionLocal()
    now = datetime.utcnow()

    try:
        # 1. Identificar membresías por expirar
        query_expire = db.query(CustomerSubscription).filter(
            CustomerSubscription.status.in_(["active", "trial"]),
            CustomerSubscription.current_period_end <= now
        )
        to_expire_count = query_expire.count()
        print(f"\n[1/2] Revisión de membresías vencidas...")
        print(f"      Membresías encontradas por vencer: {to_expire_count}")

        if to_expire_count > 0:
            for s in query_expire.all():
                cust_name = s.customer.company_name if s.customer else f"ID {s.customer_id}"
                plan_name = s.plan.name if s.plan else f"Plan #{s.plan_id}"
                print(f"      - Sub #{s.id} ({cust_name}) | Plan: {plan_name} | Venció: {s.current_period_end}")

            if not dry_run:
                expired_list = expire_due_subscriptions(db)
                print(f"      -> Exitosamente cambiadas a 'expired': {len(expired_list)}")
            else:
                print("      -> [DRY-RUN] Omitiendo actualización a 'expired'.")
        else:
            print("      -> Ninguna membresía vencida pendiente.")

        # 2. Identificar membresías programadas que deben activarse
        query_scheduled = db.query(CustomerSubscription).filter(
            CustomerSubscription.status == "scheduled",
            CustomerSubscription.current_period_start <= now
        )
        to_activate_count = query_scheduled.count()
        print(f"\n[2/2] Revisión de activaciones programadas (scheduled)...")
        print(f"      Membresías listas para iniciar: {to_activate_count}")

        if to_activate_count > 0:
            for s in query_scheduled.all():
                cust_name = s.customer.company_name if s.customer else f"ID {s.customer_id}"
                plan_name = s.plan.name if s.plan else f"Plan #{s.plan_id}"
                print(f"      - Sub #{s.id} ({cust_name}) | Plan: {plan_name} | Fecha Inicio: {s.current_period_start}")

            if not dry_run:
                activated_list = activate_due_scheduled_subscriptions(db)
                print(f"      -> Exitosamente activadas a 'active': {len(activated_list)}")
            else:
                print("      -> [DRY-RUN] Omitiendo activación.")
        else:
            print("      -> Ninguna membresía programada pendiente de iniciar.")

        print("\n" + "=" * 64)
        print("  Tarea finalizada con éxito.")
        print("=" * 64)

    except Exception as e:
        print(f"\n[ERROR CRÍTICO EN TAREA CRON]: {e}", file=sys.stderr)
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Cron Job de Membresías IQISSMexico")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula la ejecución sin realizar cambios en la base de datos."
    )
    args = parser.parse_args()
    run_cron(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
