#!/usr/bin/env python3
"""
Job 4: Script de Mantenimiento Preventivo y Limpieza del Sistema (System Cleanup).
Diseñado para ejecutarse periódicamente en Coolify, Docker o crontab (semanal, domingos a las 03:00 CST).

Estrategia Operativa:
1. Higiene de Redis:
   - Purga claves huérfanas de verificación de correo.
   - Libera tokens residuales de usuarios que ya validaron su email.
   - Expulsa claves desincronizadas o con TTL expirado.
2. Mantenimiento de PostgreSQL:
   - Depura eventos de webhook entregados con más de 30 días.
   - Depura eventos de webhook fallidos con más de 60 días.
3. No satura Telegram de alertas rutinarias; emite logs detallados.

Uso:
  python scripts/cron_system_cleanup.py
  python scripts/cron_system_cleanup.py --dry-run
  python manage.py system:cleanup [--dry-run]
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
from app.services.maintenance_service import run_system_maintenance


def run_cleanup(dry_run: bool = False):
    print("=" * 68)
    print("  IQISSMexico - Job 4: Mantenimiento Preventivo y Limpieza del Sistema")
    print(f"  Fecha y Hora UTC: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    if dry_run:
        print("  MODO: SIMULACIÓN (--dry-run). No se eliminarán registros ni claves.")
    print("=" * 68)

    db = SessionLocal()

    try:
        report = run_system_maintenance(db=db, dry_run=dry_run)

        tokens = report["tokens"]
        events = report["events"]

        print("\n[1/2] Limpieza de Claves Efímeras y Tokens (Redis):")
        print(f"  • Claves de tokens escaneadas:         {tokens.get('scanned_token_keys', 0)}")
        print(f"  • Claves de usuarios escaneadas:       {tokens.get('scanned_user_keys', 0)}")
        print(f"  • Purgadas (Usuario ya verificado):    {tokens.get('purged_already_verified', 0)}")
        print(f"  • Purgadas (Usuario inexistente):      {tokens.get('purged_nonexistent_user', 0)}")
        print(f"  • Purgadas (Claves huérfanas):         {tokens.get('purged_orphaned_keys', 0)}")
        print(f"  • Total claves liberadas en Redis:     {tokens.get('total_purged', 0)}")

        print("\n[2/2] Depuración de Eventos de Webhooks (PostgreSQL):")
        print(f"  • Eventos exitosos (>30d) purgados:    {events.get('purged_successful', 0)}")
        print(f"  • Eventos fallidos (>60d) purgados:    {events.get('purged_failed', 0)}")
        print(f"  • Total filas liberadas en BD:         {events.get('total_purged', 0)}")

        print(f"\nDuración total: {report['duration_seconds']}s")
        print("=" * 68)
        print("  Job 4 finalizado exitosamente.")
        print("=" * 68)

    except Exception as e:
        print(f"\n[ERROR CRÍTICO] Falló el mantenimiento del sistema: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="IQISSMexico - Job 4: Limpieza de Claves Efímeras y Archivos Huérfanos."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula la limpieza sin eliminar claves de Redis ni registros de base de datos."
    )
    args = parser.parse_args()
    run_cleanup(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
