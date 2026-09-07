#!/usr/bin/env python3
"""
Job 2: Script / Tarea Programada para Avisos Preventivos Inteligentes (Anti-Spam).
Diseñado para ejecutarse periódicamente en Coolify, Docker o crontab (diario a las 09:00 CST).

Estrategia de Negocio:
1. Omite automáticamente suscripciones activas con domiciliación en Mercado Pago (sin spam).
2. Notifica a clientes con suscripciones canceladas por el usuario que vencen en 3 días.
3. Notifica a clientes con pruebas gratuitas (Free Trial) que concluyen en 24 horas.
4. Notifica a clientes con cobros recurrentes rechazados en estado 'past_due'.

Uso:
  python scripts/cron_preventive_alerts.py
  python scripts/cron_preventive_alerts.py --dry-run
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
from app.services.subscription_service import dispatch_preventive_subscription_alerts


def run_cron(dry_run: bool = False):
    print("=" * 68)
    print("  IQISSMexico - Job 2: Avisos Preventivos Selectivos (Anti-Spam)")
    print(f"  Fecha y Hora UTC: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    if dry_run:
        print("  MODO: SIMULACIÓN (--dry-run). No se despacharán correos reales.")
    print("=" * 68)

    db = SessionLocal()

    try:
        results = dispatch_preventive_subscription_alerts(db=db, dry_run=dry_run)

        print(f"\n[1/4] Filtro Anti-Spam (Mercado Pago Activo):")
        print(f"      Suscripciones con cobro automático omitidas: {results['active_skipped_antispam']}")

        print(f"\n[2/4] Suscripciones Canceladas (-3 Días):")
        print(f"      Notificaciones despachadas: {results['cancelled_notified']}")

        print(f"\n[3/4] Pruebas Gratuitas por Concluir (-24 Horas):")
        print(f"      Notificaciones despachadas: {results['trial_notified']}")

        print(f"\n[4/4] Cobros Rechazados Pendientes (past_due):")
        print(f"      Notificaciones despachadas: {results['past_due_notified']}")

        if results["details"]:
            print("\nDetalle de clientes notificados:")
            for d in results["details"]:
                print(f"  • [{d['type']}] Sub #{d['sub_id']} - {d['customer']} ({d['email']})")

        print("\n" + "=" * 68)
        print("  Job 2 finalizado con éxito.")
        print("=" * 68)

    except Exception as e:
        print(f"\n[ERROR CRÍTICO EN JOB 2]: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ejecuta el Job 2 de Avisos Preventivos Inteligentes."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula la ejecución sin despachar correos en Mailtrap."
    )
    args = parser.parse_args()
    run_cron(dry_run=args.dry_run)
