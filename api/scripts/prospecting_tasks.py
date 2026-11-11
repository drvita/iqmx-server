import time
import asyncio
import logging
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import SessionLocal
from app.models.prospecting import ProspectingBusiness, ProspectingSource, ProspectingCampaign
from app.services.prospecting.enrichment_scraper import EnrichmentScraper
from app.services.prospecting.llm_evaluator import ProspectingLlmEvaluator

logger = logging.getLogger("prospecting-cli")


def run_nightly_batch(limit: int = 10, campaign_id: Optional[int] = None, dry_run: bool = False):
    """
    Comando único de ejecución nocturna:
    1. Ordena los negocios por mayor Score DENUE (0-50 pts) que sigan en estado 'discovered'.
    2. Toma los primeros N negocios (por defecto 10).
    3. Para cada negocio:
       a) Ejecuta el scraping web + DuckDuckGo + Maps.
       b) Ejecuta el briefing del Agente LLM para el EQUIPO DE VENTAS (completando datos y diagnosticando qué proponer).
       c) Asigna la plantilla estándar de contacto (WhatsApp / Email / Visita) y guarda el briefing interno.
       d) Espera 1.0 segundo antes de pasar al siguiente negocio.
    """
    print(f"\n[prospecting:run-batch] Iniciando lote nocturno integrado (Límite: {limit}, Campaña: {campaign_id or 'Todas'})...")
    db: Session = SessionLocal()
    enricher = EnrichmentScraper()
    evaluator = ProspectingLlmEvaluator()

    try:
        q = db.query(ProspectingBusiness).filter(ProspectingBusiness.status == "discovered")
        if campaign_id:
            q = q.filter(ProspectingBusiness.campaign_id == campaign_id)

        candidates = q.order_by(desc(ProspectingBusiness.denue_score), desc(ProspectingBusiness.id)).limit(limit).all()

        if not candidates:
            print("[prospecting:run-batch] No hay negocios pendientes en estado 'discovered'.")
            return

        print(f"[prospecting:run-batch] Se seleccionaron los {len(candidates)} mejores negocios para procesar:")
        for idx, c in enumerate(candidates, 1):
            print(f"  {idx}. [{c.denue_score}/50 pts] {c.name} ({c.municipality or 'Colima'}) - Tel: {c.phone or 'Sin teléfono'}")

        if dry_run:
            print("\n[prospecting:run-batch] Modo --dry-run activado: no se ejecutó el lote.")
            return

        print("\n[prospecting:run-batch] Iniciando pipeline secuencial (Scraping -> Briefing LLM Ventas -> Pausa 1s)...")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        for idx, b in enumerate(candidates, 1):
            print(f"\n========================================================")
            print(f"[{idx}/{len(candidates)}] Negocio: {b.name}")
            print(f"Score DENUE: {b.denue_score}/50 pts | Contacto actual: Tel={b.phone or 'N/A'}, Web={b.website_url or 'N/A'}")
            print(f"========================================================")

            # Paso A: Scraping Web + DuckDuckGo + Google Maps
            print("  1. Scrapeando presencia digital y buscando datos adicionales...")
            try:
                res_scrape = loop.run_until_complete(enricher.enrich_business({
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
                }))

                b.has_working_website = res_scrape["has_working_website"]
                b.has_ssl = res_scrape["has_ssl"]
                b.has_whatsapp_link = res_scrape["has_whatsapp_link"]
                b.has_online_booking = res_scrape["has_online_booking"]
                b.booking_provider = res_scrape["booking_provider"]
                b.social_links = res_scrape["social_links"]
                b.digital_signals = res_scrape["digital_signals"]
                b.last_scraped_at = datetime.utcnow()

                db.add(ProspectingSource(
                    business_id=b.id,
                    source_type="public_search",
                    source_url=res_scrape["maps_url"],
                    confidence_level="confirmed",
                    http_status=200,
                    summary=f"Ficha Google Maps generada + {len(res_scrape['public_search_results'])} referencias web",
                    extracted_data=res_scrape["digital_signals"]
                ))
                db.commit()
                print("     [OK] Scraping completado con éxito.")
            except Exception as scrape_err:
                logger.error(f"Error en scraping para #{b.id} ({b.name}): {scrape_err}")
                print(f"     [AVISO] Scraping con advertencia: {scrape_err}")

            # Paso B: Evaluación Interna con LLM para el Equipo de Ventas
            print("  2. Generando Briefing Interno para el Equipo de Ventas...")
            try:
                sources = db.query(ProspectingSource).filter(ProspectingSource.business_id == b.id).all()
                sources_list = [
                    {"source_type": s.source_type, "source_url": s.source_url, "summary": s.summary}
                    for s in sources
                ]

                business_dict = {
                    "name": b.name,
                    "scian_activity": b.scian_activity,
                    "stratum": b.stratum,
                    "street": b.street,
                    "neighborhood": b.neighborhood,
                    "municipality": b.municipality,
                    "state": b.state,
                    "phone": b.phone,
                    "email": b.email,
                    "website_url": b.website_url,
                    "digital_signals": b.digital_signals
                }

                eval_res = evaluator.evaluate_business(business_dict, sources_list)

                b.status = eval_res.status  # 'qualified' | 'disqualified'
                b.disqualification_reason = eval_res.disqualification_reason
                b.digital_score = min(50, max(0, eval_res.digital_presence_score))

                # Normalizar canal prioritario
                raw_chan = (eval_res.recommended_channel or "").lower()
                if b.phone or "whatsapp" in raw_chan or "mobile" in raw_chan or "phone" in raw_chan:
                    b.contact_channel = "whatsapp"
                elif b.email or "email" in raw_chan:
                    b.contact_channel = "email"
                elif b.street or "visit" in raw_chan:
                    b.contact_channel = "physical_visit"
                else:
                    b.contact_channel = "none"

                b.last_evaluated_at = datetime.utcnow()

                # Completar datos faltantes descubiertos
                if eval_res.completed_contact:
                    if eval_res.completed_contact.phone and not b.phone:
                        b.phone = eval_res.completed_contact.phone
                        print(f"     [DATO COMPLETADO] Nuevo teléfono extraído: {b.phone}")
                    if eval_res.completed_contact.email and not b.email:
                        b.email = eval_res.completed_contact.email
                        print(f"     [DATO COMPLETADO] Nuevo email extraído: {b.email}")
                    if eval_res.completed_contact.website_url and not b.website_url:
                        b.website_url = eval_res.completed_contact.website_url
                        print(f"     [DATO COMPLETADO] Nueva web extraída: {b.website_url}")

                # Guardar el Briefing Interno para el Asesor de Ventas
                b.llm_analysis = {
                    "internal_diagnosis": eval_res.internal_diagnosis,
                    "sales_action_recommendation": eval_res.sales_action_recommendation,
                    "suggested_template": eval_res.suggested_template,
                    "recommended_channel": eval_res.recommended_channel,
                    "opportunities": eval_res.opportunities.model_dump(),
                    "evaluated_at": datetime.utcnow().isoformat()
                }

                db.add(ProspectingSource(
                    business_id=b.id,
                    source_type="sales_briefing",
                    source_url="openrouter",
                    confidence_level="confirmed" if b.status == "qualified" else "inferred",
                    http_status=200,
                    summary=f"Briefing Ventas: {b.status.upper()} | Plantilla: {eval_res.suggested_template} | Canal: {b.contact_channel}",
                    extracted_data=b.llm_analysis
                ))
                db.commit()

                print(f"     [OK] Dictamen: {b.status.upper()} | Canal Asignado: {b.contact_channel}")
                print(f"     Score Total Computado: {b.total_score}/100 (DENUE: {b.denue_score} + Digital: {b.digital_score})")
                print(f"     Plantilla sugerida: {eval_res.suggested_template}")
                if b.status == "qualified":
                    print(f"     Briefing para Ventas: {eval_res.sales_action_recommendation[:90]}...")
                else:
                    print(f"     Motivo descarte: {b.disqualification_reason}")

            except Exception as llm_err:
                logger.error(f"Error evaluando con LLM #{b.id} ({b.name}): {llm_err}")
                print(f"     [ERROR] Falló evaluación LLM: {llm_err}")
                b.status = "disqualified"
                b.disqualification_reason = f"Error en evaluación: {str(llm_err)[:100]}"
                db.commit()

            # Paso C: Espacio de 1 segundo antes de pasar al siguiente
            if idx < len(candidates):
                print("  ⏳ Pausa obligatoria de 1.0s...")
                time.sleep(1.0)

        print("\n========================================================")
        print(f"[prospecting:run-batch] Lote de {len(candidates)} negocios completado exitosamente.")
        print("Briefings listos en la vista 'Calificados' de /admin/prospecting.")
        print("========================================================\n")

    finally:
        db.close()
