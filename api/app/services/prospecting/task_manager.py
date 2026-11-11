import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.prospecting import (
    ProspectingCampaign,
    ProspectingRun,
    ProspectingBusiness,
    ProspectingSource,
)
from app.services.prospecting.denue_client import DenueClient
from app.services.prospecting.enrichment_scraper import EnrichmentScraper

logger = logging.getLogger("uvicorn.error")

class ProspectingTaskManager:
    """
    Gestor de ejecuciones asíncronas para Prospección:
    - Control de tarea única activa.
    - Ejecución desacoplada en segundo plano con throttling (pausa obligatoria entre negocios).
    - Monitoreo en vivo de estado, contadores y errores.
    """

    def __init__(self):
        self._active_task: Optional[asyncio.Task] = None
        self._cancel_requested: bool = False
        self._current_run_id: Optional[int] = None
        self._current_status: Dict[str, Any] = {
            "is_running": False,
            "run_id": None,
            "campaign_id": None,
            "campaign_name": "",
            "stage": "idle",  # 'discovery' | 'enrichment' | 'idle'
            "progress_percent": 0,
            "current_business_name": "",
            "total_found": 0,
            "new_added": 0,
            "updated_count": 0,
            "enriched_count": 0,
            "errors_count": 0,
            "message": "Sin tareas activas"
        }

    def get_live_status(self) -> Dict[str, Any]:
        return dict(self._current_status)

    def cancel_active_run(self) -> bool:
        if self._active_task and not self._active_task.done():
            self._cancel_requested = True
            self._current_status["message"] = "Cancelación solicitada por el usuario..."
            return True
        return False

    def is_busy(self) -> bool:
        return self._active_task is not None and not self._active_task.done()

    def calculate_completeness_score(self, b: ProspectingBusiness) -> int:
        """
        Ranking determinista de completitud de datos (0 a 100 puntos):
        - Teléfono: +35 pts
        - Sitio Web: +25 pts
        - Correo: +20 pts
        - Ubicación exacta (Calle + Lat/Lng): +10 pts
        - Coincidencia de estrato y giro: +10 pts
        """
        score = 0
        if b.phone and b.phone.strip():
            score += 35
        if b.website_url and b.website_url.strip():
            score += 25
        if b.email and b.email.strip():
            score += 20
        if (b.street and b.street.strip()) or (b.latitude and b.longitude):
            score += 10
        if b.stratum and b.stratum.strip():
            score += 10
        return min(100, score)

    def start_campaign_run(self, campaign_id: int, run_type: str = "all") -> int:
        """
        Inicia el proceso en segundo plano. run_type: 'discovery', 'enrichment', o 'all'.
        Retorna el run_id recién creado.
        """
        if self.is_busy():
            raise RuntimeError("Ya existe una tarea de prospección en ejecución.")

        db: Session = SessionLocal()
        try:
            campaign = db.query(ProspectingCampaign).filter(ProspectingCampaign.id == campaign_id).first()
            if not campaign:
                raise ValueError("Campaña no encontrada")

            new_run = ProspectingRun(
                campaign_id=campaign.id,
                run_type=run_type,
                status="running",
                started_at=datetime.utcnow()
            )
            db.add(new_run)
            db.commit()
            db.refresh(new_run)
            run_id = new_run.id

            self._cancel_requested = False
            self._current_run_id = run_id
            self._current_status = {
                "is_running": True,
                "run_id": run_id,
                "campaign_id": campaign.id,
                "campaign_name": campaign.name,
                "stage": "starting",
                "progress_percent": 0,
                "current_business_name": "Iniciando proceso...",
                "total_found": 0,
                "new_added": 0,
                "updated_count": 0,
                "enriched_count": 0,
                "errors_count": 0,
                "message": "Inicializando conectores..."
            }

            # Lanzar corutina en segundo plano de manera segura en el loop principal
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.get_event_loop()

            self._active_task = loop.create_task(self._execute_pipeline(run_id, campaign.id, run_type))
            return run_id
        finally:
            db.close()

    async def _execute_pipeline(self, run_id: int, campaign_id: int, run_type: str):
        denue_client = DenueClient()
        enricher = EnrichmentScraper()

        db: Session = SessionLocal()
        try:
            campaign = db.query(ProspectingCampaign).filter(ProspectingCampaign.id == campaign_id).first()
            run = db.query(ProspectingRun).filter(ProspectingRun.id == run_id).first()
            if not campaign or not run:
                return

            # ==============================================================
            # PASO 1: DESCUBRIMIENTO EN DENUE
            # ==============================================================
            if run_type in ["discovery", "all"]:
                self._current_status["stage"] = "discovery"
                self._current_status["message"] = f"Consultando DENUE INEGI para {campaign.name}..."

                keywords = [k.strip() for k in (campaign.search_keywords or "estetica").split(",") if k.strip()]
                all_raw_businesses: List[Dict[str, Any]] = []

                for kw in keywords:
                    if self._cancel_requested:
                        break
                    self._current_status["current_business_name"] = f"Buscando giro: {kw}"
                    # Paginación de hasta 200 registros por palabra clave en la entidad (Colima = 06)
                    page_1 = await denue_client.search_by_entity(
                        condicion=kw,
                        entidad=campaign.state_code or "06",
                        registro_inicial=1,
                        registro_final=100
                    )
                    all_raw_businesses.extend(page_1)

                    if len(page_1) == 100 and not self._cancel_requested:
                        # Breve pausa para no saturar API INEGI
                        await asyncio.sleep(1.0)
                        page_2 = await denue_client.search_by_entity(
                            condicion=kw,
                            entidad=campaign.state_code or "06",
                            registro_inicial=101,
                            registro_final=200
                        )
                        all_raw_businesses.extend(page_2)

                # Deduplicar en memoria por Id
                unique_denue = {}
                for item in all_raw_businesses:
                    d_id = str(item.get("Id") or item.get("id") or "").strip()
                    if d_id and d_id not in unique_denue:
                        unique_denue[d_id] = item

                self._current_status["total_found"] = len(unique_denue)
                run.total_found = len(unique_denue)
                db.commit()

                # Guardar o actualizar en base de datos
                for d_id, raw in unique_denue.items():
                    if self._cancel_requested:
                        break

                    nombre = raw.get("Nombre") or raw.get("nombre") or "Sin nombre"
                    existing = db.query(ProspectingBusiness).filter(ProspectingBusiness.denue_id == d_id).first()

                    # Mapeo de campos DENUE
                    data_mapped = {
                        "campaign_id": campaign.id,
                        "clee": raw.get("CLEE") or raw.get("clee"),
                        "name": nombre[:255],
                        "razon_social": (raw.get("Razon_social") or raw.get("razon_social") or None),
                        "scian_code": raw.get("Clase_actividad_id") or raw.get("clase_actividad_id") or campaign.scian_codes,
                        "scian_activity": (raw.get("Clase_actividad") or raw.get("clase_actividad") or None),
                        "stratum": (raw.get("Estrato") or raw.get("estrato") or None),
                        "phone": (raw.get("Telefono") or raw.get("telefono") or None),
                        "email": (raw.get("Correo_e") or raw.get("correo_e") or None),
                        "website_url": (raw.get("Sitio_internet") or raw.get("sitio_internet") or None),
                        "street": (raw.get("Calle") or raw.get("calle") or None),
                        "ext_number": (raw.get("Num_Exterior") or raw.get("num_exterior") or None),
                        "int_number": (raw.get("Num_Interior") or raw.get("num_interior") or None),
                        "neighborhood": (raw.get("Colonia") or raw.get("colonia") or None),
                        "postal_code": (raw.get("CP") or raw.get("cp") or None),
                        "locality": (raw.get("Localidad") or raw.get("localidad") or None),
                        "municipality": (raw.get("Municipio") or raw.get("municipio") or campaign.municipality_name),
                        "state": (raw.get("Entidad") or raw.get("entidad") or campaign.state_name),
                        "latitude": str(raw.get("Latitud") or raw.get("latitud") or ""),
                        "longitude": str(raw.get("Longitud") or raw.get("longitud") or ""),
                        "last_discovered_at": datetime.utcnow()
                    }

                    if existing:
                        for k, v in data_mapped.items():
                            if v is not None:
                                setattr(existing, k, v)
                        run.updated_count += 1
                        self._current_status["updated_count"] += 1
                    else:
                        b_new = ProspectingBusiness(
                            denue_id=d_id,
                            status="pending_enrichment",
                            **data_mapped
                        )
                        db.add(b_new)
                        db.flush()
                        # Registrar fuente DENUE
                        src = ProspectingSource(
                            business_id=b_new.id,
                            source_type="denue",
                            source_url=f"https://www.inegi.org.mx/app/api/denue/v1/consulta/Ficha/{d_id}",
                            confidence_level="confirmed",
                            http_status=200,
                            summary=f"Descubierto vía DENUE API (Estrato: {b_new.stratum})",
                            extracted_data=raw
                        )
                        db.add(src)
                        run.new_added += 1
                        self._current_status["new_added"] += 1

                campaign.last_run_at = datetime.utcnow()
                db.commit()

            # ==============================================================
            # PASO 2: ENRIQUECIMIENTO (SCRAPING LENTO CON THROTTLING 1.5S)
            # ==============================================================
            if run_type in ["enrichment", "all"] and not self._cancel_requested:
                self._current_status["stage"] = "enrichment"

                # Obtener candidatos a enriquecer (primero los que tienen web o teléfono)
                pending_businesses = db.query(ProspectingBusiness).filter(
                    ProspectingBusiness.campaign_id == campaign.id,
                    ProspectingBusiness.status.in_(["pending_enrichment", "enrichment_failed"])
                ).all()

                # Ordenar por completitud previa
                pending_businesses.sort(key=self.calculate_completeness_score, reverse=True)
                total_to_enrich = len(pending_businesses)

                for idx, b in enumerate(pending_businesses, start=1):
                    if self._cancel_requested:
                        break

                    self._current_status["current_business_name"] = f"[{idx}/{total_to_enrich}] {b.name} ({b.municipality or 'Colima'})"
                    self._current_status["progress_percent"] = int((idx / max(1, total_to_enrich)) * 100)
                    self._current_status["message"] = f"Scrapeando y buscando presencia web para {b.name}..."

                    try:
                        # Ejecutar enriquecimiento de web, Maps y DuckDuckGo
                        enrichment_res = await enricher.enrich_business({
                            "name": b.name,
                            "municipality": b.municipality,
                            "state": b.state,
                            "street": b.street,
                            "neighborhood": b.neighborhood,
                            "latitude": b.latitude,
                            "longitude": b.longitude,
                            "website_url": b.website_url,
                            "scian_activity": b.scian_activity,
                            "stratum": b.stratum,
                            "phone": b.phone,
                            "email": b.email
                        })

                        # Guardar señales enriquecidas
                        b.has_working_website = enrichment_res["has_working_website"]
                        b.has_ssl = enrichment_res["has_ssl"]
                        b.has_whatsapp_link = enrichment_res["has_whatsapp_link"]
                        b.has_online_booking = enrichment_res["has_online_booking"]
                        b.booking_provider = enrichment_res["booking_provider"]
                        b.social_links = enrichment_res["social_links"]
                        b.digital_signals = enrichment_res["digital_signals"]
                        b.last_enriched_at = datetime.utcnow()
                        b.status = "enriched"

                        # Registrar fuente de scraping de sitio web si existió
                        raw_web = enrichment_res.get("website_scrape_raw")
                        if raw_web and raw_web.get("is_working"):
                            db.add(ProspectingSource(
                                business_id=b.id,
                                source_type="website_scrape",
                                source_url=b.website_url,
                                confidence_level="confirmed",
                                http_status=raw_web.get("http_status") or 200,
                                summary=f"Web activa. Título: {raw_web.get('title')[:100]}",
                                extracted_data=raw_web
                            ))

                        # Registrar fuente de búsqueda pública / mapas
                        db.add(ProspectingSource(
                            business_id=b.id,
                            source_type="public_search",
                            source_url=enrichment_res["maps_url"],
                            confidence_level="confirmed" if enrichment_res["public_search_results"] else "inferred",
                            http_status=200,
                            summary=f"Ficha Google Maps generada + {len(enrichment_res['public_search_results'])} referencias web halladas",
                            extracted_data={
                                "maps_url": enrichment_res["maps_url"],
                                "duckduckgo_findings": enrichment_res["public_search_results"]
                            }
                        ))

                        run.enriched_count += 1
                        self._current_status["enriched_count"] += 1

                    except Exception as b_err:
                        logger.error(f"[prospecting-job] Error enriqueciendo negocio #{b.id} ({b.name}): {b_err}")
                        b.status = "enrichment_failed"
                        self._current_status["errors_count"] += 1
                        db.add(ProspectingSource(
                            business_id=b.id,
                            source_type="enrichment_error",
                            source_url=b.website_url or "n/a",
                            confidence_level="not_found",
                            http_status=500,
                            summary=f"Error durante enriquecimiento: {str(b_err)[:200]}",
                            extracted_data={"error": str(b_err)}
                        ))

                    db.commit()

                    # ==============================================================
                    # THROTTLING OBLIGATORIO: Esperar 1.5s antes del siguiente
                    # ==============================================================
                    if not self._cancel_requested and idx < total_to_enrich:
                        await asyncio.sleep(1.5)

            # Finalizar run
            run.status = "cancelled" if self._cancel_requested else "completed"
            run.finished_at = datetime.utcnow()
            db.commit()

            self._current_status["is_running"] = False
            self._current_status["stage"] = "idle"
            self._current_status["progress_percent"] = 100
            self._current_status["message"] = "Proceso cancelado" if self._cancel_requested else "Ejecución completada con éxito."

        except Exception as e:
            logger.error(f"[prospecting-job] Error crítico en pipeline de prospección: {e}")
            if run:
                run.status = "failed"
                run.error_log = str(e)
                run.finished_at = datetime.utcnow()
                db.commit()
            self._current_status["is_running"] = False
            self._current_status["stage"] = "idle"
            self._current_status["message"] = f"Error: {e}"
        finally:
            db.close()


# Instancia única en memoria
task_manager = ProspectingTaskManager()
