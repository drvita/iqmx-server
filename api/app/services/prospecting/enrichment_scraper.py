import re
import html
import logging
from typing import Dict, Any, List, Optional
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin, quote_plus
import httpx

logger = logging.getLogger("uvicorn.error")

class SimpleHtmlExtractor(HTMLParser):
    """
    Parser ligero usando exclusivamente la librería estándar html.parser.
    Extrae título, meta descripción, enlaces externos, redes sociales y links de WhatsApp.
    """
    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.in_title = False
        self.title_parts: List[str] = []
        self.meta_description: Optional[str] = None
        self.text_chunks: List[str] = []
        self.links: List[str] = []
        self.whatsapp_links: List[str] = []
        self.social_links: Dict[str, List[str]] = {
            "instagram": [],
            "facebook": [],
            "tiktok": []
        }
        self.detected_booking_engines: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[tuple]):
        attrs_dict = dict(attrs)
        tag_lower = tag.lower()

        if tag_lower == "title":
            self.in_title = True

        elif tag_lower == "meta":
            name = (attrs_dict.get("name") or attrs_dict.get("property") or "").lower()
            if name in ["description", "og:description", "twitter:description"]:
                content = attrs_dict.get("content")
                if content and not self.meta_description:
                    self.meta_description = content.strip()

        elif tag_lower == "a":
            href = attrs_dict.get("href")
            if href:
                full_url = urljoin(self.base_url, href.strip())
                self.links.append(full_url)
                href_lower = full_url.lower()

                # Detección de WhatsApp
                if "wa.me/" in href_lower or "api.whatsapp.com/send" in href_lower or "whatsapp://send" in href_lower:
                    if full_url not in self.whatsapp_links:
                        self.whatsapp_links.append(full_url)

                # Detección de Redes Sociales
                if "instagram.com" in href_lower and not any(x in href_lower for x in ["/share", "/intent", "/sharer"]):
                    if full_url not in self.social_links["instagram"]:
                        self.social_links["instagram"].append(full_url)
                elif "facebook.com" in href_lower and not any(x in href_lower for x in ["/sharer", "/share", "/dialog"]):
                    if full_url not in self.social_links["facebook"]:
                        self.social_links["facebook"].append(full_url)
                elif "tiktok.com" in href_lower:
                    if full_url not in self.social_links["tiktok"]:
                        self.social_links["tiktok"].append(full_url)

                # Detección de plataformas de citas/reservas en links
                booking_keywords = ["booksy.com", "fresha.com", "calendly.com", "agendapro.com", "reservandonos.com", "timify.com"]
                for b_kw in booking_keywords:
                    if b_kw in href_lower and b_kw not in self.detected_booking_engines:
                        self.detected_booking_engines.append(b_kw.split(".")[0])

    def handle_endtag(self, tag: str):
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str):
        if self.in_title:
            self.title_parts.append(data)
        stripped = data.strip()
        if stripped and len(stripped) > 3:
            # Coleccionar texto relevante ignorando scripts y estilos básicos
            self.text_chunks.append(stripped)

    def get_title(self) -> str:
        return " ".join(self.title_parts).strip()


class DuckDuckGoHtmlParser(HTMLParser):
    """
    Parser para la versión HTML simple de DuckDuckGo (html.duckduckgo.com).
    Extrae los primeros enlaces orgánicos y snippets de resultados de búsqueda.
    """
    def __init__(self):
        super().__init__()
        self.results: List[Dict[str, str]] = []
        self._current_result: Optional[Dict[str, str]] = None
        self._in_title_link = False
        self._in_snippet = False

    def handle_starttag(self, tag: str, attrs: List[tuple]):
        attrs_dict = dict(attrs)
        tag_lower = tag.lower()
        class_name = attrs_dict.get("class", "")

        if tag_lower == "a" and "result__url" in class_name:
            pass
        elif tag_lower == "a" and ("result__snippet" in class_name or "result-link" in class_name or "result__title" in class_name):
            href = attrs_dict.get("href", "")
            # Limpiar redirecciones de DDG tipo //duckduckgo.com/l/?uddg=...
            actual_url = href
            if "uddg=" in href:
                from urllib.parse import parse_qs
                parsed = urlparse(href)
                query = parse_qs(parsed.query)
                if "uddg" in query and query["uddg"]:
                    actual_url = query["uddg"][0]

            self._current_result = {"url": actual_url, "title": "", "snippet": ""}
            self._in_title_link = True

        elif tag_lower == "a" and "result__snippet" in class_name:
            self._in_snippet = True
        elif tag_lower == "td" and "result-snippet" in class_name:
            self._in_snippet = True

    def handle_endtag(self, tag: str):
        tag_lower = tag.lower()
        if tag_lower == "a" and self._in_title_link:
            self._in_title_link = False
            if self._current_result and self._current_result.get("url"):
                self.results.append(self._current_result)
                self._current_result = None
        elif tag_lower in ["a", "td", "div"] and self._in_snippet:
            self._in_snippet = False

    def handle_data(self, data: str):
        clean_text = data.strip()
        if not clean_text:
            return
        if self._in_title_link and self._current_result:
            self._current_result["title"] += (" " + clean_text)
        elif self._in_snippet and self._current_result:
            self._current_result["snippet"] += (" " + clean_text)


