#!/usr/bin/env python3
"""
Job 3: Resumen Ejecutivo Matutino (Morning Digest).
Diseñado para ejecutarse periódicamente en Coolify, Docker o crontab (diario a las 07:00, 08:00 u 09:00 CST).

Estrategia Operativa:
1. Extrae métricas clave de las últimas 24 horas:
   - Nuevos leads con correo validado.
   - Renovaciones automáticas cobradas exitosamente (monto total en MXN).
   - Cobros rebotados o fallidos con tarjeta.
   - Cuentas suspendidas / pausadas por vencimiento.
2. Identifica cuentas con periodos de prueba o cancelaciones próximas en 24-48 horas.
3. Despacha un único mensaje consolidado y elegante en Markdown a los administradores vía Telegram.

Uso:
  python scripts/cron_morning_digest.py
  python scripts/cron_morning_digest.py --dry-run
  python manage.py digest:morning [--dry-run]
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
from app.services.subscription_service import compile_morning_digest
from app.services.notifications.manager import NotificationManager


def run_digest(dry_run: bool = False):
    print("=" * 68)
    print("  IQISSMexico - Job 3: Resumen Ejecutivo Matutino (Morning Digest)")
    print(f"  Fecha y Hora UTC: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    if dry_run:
        print("  MODO: SIMULACIÓN (--dry-run). No se emitirá mensaje a Telegram.")
    print("=" * 68)

    db = SessionLocal()

    try:
        data = compile_morning_digest(db=db)

        print("\n[Métricas Compiladas (Últimas 24 Horas)]")
        print(f"  • Leads Validados:             {data['leads_count']}")
        print(f"  • Renovaciones Procesadas:      {data['approved_payments_count']} (${data['total_revenue']:,.2f} MXN)")
        print(f"  • Cobros Fallidos / Rebotados:  {data['failed_payments_count']}")
        print(f"  • Cuentas Suspendidas:          {data['expired_subs_count']}")
        print(f"  • Cierres / Pruebas Próximas:   {data['upcoming_count']}")

        print("\n[Mensaje Estructurado para Telegram]")
        print("-" * 50)
        print(data["message"])
        print("-" * 50)

        if not dry_run:
            dispatch_result = NotificationManager.notify_admins(
                message=data["message"],
                db=db,
                parse_mode="Markdown"
            )
            print(f"\n[Despacho a Administradores (Telegram)]")
            print(f"  • Estado:    {dispatch_result.get('status')}")
            print(f"  • Enviados:  {dispatch_result.get('sent', 0)}")
            print(f"  • Fallidos:  {dispatch_result.get('failed', 0)}")
            if dispatch_result.get("reason"):
                print(f"  • Motivo:    {dispatch_result.get('reason')}")
        else:
            print("\n[Simulación] Despacho a Telegram omitido por bandera --dry-run.")

        print("\n" + "=" * 68)
        print("  Resumen Ejecutivo Matutino finalizado exitosamente.")
        print("=" * 68)

    except Exception as e:
        print(f"\n[ERROR CRÍTICO] Falló la ejecución del resumen matutino: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="IQISSMexico - Job 3: Resumen Ejecutivo Matutino a Administradores."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula la extracción y formatea el mensaje en consola sin enviar a Telegram."
    )
    args = parser.parse_args()
    run_digest(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
