from __future__ import annotations

from pathlib import Path
from typing import Protocol

from app.config import settings


class ForumStorageError(Exception):
    """Error de almacenamiento de archivos del foro."""


class ForumStorageBackend(Protocol):
    """Contrato para backends de almacenamiento de adjuntos del foro."""

    def save(self, key: str, data: bytes) -> None: ...

    def read(self, key: str) -> bytes: ...

    def delete(self, key: str) -> None: ...

    def exists(self, key: str) -> bool: ...


class LocalForumStorage:
    """Almacenamiento en sistema de archivos local con protección contra path traversal."""

    def __init__(self, base_dir: str | Path) -> None:
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_key(self, key: str) -> Path:
        clean_key = (key or "").lstrip("/\\")
        if not clean_key:
            raise ForumStorageError("Clave de archivo vacía.")
        target = (self.base_dir / clean_key).resolve()
        if not target.is_relative_to(self.base_dir):
            raise ForumStorageError("Ruta de archivo fuera del directorio permitido.")
        return target

    def save(self, key: str, data: bytes) -> None:
        target = self._resolve_key(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def read(self, key: str) -> bytes:
        target = self._resolve_key(key)
        if not target.is_file():
            raise FileNotFoundError(f"Archivo no encontrado en almacenamiento: {key}")
        return target.read_bytes()

    def delete(self, key: str) -> None:
        target = self._resolve_key(key)
        if target.is_file():
            target.unlink()

    def exists(self, key: str) -> bool:
        target = self._resolve_key(key)
        return target.is_file()


def get_forum_storage() -> ForumStorageBackend:
    return LocalForumStorage(settings.FORUM_UPLOADS_DIR)
