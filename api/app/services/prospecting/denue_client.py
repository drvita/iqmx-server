import os
import json
import logging
from typing import List, Dict, Any, Optional
from urllib.parse import quote
import httpx

from app.config import settings

logger = logging.getLogger("uvicorn.error")

DENUE_BASE_URL = getattr(settings, "DENUE_API_BASE_URL", "https://www.inegi.org.mx/app/api/denue/v1/consulta/").rstrip("/")

class DenueClient:
    """
    Cliente oficial para la API de DENUE (INEGI).
    Soporta BuscarEntidad y Ficha con tolerancia a strings JSON dobles y paginación.
    """

    def __init__(self, token: Optional[str] = None):
        self.token = token or getattr(settings, "DENUE_API_TOKEN", None) or os.getenv("DENUE_API_TOKEN", "")
        self.base_url = DENUE_BASE_URL

    def is_configured(self) -> bool:
        return bool(self.token and self.token.strip() and self.token != "your_inegi_denue_token_here")

    async def _get(self, path_segments: List[str]) -> List[Dict[str, Any]]:
        if not self.is_configured():
            logger.warning("[denue] Token de DENUE no configurado o inválido.")
            return []

        # Codificar cada segmento preservando comas para rangos si aplica
        encoded_segments = [quote(str(seg), safe=",") for seg in path_segments]
        url = f"{self.base_url}/{'/'.join(encoded_segments)}/{self.token}"

        # Timeout generoso de 25s por lentitud conocida en servidores de INEGI
        async with httpx.AsyncClient(timeout=25.0) as client:
            try:
                res = await client.get(url)
                if res.status_code != 200:
                    logger.error(f"[denue] Error HTTP {res.status_code} consultando DENUE: {res.text[:200]}")
                    return []

                raw = res.json()
                # Tratamiento de discrepancia documentada: doble codificación JSON
                if isinstance(raw, str):
                    raw = json.loads(raw)

                if isinstance(raw, list):
                    return raw
                elif isinstance(raw, dict):
                    return [raw]
                return []
            except Exception as e:
                logger.error(f"[denue] Excepción en llamada a DENUE: {e}")
                return []

    async def search_by_entity(
        self,
        condicion: str,
        entidad: str = "06",
        registro_inicial: int = 1,
        registro_final: int = 100
    ) -> List[Dict[str, Any]]:
        """
        GET /BuscarEntidad/{condicion}/{entidad}/{registro_inicial}/{registro_final}/{token}
        Ejemplo entidad '06' = Colima. Máximo 100 registros por llamada.
        """
        clean_condicion = condicion.strip() or "todos"
        clean_entidad = str(entidad).zfill(2)
        return await self._get([
            "BuscarEntidad",
            clean_condicion,
            clean_entidad,
            str(registro_inicial),
            str(registro_final)
        ])

    async def get_ficha(self, denue_id: str) -> Optional[Dict[str, Any]]:
        """
        GET /Ficha/{id}/{token}
        """
        data = await self._get(["Ficha", str(denue_id)])
        return data[0] if data else None