class EnrichmentScraper:
    """
    Scraper y enriquecedor determinista para negocios:
    1. Si tiene sitio web en DENUE o descubierto, lo examina directamente.
    2. Consulta DuckDuckGo HTML para descubrir perfiles sociales o referencias públicas.
    3. Genera la ficha georreferenciada de Google Maps (URL directa + cálculo de presencia).
    4. Ensambla el payload enriquecido listo para que el LLM lo consuma en la Fase 3.
    """

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8"
    }

    @staticmethod
    def generate_google_maps_url(name: str, street: Optional[str], municipality: Optional[str], state: Optional[str], lat: Optional[str], lng: Optional[str]) -> str:
        """Genera una URL directa y válida de Google Maps para el negocio."""
        if lat and lng and lat.strip() and lng.strip():
            # Si hay coordenadas precisas de INEGI
            return f"https://www.google.com/maps/search/?api=1&query={lat.strip()},{lng.strip()}"
        
        # Búsqueda por nombre y ubicación
        address_parts = [name]
        if street:
            address_parts.append(street)
        if municipality:
            address_parts.append(municipality)
        if state:
            address_parts.append(state)
        
        query_str = quote_plus(", ".join(address_parts))
        return f"https://www.google.com/maps/search/?api=1&query={query_str}"

    async def scrape_business_website(self, url: str) -> Dict[str, Any]:
        """Visita y analiza la página web del negocio."""
        result = {
            "is_working": False,
            "has_ssl": False,
            "http_status": None,
            "title": "",
            "meta_description": "",
            "has_whatsapp": False,
            "whatsapp_links": [],
            "social_links": {"instagram": [], "facebook": [], "tiktok": []},
            "has_online_booking": False,
            "booking_engines": [],
            "summary_text": "",
            "error": None
        }

        # Normalizar protocolo
        target_url = url.strip()
        if not target_url.startswith("http://") and not target_url.startswith("https://"):
            target_url = "https://" + target_url

        result["has_ssl"] = target_url.startswith("https://")

        try:
            async with httpx.AsyncClient(headers=self.HEADERS, timeout=10.0, follow_redirects=True, verify=False) as client:
                res = await client.get(target_url)
                result["http_status"] = res.status_code

                if res.status_code == 200:
                    result["is_working"] = True
                    html_content = res.text

                    parser = SimpleHtmlExtractor(base_url=str(res.url))
                    parser.feed(html_content)

                    result["title"] = parser.get_title()
                    result["meta_description"] = parser.meta_description or ""
                    result["whatsapp_links"] = parser.whatsapp_links
                    result["has_whatsapp"] = len(parser.whatsapp_links) > 0
                    result["social_links"] = parser.social_links
                    result["booking_engines"] = parser.detected_booking_engines
                    result["has_online_booking"] = len(parser.detected_booking_engines) > 0

                    # Texto limpio para el LLM (primeras 800 palabras para contexto)
                    clean_words = " ".join(parser.text_chunks)[:2500]
                    result["summary_text"] = clean_words
                else:
                    result["error"] = f"HTTP {res.status_code}"

        except Exception as e:
            result["error"] = str(e)[:200]
            logger.info(f"[scraper] Falló scrape directo a {url}: {e}")

        return result

    async def search_duckduckgo_public(self, business_name: str, municipality: str, state: str = "Colima") -> List[Dict[str, str]]:
        """
        Realiza una búsqueda pública en DuckDuckGo HTML para descubrir perfiles de redes,
        directorios y presencia web del negocio.
        """
        query = f'"{business_name}" {municipality} {state}'
        search_url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"

        findings = []
        try:
            async with httpx.AsyncClient(headers=self.HEADERS, timeout=10.0, follow_redirects=True) as client:
                res = await client.post(
                    "https://html.duckduckgo.com/html/",
                    data={"q": query},
                    headers=self.HEADERS
                )

                if res.status_code == 200:
                    parser = DuckDuckGoHtmlParser()
                    parser.feed(res.text)
                    for item in parser.results[:6]:
                        u = item.get("url", "")
                        t = item.get("title", "").strip()
                        s = item.get("snippet", "").strip()
                        if u and (t or s):
                            findings.append({
                                "url": u,
                                "title": t,
                                "snippet": s
                            })
        except Exception as e:
            logger.warning(f"[scraper] Búsqueda DuckDuckGo omitida para '{business_name}': {e}")

        return findings

    async def enrich_business(self, business_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ejecuta el enriquecimiento completo de un negocio:
        - Ficha Maps
        - Scraping de sitio web (si existe)
        - Búsqueda pública en DuckDuckGo
        - Diagnóstico de carencias y oportunidades
        - Ensamblado LLM-Ready
        """
        name = business_data.get("name", "")
        municipality = business_data.get("municipality", "") or "Colima"
        state = business_data.get("state", "") or "Colima"
        street = business_data.get("street")
        lat = business_data.get("latitude")
        lng = business_data.get("longitude")
        initial_website = business_data.get("website_url")

        # 1. Generar URL de Google Maps georreferenciada
        maps_url = self.generate_google_maps_url(name, street, municipality, state, lat, lng)

        # 2. Scrapear web propia si está disponible
        website_result = None
        if initial_website and initial_website.strip():
            website_result = await self.scrape_business_website(initial_website)

        # 3. Búsqueda pública en DuckDuckGo (para redes sociales o links de negocio)
        public_search_results = await self.search_duckduckgo_public(name, municipality, state)

        # Extraer redes encontradas en la búsqueda pública si no las tenía en la web
        discovered_socials = {"instagram": [], "facebook": [], "tiktok": []}
        if website_result:
            for k in discovered_socials:
                discovered_socials[k].extend(website_result["social_links"].get(k, []))

        for res in public_search_results:
            u_low = res["url"].lower()
            if "instagram.com" in u_low and not any(x in u_low for x in ["/share", "/p/"]):
                if res["url"] not in discovered_socials["instagram"]:
                    discovered_socials["instagram"].append(res["url"])
            elif "facebook.com" in u_low and not any(x in u_low for x in ["/sharer", "/dialog", "/events"]):
                if res["url"] not in discovered_socials["facebook"]:
                    discovered_socials["facebook"].append(res["url"])
            elif "tiktok.com" in u_low:
                if res["url"] not in discovered_socials["tiktok"]:
                    discovered_socials["tiktok"].append(res["url"])

        # 4. Diagnóstico comercial y detección de oportunidades
        opportunities_detected = []
        carencias = []

        has_website = bool(website_result and website_result.get("is_working"))
        if not has_website:
            carencias.append("Sin sitio web propio activo ni presencia digital formal")
            opportunities_detected.append({
                "type": "no_website",
                "opportunity": "Desarrollo de sitio web profesional / Landing page",
                "sales_angle": "ChatGPT y los buscadores con IA son el nuevo estándar. Si no tienen sitio web indexable, son invisibles para nuevos clientes que buscan estéticas en su zona."
            })
        else:
            if not website_result.get("has_whatsapp"):
                carencias.append("Sitio web sin botón de contacto directo a WhatsApp")
                opportunities_detected.append({
                    "type": "no_whatsapp_cta",
                    "opportunity": "Integración de botón y flujo de atención WhatsApp",
                    "sales_angle": "Pierden prospectos que visitan su sitio pero no tienen forma rápida de pedir informes o agendar por WhatsApp."
                })

            if not website_result.get("has_online_booking"):
                carencias.append("Sin sistema de citas o reservas en línea detectado")
                opportunities_detected.append({
                    "type": "no_online_booking",
                    "opportunity": "Sistema de agenda y reservaciones automatizadas 24/7",
                    "sales_angle": "La gestión manual de citas por teléfono o chat consume tiempo de los estilistas y provoca cancelaciones por falta de recordatorios."
                })

        if not discovered_socials["instagram"] and not discovered_socials["facebook"]:
            carencias.append("Sin perfiles públicos de redes sociales claramente identificados")

        # 5. Ensamblar Payload "LLM-Ready"
        llm_ready_context = {
            "business_identity": {
                "name": name,
                "denue_activity": business_data.get("scian_activity"),
                "stratum": business_data.get("stratum"),
                "address": f"{street or ''}, {business_data.get('neighborhood') or ''}, {municipality}, {state}".strip(", "),
                "phone": business_data.get("phone"),
                "email": business_data.get("email"),
            },
            "digital_presence": {
                "google_maps_url": maps_url,
                "has_official_website": has_website,
                "website_url": initial_website,
                "website_title": website_result.get("title") if website_result else "",
                "website_meta": website_result.get("meta_description") if website_result else "",
                "has_whatsapp_link": website_result.get("has_whatsapp") if website_result else False,
                "has_online_booking": website_result.get("has_online_booking") if website_result else False,
                "booking_provider": (website_result.get("booking_engines") or [None])[0] if website_result else None,
                "social_profiles": discovered_socials,
                "public_search_snippets": [s["snippet"] for s in public_search_results if s.get("snippet")][:3]
            },
            "audit_diagnosis": {
                "detected_gaps": carencias,
                "potential_services": [o["opportunity"] for o in opportunities_detected],
                "recommended_angles": opportunities_detected
            }
        }

        return {
            "maps_url": maps_url,
            "has_working_website": has_website,
            "has_ssl": website_result.get("has_ssl") if website_result else False,
            "has_whatsapp_link": website_result.get("has_whatsapp") if website_result else False,
            "has_online_booking": website_result.get("has_online_booking") if website_result else False,
            "booking_provider": (website_result.get("booking_engines") or [None])[0] if website_result else None,
            "social_links": discovered_socials,
            "digital_signals": llm_ready_context,
            "website_scrape_raw": website_result,
            "public_search_results": public_search_results
        }
