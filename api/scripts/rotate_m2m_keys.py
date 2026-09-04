#!/usr/bin/env python3
"""
IQISSMexico - Script de Rotación Automatizada de Llaves Secretas M2M.
Diseñado para ejecutarse periódicamente en Coolify, Docker Compose o crontab (e.g. diario a las 00:10 horas).

Acciones realizadas:
1. Rota las claves secretas de comunicación Machine-to-Machine (M2M) de los productos del catálogo.
2. Aplica el estándar de Doble Llave con Periodo de Gracia (Grace Period): la clave anterior
   se preserva en 'api_secret_previous' para que ninguna petición en tránsito sea rechazada.
3. Genera una nueva clave criptográfica de 256 bits (64 caracteres hex) cifrada con AES-256-GCM.

Uso:
  python manage.py security:rotate-keys
  python manage.py security:rotate-keys --slug crm
  python manage.py security:rotate-keys --dry-run
"""

import sys
import secrets
from pathlib import Path
from datetime import datetime
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.database import SessionLocal
from app.models.product import Product
from app.config import settings
from app.lib.crypto import encrypt_token


def run_rotate_keys(slug: Optional[str] = None, dry_run: bool = False):
    print("=" * 64)
    print("  IQISSMexico - Tarea Programada de Rotación de Llaves M2M")
    print(f"  Fecha y Hora UTC: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    if dry_run:
        print("  MODO: SIMULACIÓN (--dry-run). No se persistirán cambios en la BD.")
    print("=" * 64)

    db = SessionLocal()
    try:
        query = db.query(Product).filter(Product.is_active == True)
        if slug:
            query = query.filter(Product.slug == slug.strip().lower())
        else:
            # Rotar productos que manejen aprovisionamiento o tengan clave existente
            query = query.filter(
                (Product.provision_endpoint != None) |
                (Product.api_secret_encrypted != None) |
                (Product.slug == "crm")
            )

        products = query.all()
        if not products:
            print("\n⚠️ No se encontraron productos candidatos para rotación.")
            return

        print(f"\n[1/1] Procesando rotación para {len(products)} producto(s)...")

        rotated_count = 0
        now = datetime.utcnow()

        for p in products:
            new_raw_secret = secrets.token_hex(32)
            new_encrypted_secret = encrypt_token(new_raw_secret, settings.TOKEN_ENCRYPTION_KEY)

            masked_prev = (p.api_secret_encrypted[:8] + "..." if p.api_secret_encrypted else "Ninguna")
            masked_new = new_raw_secret[:6] + "..." + new_raw_secret[-6:]

            print(f"\n  • Producto: [{p.slug}] '{p.name}'")
            print(f"    - Clave previa en BD: {masked_prev} (pasa a periodo de gracia)")
            print(f"    - Nueva clave activa: {masked_new}")

            if not dry_run:
                p.api_secret_previous = p.api_secret_encrypted
                p.api_secret_encrypted = new_encrypted_secret
                p.last_key_rotation_at = now
                rotated_count += 1
            else:
                print("    - [Simulación] No se actualizó el registro.")

        if not dry_run:
            db.commit()
            print("\n" + "=" * 64)
            print(f"  ✅ Rotación completada exitosamente. Total rotados: {rotated_count}")
            print("=" * 64)
        else:
            print("\n" + "=" * 64)
            print(f"  [Simulación finalizada] {len(products)} producto(s) evaluados.")
            print("=" * 64)

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error durante la rotación de claves: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Rotación programada de claves M2M")
    parser.add_argument("--slug", type=str, default=None, help="Slug específico del producto (ej. 'crm')")
    parser.add_argument("--dry-run", action="store_true", help="Simula sin persistir cambios")
    args = parser.parse_args()

    run_rotate_keys(slug=args.slug, dry_run=args.dry_run)
