import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DECK_DIR = path.join(PUBLIC_DIR, 'images', 'checador', 'deck');
const DOWNLOADS_DIR = path.join(PUBLIC_DIR, 'downloads');
const OUT_HTML = '/tmp/guia-2027-deck.html';

function toDataUri(filePath, mime) {
  const buf = fs.readFileSync(filePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function svgToDataUri(filePath) {
  return toDataUri(filePath, 'image/svg+xml');
}

fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

const logoUri = toDataUri(path.join(PUBLIC_DIR, 'logo.png'), 'image/png');
const employeeUri = toDataUri(
  path.join(PUBLIC_DIR, 'images', 'checador', 'empleado-fabrica.png'),
  'image/png'
);
const escaleraUri = svgToDataUri(path.join(DECK_DIR, 'escalera-40-horas.svg'));
const papelVsElectronicoUri = svgToDataUri(
  path.join(DECK_DIR, 'papel-vs-registro-electronico.svg')
);
const riesgosUri = svgToDataUri(path.join(DECK_DIR, 'riesgos-sanciones-multas.svg'));
const autodiagnosticoUri = svgToDataUri(
  path.join(DECK_DIR, 'autodiagnostico-preguntas.svg')
);
const solucionesUri = svgToDataUri(path.join(DECK_DIR, 'soluciones-a-la-medida.svg'));
const qrUri = svgToDataUri(path.join(DECK_DIR, 'qr-landing-checador.svg'));

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Guía Ejecutiva México 2027 — Reducción de Jornada y Registro Electrónico | IQISSMexico</title>
  <style>
    @page {
      size: 1280px 720px;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 1280px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
    }
    .slide {
      width: 1280px;
      height: 720px;
      overflow: hidden;
      position: relative;
      padding: 46px 56px 40px 56px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      break-after: page;
      page-break-after: always;
    }
    .slide:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .slide-dark {
      background: linear-gradient(135deg, #070235 0%, #1e1b4b 55%, #312e81 100%);
      color: #ffffff;
    }
    .slide-light {
      background: #f8fafc;
      color: #0f172a;
    }
    .slide-white {
      background: #ffffff;
      color: #0f172a;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .pill {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .pill-dark {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.22);
      color: #c7d2fe;
    }
    .pill-indigo {
      background: #e0e7ff;
      color: #3730a3;
    }
    .pill-emerald {
      background: #d1fae5;
      color: #065f46;
    }
    .page-num {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
    }
    .slide-dark .page-num {
      color: #a5b4fc;
    }
    h1 {
      margin: 0;
      font-size: 40px;
      line-height: 1.12;
      font-weight: 900;
      letter-spacing: -0.02em;
    }
    h2 {
      margin: 0 0 6px 0;
      font-size: 29px;
      line-height: 1.18;
      font-weight: 800;
      letter-spacing: -0.015em;
      color: #0f172a;
    }
    .subtitle {
      margin: 0;
      font-size: 15px;
      line-height: 1.45;
      color: #475569;
    }
    .slide-dark .subtitle {
      color: #e0e7ff;
    }
    .footer-note {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 11px;
      color: #64748b;
      margin-top: 10px;
    }
    .slide-dark .footer-note {
      border-top-color: rgba(255, 255, 255, 0.16);
      color: #c7d2fe;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: stretch;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 20px 22px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
    }
    .card-navy {
      background: #1e1b4b;
      color: #ffffff;
      border-radius: 16px;
      padding: 20px 22px;
    }
    .svg-frame {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 10px 16px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
      min-height: 0;
      overflow: hidden;
    }
    .svg-frame img {
      max-width: 100%;
      max-height: 415px;
      width: auto;
      height: auto;
      display: block;
    }
    .callout-warn {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 5px solid #d97706;
      border-radius: 12px;
      padding: 14px 18px;
      font-size: 13px;
      line-height: 1.45;
      color: #78350f;
    }
    .callout-emerald {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-left: 5px solid #059669;
      border-radius: 12px;
      padding: 12px 18px;
      font-size: 13px;
      line-height: 1.45;
      color: #065f46;
    }
    .metric-big {
      font-size: 42px;
      font-weight: 900;
      line-height: 1;
      margin: 4px 0 6px 0;
    }
    .logo-badge {
      background: #ffffff;
      padding: 8px 16px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
    }
    .logo-badge img {
      height: 36px;
      width: auto;
      display: block;
    }
    .kiosk-mini {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      overflow: hidden;
      color: #0f172a;
    }
    .kiosk-photo-wrap {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      border: 2px solid #1e1b4b;
      background: #070235;
      aspect-ratio: 4 / 3;
    }
    .kiosk-photo-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      display: block;
    }
    .corner {
      position: absolute;
      width: 18px;
      height: 18px;
      border-color: #85f8c4;
      border-style: solid;
      border-width: 0;
    }
    .c-tl { top: 10px; left: 10px; border-top-width: 3px; border-left-width: 3px; }
    .c-tr { top: 10px; right: 10px; border-top-width: 3px; border-right-width: 3px; }
    .c-bl { bottom: 10px; left: 10px; border-bottom-width: 3px; border-left-width: 3px; }
    .c-br { bottom: 10px; right: 10px; border-bottom-width: 3px; border-right-width: 3px; }
  </style>
</head>
<body>

  <!-- SLIDE 1: PORTADA -->
  <section class="slide slide-dark">
    <div class="topbar">
      <div class="logo-badge">
        <img src="${logoUri}" alt="IQISSMexico" />
      </div>
      <span class="pill pill-dark">GUÍA EJECUTIVA · EXCLUSIVO MÉXICO · 2026-2027</span>
    </div>

    <div style="display:grid; grid-template-columns: 1.35fr 0.85fr; gap: 36px; align-items:center; my:auto;">
      <div>
        <div style="display:inline-block; background:rgba(16,185,129,0.18); border:1px solid rgba(52,211,153,0.4); color:#6ee7b7; padding:6px 14px; border-radius:999px; font-size:12px; font-weight:700; margin-bottom:18px;">
          Vigencia obligatoria: 1° de enero de 2027
        </div>
        <h1>Reducción de la Jornada Laboral a 46 Horas y Registro Electrónico Obligatorio en México</h1>
        <p class="subtitle" style="margin-top:18px; font-size:17px; max-width:650px;">
          Qué cambia en la Ley Federal del Trabajo, en qué incumplen las empresas que siguen usando listas en papel o Excel manual y cómo prepararse con evidencia digital confiable.
        </p>
        <div style="display:flex; gap:14px; margin-top:26px;">
          <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); border-radius:12px; padding:12px 18px;">
            <div style="font-size:11px; color:#a5b4fc; text-transform:uppercase; font-weight:700;">Límite 2027</div>
            <div style="font-size:26px; font-weight:900; color:#6ee7b7;">46 h / semana</div>
          </div>
          <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); border-radius:12px; padding:12px 18px;">
            <div style="font-size:11px; color:#a5b4fc; text-transform:uppercase; font-weight:700;">Obligación Art. 132-XXXIV</div>
            <div style="font-size:26px; font-weight:900; color:#ffffff;">Registro Electrónico</div>
          </div>
          <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); border-radius:12px; padding:12px 18px;">
            <div style="font-size:11px; color:#a5b4fc; text-transform:uppercase; font-weight:700;">Multa LFT desde</div>
            <div style="font-size:26px; font-weight:900; color:#fcd34d;">$29,327 MXN</div>
          </div>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.16); border-radius:20px; padding:24px;">
        <div style="font-size:12px; font-weight:800; color:#a5b4fc; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:14px;">
          Panorama empresarial en México
        </div>
        <div style="background:rgba(7,2,53,0.55); border-radius:14px; padding:16px; margin-bottom:12px;">
          <div style="font-size:32px; font-weight:900; color:#6ee7b7;">99.8 %</div>
          <div style="font-size:13px; color:#e2e8f0; margin-top:4px;">de los establecimientos en México son MiPyMEs (INEGI) y más del 70 % del empleo formal depende de ellas.</div>
        </div>
        <div style="background:rgba(7,2,53,0.55); border-radius:14px; padding:16px;">
          <div style="font-size:14px; font-weight:800; color:#ffffff; margin-bottom:6px;">¿Por qué importa hoy?</div>
          <div style="font-size:12.5px; line-height:1.5; color:#cbd5e1;">
            Muchas empresas pequeñas aún no conocen que a partir del <strong>1° de enero de 2027</strong> es exigible llevar un control electrónico verificable de inicio y fin de jornada.
          </div>
        </div>
      </div>
    </div>

    <div class="footer-note">
      <span>Información vigente para México · Corte: 26 de noviembre de 2026</span>
      <span>Material informativo preparado por IQISSMexico · No sustituye asesoría legal ni contable</span>
    </div>
  </section>

  <!-- SLIDE 2: MARCO LEGAL EN MÉXICO -->
  <section class="slide slide-light">
    <div>
      <div class="topbar">
        <span class="pill pill-indigo">1 · Contexto Legal en México</span>
        <span class="page-num">2 / 9</span>
      </div>
      <h2>¿Qué aprobaron los decretos de 2026 y qué cambia en 2027?</h2>
      <p class="subtitle">La reforma constitucional y la armonización a la Ley Federal del Trabajo (LFT) aplican en toda la República Mexicana.</p>
    </div>

    <div class="grid-3" style="margin: 14px 0;">
      <div class="card">
        <div style="font-size:11px; font-weight:800; color:#4f46e5; text-transform:uppercase;">DOF · 3 de marzo de 2026</div>
        <h3 style="margin:8px 0; font-size:18px; font-weight:800;">Reforma Constitucional</h3>
        <p style="margin:0; font-size:13.5px; line-height:1.5; color:#475569;">
          Modifica el <strong>Artículo 123, Apartado A</strong> de la Constitución para reducir gradualmente la semana laboral ordinaria de 48 a 40 horas.
        </p>
      </div>
      <div class="card">
        <div style="font-size:11px; font-weight:800; color:#059669; text-transform:uppercase;">DOF · 1 de mayo de 2026</div>
        <h3 style="margin:8px 0; font-size:18px; font-weight:800;">Armonización de la LFT</h3>
        <p style="margin:0; font-size:13.5px; line-height:1.5; color:#475569;">
          Adiciona el <strong>Artículo 132, Fracción XXXIV</strong>: obliga al patrón a llevar un <strong>registro electrónico de la jornada</strong> con hora de inicio y fin.
        </p>
      </div>
      <div class="card-navy">
        <div style="font-size:11px; font-weight:800; color:#6ee7b7; text-transform:uppercase;">Protección al salario</div>
        <h3 style="margin:8px 0; font-size:18px; font-weight:800; color:#ffffff;">Cero reducción salarial</h3>
        <p style="margin:0; font-size:13.5px; line-height:1.5; color:#e0e7ff;">
          La ley prohíbe expresamente disminuir sueldos, salarios o prestaciones por motivo de la reducción de horas semanales.
        </p>
      </div>
    </div>

    <div class="grid-2" style="gap:18px;">
      <div class="callout-warn">
        <strong>Estado actual de los lineamientos STPS (Corte: nov 2026):</strong><br />
        La Secretaría del Trabajo y Previsión Social (STPS) aún <strong>no ha publicado</strong> en el DOF las disposiciones generales técnicas (posibles excepciones o formatos específicos). Hasta que se emitan, todas las empresas comparten las mismas obligaciones generales que entran en vigor el <strong>1° de enero de 2027</strong>.
      </div>
      <div class="callout-emerald">
        <strong>No exige comprar un aparato costoso específico:</strong><br />
        La LFT pide contar con un mecanismo <strong>electrónico</strong> confiable capaz de registrar inicio y término de jornada y entregar los datos a la autoridad cuando los solicite.
      </div>
    </div>

    <div class="footer-note">
      <span>Fuentes: Diario Oficial de la Federación (03/03/2026 y 01/05/2026) · México</span>
      <span>IQISSMexico · Checador Facial</span>
    </div>
  </section>

  <!-- SLIDE 3: CALENDARIO GRADUAL 2026-2030 -->
  <section class="slide slide-white">
    <div>
      <div class="topbar">
        <span class="pill pill-emerald">2 · Calendario Oficial en México</span>
        <span class="page-num">3 / 9</span>
      </div>
      <h2>Reducción gradual de 48 a 40 horas: en 2027 baja a 46 horas</h2>
      <p class="subtitle">Cada 1° de enero disminuye 2 horas el tope semanal ordinario hasta llegar a las 40 horas en 2030.</p>
    </div>

    <div class="svg-frame" style="margin: 12px 0;">
      <img src="${escaleraUri}" alt="Calendario gradual de reducción de jornada en México 2026-2030" />
    </div>

    <div class="footer-note">
      <span>En 2027 (46 h/sem), un turno tradicional de 6 días × 8 h (48 h) ya excede la jornada ordinaria permitida.</span>
      <span>IQISSMexico · Checador Facial</span>
    </div>
  </section>

  <!-- SLIDE 4: PAPEL VS REGISTRO ELECTRÓNICO -->
  <section class="slide slide-light">
    <div>
      <div class="topbar">
        <span class="pill pill-indigo">3 · Nueva Obligación Patronal (Art. 132-XXXIV LFT)</span>
        <span class="page-num">4 / 9</span>
      </div>
      <h2>¿En qué incumple una empresa si no sustituye el papel o Excel manual?</h2>
      <p class="subtitle">El control manual deja al negocio sin cumplimiento normativo ni evidencia confiable desde el 1° de enero de 2027.</p>
    </div>

    <div class="svg-frame" style="margin: 8px 0;">
      <img src="${papelVsElectronicoUri}" alt="Comparativa entre métodos tradicionales y registro electrónico obligatorio" style="max-height: 390px;" />
    </div>

    <div class="callout-warn" style="padding:10px 16px; font-size:12px;">
      <strong>Cláusula de validez probatoria:</strong> Para que el registro electrónico tenga valor probatorio sólido ante un conflicto, debe quedar documentado que su uso fue <strong>acordado entre el patrón y el trabajador</strong>, respetando también la privacidad de datos (LFPDPPP).
    </div>

    <div class="footer-note">
      <span>Art. 132 Fracc. XXXIV LFT · Registro electrónico con hora exacta de inicio y fin</span>
      <span>IQISSMexico · Checador Facial</span>
    </div>
  </section>

  <!-- SLIDE 5: RIESGOS FINANCIEROS Y RESGUARDO PROBATORIO -->
  <section class="slide slide-white">
    <div>
      <div class="topbar">
        <span class="pill pill-indigo">4 · Sanciones y Evidencia Legal</span>
        <span class="page-num">5 / 9</span>
      </div>
      <h2>Multas de 250 a 5,000 UMA y por qué conviene estar mejor preparado</h2>
      <p class="subtitle">No contar con un registro electrónico confiable expone al negocio a sanciones administrativas y falta de respaldo probatorio.</p>
    </div>

    <div class="svg-frame" style="margin: 12px 0;">
      <img src="${riesgosUri}" alt="Riesgos financieros y respaldo probatorio en México" />
    </div>

    <div class="footer-note">
      <span>Cálculo con UMA 2026 oficial INEGI ($117.31 MXN diarios). Ningún software sustituye la asesoría laboral ni garantiza resultados judiciales.</span>
      <span>IQISSMexico · Checador Facial</span>
    </div>
  </section>

  <!-- SLIDE 6: AUTODIAGNÓSTICO EXPRESS (5 PREGUNTAS ABIERTAS) -->
  <section class="slide slide-light">
    <div>
      <div class="topbar">
        <span class="pill pill-indigo">5 · Autodiagnóstico Rápido</span>
        <span class="page-num">6 / 9</span>
      </div>
      <h2>5 preguntas abiertas para saber si tu empresa está lista para 2027</h2>
      <p class="subtitle">Revísalas con tu encargado de Recursos Humanos o socio antes de que entre en vigor el decreto.</p>
    </div>

    <div class="svg-frame" style="margin: 12px 0;">
      <img src="${autodiagnosticoUri}" alt="Autodiagnóstico de 5 preguntas abiertas para empresas en México" />
    </div>

    <div class="footer-note">
      <span>Si al menos una respuesta queda sin resolver, es momento de digitalizar tu control de asistencia.</span>
      <span>IQISSMexico · Checador Facial</span>
    </div>
  </section>

  <!-- SLIDE 7: LA SOLUCIÓN INMEDIATA (CHECADOR FACIAL GENÉRICO) -->
  <section class="slide slide-white">
    <div>
      <div class="topbar">
        <span class="pill pill-emerald">6 · Solución Lista Hoy para PyMEs en México</span>
        <span class="page-num">7 / 9</span>
      </div>
      <h2>Checador Facial: convierte cualquier tablet en un registro electrónico confiable</h2>
      <p class="subtitle">Producto genérico listo en minutos, sin hardware costoso ni plazos forzosos, adaptado a la jornada de 46 horas.</p>
    </div>

    <div style="display:grid; grid-template-columns: 1.05fr 0.95fr; gap: 26px; align-items:center; flex:1;">
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="card" style="padding:14px 18px;">
          <div style="font-size:14px; font-weight:800; color:#059669;">1 · PDF Oficial STPS + CSV con Sellado SHA-256</div>
          <div style="font-size:12.5px; color:#475569; margin-top:4px;">Genera reportes listos para inspección con Razón Social, RFC, Registro Patronal IMSS, horas extras dobles/triples y sello criptográfico inalterable.</div>
        </div>
        <div class="card" style="padding:14px 18px;">
          <div style="font-size:14px; font-weight:800; color:#4f46e5;">2 · Jornadas LFT y Acuse Semanal (Arts. 60, 61, 784 y 804)</div>
          <div style="font-size:12.5px; color:#475569; margin-top:4px;">Soporte para jornada diurna (46 h), mixta y nocturna con confirmación táctil de asistencia del colaborador al cierre del periodo.</div>
        </div>
        <div class="card" style="padding:14px 18px;">
          <div style="font-size:14px; font-weight:800; color:#1e1b4b;">3 · Quiosco Sin Internet y Móvil Personal 1:1 con GPS</div>
          <div style="font-size:12.5px; color:#475569; margin-top:4px;">Opera en sucursal aun sin conexión o en teléfono personal para personal en ruta con GPS puntual no bloqueante y prueba de vida facial.</div>
        </div>
        <div class="card" style="padding:14px 18px;">
          <div style="font-size:14px; font-weight:800; color:#0f172a;">4 · Privacidad Biométrica (LFPDPPP) y Bitácora</div>
          <div style="font-size:12.5px; color:#475569; margin-top:4px;">Consentimiento en el alta, minimización biométrica en móviles 1:1 y gestión de incidencias con bitácora de auditoría inmutable.</div>
        </div>
      </div>

      <div class="kiosk-mini" style="padding:16px; background:#f8fafc;">
        <div style="display:flex; align-items:center; justify-content:space-between; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; margin-bottom:12px;">
          <div>
            <div style="font-size:13px; font-weight:800; color:#070235;">Manufacturas del Norte</div>
            <div style="font-size:11px; color:#64748b;">Planta Monterrey · Acceso Principal</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:monospace; font-size:15px; font-weight:800; color:#070235;">07:58:14 AM</div>
            <div style="font-size:10px; font-weight:700; color:#059669;">En línea · Listo</div>
          </div>
        </div>

        <div class="kiosk-photo-wrap">
          <img src="${employeeUri}" alt="Colaborador en terminal quiosco" />
          <div class="corner c-tl"></div>
          <div class="corner c-tr"></div>
          <div class="corner c-bl"></div>
          <div class="corner c-br"></div>
        </div>

        <div style="margin-top:12px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-size:12.5px; font-weight:800; color:#065f46;">Entrada registrada — Carlos Mendoza</div>
            <div style="font-size:11px; color:#047857;">PDF STPS + Sello SHA-256 · Límite 46.0 h</div>
          </div>
          <span style="background:#059669; color:#ffffff; font-size:10px; font-weight:800; padding:4px 8px; border-radius:999px;">VÁLIDO</span>
        </div>
      </div>
    </div>

    <div class="footer-note">
      <span>Configuración rápida: vincula cualquier tableta Android, iPad o computadora en minutos con código QR o PIN.</span>
      <span>IQISSMexico · Checador Facial</span>
    </div>
  </section>

  <!-- SLIDE 8: SOLUCIONES A LA MEDIDA -->
  <section class="slide slide-light">
    <div>
      <div class="topbar">
        <span class="pill pill-indigo">7 · Opciones Personalizadas</span>
        <span class="page-num">8 / 9</span>
      </div>
      <h2>¿Tu operación no encaja en una solución estándar? Desarrollamos a tu medida</h2>
      <p class="subtitle">Además de nuestro Checador Facial para pequeñas y medianas empresas, creamos despliegues adaptados a tu infraestructura.</p>
    </div>

    <div class="svg-frame" style="margin: 12px 0;">
      <img src="${solucionesUri}" alt="Soluciones empresariales a la medida" />
    </div>

    <div class="footer-note">
      <span>Platica con nuestro equipo de ingeniería para evaluar arquitectura on-premise, geocercas o reglas de turno especiales.</span>
      <span>IQISSMexico · Ingeniería de Software</span>
    </div>
  </section>

  <!-- SLIDE 9: PRÓXIMOS PASOS Y CONTACTO -->
  <section class="slide slide-dark">
    <div class="topbar">
      <div class="logo-badge">
        <img src="${logoUri}" alt="IQISSMexico" />
      </div>
      <span class="pill pill-dark">8 · Da el primer paso hoy</span>
    </div>

    <div style="display:grid; grid-template-columns: 1.25fr 0.75fr; gap: 36px; align-items:center; flex:1;">
      <div>
        <div style="font-size:12px; font-weight:800; color:#6ee7b7; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">
          Prueba sin riesgo antes de enero 2027
        </div>
        <h1 style="font-size:36px;">Activa 1 mes gratis de Checador Facial o solicita un proyecto a la medida</h1>
        <p class="subtitle" style="margin-top:14px; font-size:15.5px;">
          Consulta planes vigentes, activa tu cuenta en minutos desde nuestro Portal de Clientes o escríbenos por WhatsApp si te quedó alguna pregunta abierta del autodiagnóstico.
        </p>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-top:24px;">
          <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); border-radius:14px; padding:16px;">
            <div style="font-size:11px; color:#a5b4fc; text-transform:uppercase; font-weight:700;">Atención Comercial WhatsApp</div>
            <div style="font-size:19px; font-weight:800; color:#ffffff; margin-top:4px;">+52 314 156 0219</div>
            <div style="font-size:12px; color:#6ee7b7; margin-top:4px;">Respuesta directa con asesor</div>
          </div>
          <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); border-radius:14px; padding:16px;">
            <div style="font-size:11px; color:#a5b4fc; text-transform:uppercase; font-weight:700;">Sitio Oficial y Planes</div>
            <div style="font-size:15px; font-weight:800; color:#ffffff; margin-top:6px;">iqissmexico.com/landingpage/checador</div>
            <div style="font-size:12px; color:#c7d2fe; margin-top:4px;">info@iqissmexico.com</div>
          </div>
        </div>
      </div>

      <div style="background:#ffffff; color:#0f172a; border-radius:20px; padding:24px; text-align:center; box-shadow: 0 12px 30px rgba(0,0,0,0.3);">
        <div style="font-size:13px; font-weight:800; color:#1e1b4b; text-transform:uppercase; letter-spacing:0.04em;">
          Escanea para ver planes y demo
        </div>
        <div style="margin:14px auto; width:210px; height:210px; border:1px solid #e2e8f0; border-radius:14px; padding:10px; background:#ffffff;">
          <img src="${qrUri}" alt="Código QR hacia Checador Facial IQISSMexico" style="width:100%; height:100%; display:block;" />
        </div>
        <div style="font-size:12px; color:#475569; line-height:1.4;">
          <strong>1 mes de prueba gratuita</strong> sin tarjeta de crédito.<br />
          Configuración lista en menos de 10 minutos.
        </div>
      </div>
    </div>

    <div class="footer-note">
      <span>Fuentes: DOF (03/03/2026 y 01/05/2026), LFT Arts. 60, 61, 66–68, 132-XXXIV, 784, 804 y 994-IV Bis, INEGI (UMA 2026 $117.31).</span>
      <span>Aplica en México · Material informativo, no sustituye asesoría legal</span>
    </div>
  </section>

</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html, 'utf8');
console.log('HTML del deck escrito en:', OUT_HTML);
