#!/usr/bin/env python3
"""
Script Interactivo para Restablecer Contraseñas de Administradores.
Diseñado para ejecutarse en la terminal de Coolify o Docker.

Uso:
  python scripts/reset_admin_password.py
"""

import sys
import re
import getpass
from pathlib import Path
from datetime import datetime

# Asegurar que el directorio raíz de la API esté en el path de importaciones
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.database import SessionLocal
from app.models.user import User
from app.models.role import Role
from app.lib.security import hash_password


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Valida que la contraseña cumpla con los estándares de seguridad para un Administrador:
    - Al menos 8 caracteres
    - Al menos una letra mayúscula
    - Al menos una letra minúscula
    - Al menos un dígito
    - Al menos un símbolo o carácter especial
    """
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres."
    if not re.search(r"[A-Z]", password):
        return False, "Debe contener al menos una letra mayúscula (A-Z)."
    if not re.search(r"[a-z]", password):
        return False, "Debe contener al menos una letra minúscula (a-z)."
    if not re.search(r"\d", password):
        return False, "Debe contener al menos un número (0-9)."
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?~`]", password):
        return False, "Debe contener al menos un carácter especial (!@#$%^&* etc.)."
    return True, "OK"


def prompt_secure_password() -> str:
    """Solicita la contraseña con validación y confirmación segura."""
    while True:
        try:
            pwd = getpass.getpass("  Ingresa la nueva contraseña: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nOperación cancelada.")
            sys.exit(0)

        is_valid, msg = validate_password_strength(pwd)
        if not is_valid:
            print(f"  ❌ Contraseña débil: {msg}")
            print("  Por favor intenta con una contraseña más robusta.\n")
            continue

        try:
            confirm = getpass.getpass("  Confirma la nueva contraseña: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nOperación cancelada.")
            sys.exit(0)

        if pwd != confirm:
            print("  ❌ Las contraseñas no coinciden. Intenta de nuevo.\n")
            continue

        return pwd


def run_reset():
    print("=" * 64)
    print("  IQISSMexico - Gestión de Contraseñas de Administrador")
    print(f"  Terminal de Gestión · {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 64)

    db = SessionLocal()
    try:
        # Buscar rol 'admin'
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            print("❌ No se encontró el rol 'admin' en el catálogo de roles.")
            sys.exit(1)

        # Consultar los últimos 10 administradores registrados
        admin_users = db.query(User).filter(
            (User.role_id == admin_role.id) | (User.roles.any(Role.id == admin_role.id))
        ).order_by(User.id.desc()).limit(10).all()

        if not admin_users:
            print("❌ No se encontraron usuarios con rol de Administrador en la base de datos.")
            sys.exit(1)

        print("\nSelecciona el Administrador cuya contraseña deseas restablecer:\n")
        for idx, u in enumerate(admin_users, start=1):
            print(f"  [{idx}] {u.name} (Email: {u.email} | ID: #{u.id})")

        print("  [0] Cancelar y Salir\n")

        # Leer selección del operador
        choice_idx = None
        while choice_idx is None:
            raw = input("Selecciona una opción [1-{} o 0]: ".format(len(admin_users))).strip()
            if raw == "0":
                print("\nOperación cancelada por el usuario.")
                sys.exit(0)
            if raw.isdigit() and 1 <= int(raw) <= len(admin_users):
                choice_idx = int(raw) - 1
            else:
                print("  Opción no válida. Ingresa un número de la lista.")

        target_user = admin_users[choice_idx]
        print("\n" + "-" * 64)
        print(f"  Usuario seleccionado: {target_user.name}")
        print(f"  Email: {target_user.email} (ID #{target_user.id})")
        print("-" * 64)
        print("  Requisitos de contraseña: Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.\n")

        new_password = prompt_secure_password()

        # Generar hash y actualizar
        target_user.password_hash = hash_password(new_password)
        db.commit()

        print("\n" + "=" * 64)
        print("  ✅ CONTRASEÑA ACTUALIZADA EXITOSAMENTE")
        print(f"  Administrador: {target_user.name} ({target_user.email})")
        print("  El nuevo acceso se encuentra activo de inmediato.")
        print("=" * 64 + "\n")

    except KeyboardInterrupt:
        print("\nOperación interrumpida.")
        db.rollback()
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR CRÍTICO]: {e}", file=sys.stderr)
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run_reset()
