import { readMediaFile } from "@/server/whatsapp/media";
import { getBrandingContext } from "@/server/branding";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { FAVICON_ASSET, generatedFaviconSvg } from "@/lib/favicon";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Cabeceras con las que se sirve CUALQUIER icono, subido o generado.
 *
 * Un SVG que sube el dueño es un documento con permiso de ejecutar guiones si
 * alguien navega a su URL. La CSP lo deja sin nada que ejecutar y `nosniff`
 * impide que el navegador reinterprete el tipo. Cuesta dos cabeceras y quita
 * de la mesa toda esa clase de problema.
 */
function cabeceras(mime: string, cacheable: boolean): HeadersInit {
  return {
    "content-type": mime,
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    "x-content-type-options": "nosniff",
    // La URL lleva `?v=` y cambia con la marca, así que se puede cachear
    // fuerte. Sin ese sufijo —alguien pidiendo la ruta pelada— no.
    "cache-control": cacheable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=60",
  };
}

/**
 * El icono de la pestaña y logotipo del tenant.
 * Resuelve la organización mediante el parámetro `?org=` o mediante la sesión activa.
 * Si no se encuentra organización o es una petición pública sin contexto, sirve el generado por defecto.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cacheable = url.searchParams.has("v");
  const orgParam = url.searchParams.get("org")?.trim() || null;
  const session = await getSessionOrNull().catch(() => null);
  const targetOrgId = orgParam || session?.organizationId || null;

  const ctx = await getBrandingContext(targetOrgId).catch(() => null);
  const branding = ctx?.branding ?? DEFAULT_BRANDING;
  const resolvedOrgId = ctx?.organizationId ?? targetOrgId;

  if (resolvedOrgId && branding.favicon) {
    try {
      const buf = await readMediaFile(resolvedOrgId, FAVICON_ASSET);
      return new Response(new Uint8Array(buf), {
        headers: cabeceras(branding.favicon.mime, cacheable),
      });
    } catch {
      // El archivo se perdió (volumen sin montar, restauración a medias). Se
      // cae al generado en vez de dejar la pestaña sin icono: un 404 aquí se
      // ve como si la instancia estuviera rota.
    }
  }

  return new Response(generatedFaviconSvg(branding), {
    headers: cabeceras("image/svg+xml", cacheable),
  });
}
