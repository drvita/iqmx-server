import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { computeDocumentIntegrityHash } from "@/lib/security/integrity-seal";
import type {
  CheckInDetailCsvRow,
  WeeklyEmployeeCompliance,
} from "@/services/reports/attendance-compliance";

export interface StpsDetailRow extends CheckInDetailCsvRow {
  selloIntegridadSha256?: string | null;
}

export interface GenerateStpsPdfInput {
  org: {
    nombre: string;
    razonSocial: string | null;
    rfc: string | null;
    registroPatronalImss: string | null;
    zonaHoraria: string;
  };
  branchLabel: string;
  periodLabel: string;
  issuedAtIso: string;
  complianceRows: WeeklyEmployeeCompliance[];
  detailRows: StpsDetailRow[];
  includeSummary: boolean;
  includeDetail: boolean;
}

const JORNADA_LABELS: Record<string, string> = {
  diurna: "Diurna",
  mixta: "Mixta",
  nocturna: "Nocturna",
};

/**
 * Sanitiza texto para codificación WinAnsi usada por las fuentes estándar de pdf-lib.
 */
function toWinAnsi(text: string, maxLen = 80): string {
  const cleaned = text
    .replace(/[→⇒]/g, "->")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[·•]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "-")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxLen - 3))}...`;
}

export async function generateStpsCompliancePdf(
  input: GenerateStpsPdfInput
): Promise<{ bytes: Uint8Array; documentHash: string }> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  const pageWidth = 612; // Letter portrait
  const pageHeight = 792;
  const marginX = 36;
  const usableWidth = pageWidth - marginX * 2;
  const bottomLimit = 52;

  const pages: PDFPage[] = [];
  let page = doc.addPage([pageWidth, pageHeight]);
  pages.push(page);
  let y = pageHeight - 40;

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    pages.push(page);
    y = pageHeight - 42;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < bottomLimit) {
      newPage();
    }
  };

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    opts?: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      maxLen?: number;
    }
  ) => {
    page.drawText(toWinAnsi(text, opts?.maxLen ?? 120), {
      x,
      y: yPos,
      font: opts?.font ?? fontRegular,
      size: opts?.size ?? 8.5,
      color: opts?.color ?? rgb(0.12, 0.14, 0.2),
    });
  };

  // Encabezado oficial STPS
  page.drawRectangle({
    x: marginX,
    y: y - 34,
    width: usableWidth,
    height: 38,
    color: rgb(0.12, 0.11, 0.29),
  });
  drawText(
    "REGISTRO OFICIAL DE JORNADA LABORAL - LFT ART. 132 FRACC. XXXIV",
    marginX + 10,
    y - 14,
    { font: fontBold, size: 10.5, color: rgb(1, 1, 1) }
  );
  drawText(
    "Control Electronico de Asistencia y Tiempos Extraordinarios (LFT Arts. 60, 61, 66-69)",
    marginX + 10,
    y - 27,
    { font: fontRegular, size: 8, color: rgb(0.85, 0.88, 0.98) }
  );
  y -= 48;

  // Bloque de datos fiscales y del periodo
  page.drawRectangle({
    x: marginX,
    y: y - 56,
    width: usableWidth,
    height: 56,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.84, 0.87, 0.91),
    borderWidth: 0.75,
  });

  const razonSocial = input.org.razonSocial?.trim() || "No registrado";
  const rfc = input.org.rfc?.trim() || "No registrado";
  const imss = input.org.registroPatronalImss?.trim() || "No registrado";
  const issuedFormatted = new Date(input.issuedAtIso).toLocaleString("es-MX", {
    timeZone: input.org.zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  drawText(`Empresa: ${input.org.nombre}`, marginX + 8, y - 13, {
    font: fontBold,
    size: 8.5,
    maxLen: 60,
  });
  drawText(`Centro de Trabajo: ${input.branchLabel}`, marginX + 300, y - 13, {
    size: 8.5,
    maxLen: 45,
  });
  drawText(`Razon Social: ${razonSocial}`, marginX + 8, y - 26, {
    size: 8,
    maxLen: 60,
  });
  drawText(`RFC: ${rfc}`, marginX + 300, y - 26, { size: 8, maxLen: 25 });
  drawText(`Reg. Patronal IMSS: ${imss}`, marginX + 8, y - 39, {
    size: 8,
    maxLen: 40,
  });
  drawText(`Periodo: ${input.periodLabel}`, marginX + 300, y - 39, {
    font: fontBold,
    size: 8,
    maxLen: 40,
  });
  drawText(
    `Emitido (${input.org.zonaHoraria}): ${issuedFormatted}`,
    marginX + 8,
    y - 51,
    { size: 7.5, color: rgb(0.35, 0.4, 0.48), maxLen: 70 }
  );
  y -= 72;

  const drawSummaryHeader = () => {
    page.drawRectangle({
      x: marginX,
      y: y - 16,
      width: usableWidth,
      height: 16,
      color: rgb(0.93, 0.94, 0.97),
    });
    drawText("Cod.", marginX + 4, y - 11, { font: fontBold, size: 7.5 });
    drawText("Colaborador", marginX + 42, y - 11, { font: fontBold, size: 7.5 });
    drawText("Jornada", marginX + 188, y - 11, { font: fontBold, size: 7.5 });
    drawText("Ord.(h)", marginX + 245, y - 11, { font: fontBold, size: 7.5 });
    drawText("Dob.(h)", marginX + 292, y - 11, { font: fontBold, size: 7.5 });
    drawText("Trip.(h)", marginX + 338, y - 11, { font: fontBold, size: 7.5 });
    drawText("Total(h)", marginX + 385, y - 11, { font: fontBold, size: 7.5 });
    drawText("Ret.", marginX + 438, y - 11, { font: fontBold, size: 7.5 });
    drawText("Alerta", marginX + 472, y - 11, { font: fontBold, size: 7.5 });
    drawText("Dias", marginX + 510, y - 11, { font: fontBold, size: 7.5 });
    y -= 20;
  };

  if (input.includeSummary) {
    ensureSpace(44);
    drawText("1. RESUMEN DE CUMPLIMIENTO Y TIEMPO EXTRAORDINARIO", marginX, y, {
      font: fontBold,
      size: 9.5,
      color: rgb(0.12, 0.11, 0.29),
    });
    y -= 14;
    drawSummaryHeader();

    if (input.complianceRows.length === 0) {
      drawText("Sin colaboradores activos en el filtro seleccionado.", marginX + 4, y - 4, {
        size: 8,
        color: rgb(0.45, 0.5, 0.58),
      });
      y -= 18;
    } else {
      for (const r of input.complianceRows) {
        if (y - 16 < bottomLimit) {
          newPage();
          drawSummaryHeader();
        }
        drawText(r.codigoInterno, marginX + 4, y - 10, { size: 7.5, maxLen: 8 });
        drawText(r.nombreCompleto, marginX + 42, y - 10, {
          font: fontBold,
          size: 7.5,
          maxLen: 26,
        });
        drawText(JORNADA_LABELS[r.tipoJornada] ?? "Diurna", marginX + 188, y - 10, {
          size: 7.5,
        });
        drawText(r.ordinaryHours.toFixed(2), marginX + 245, y - 10, { size: 7.5 });
        drawText(r.doubleOvertimeHours.toFixed(2), marginX + 292, y - 10, {
          size: 7.5,
        });
        drawText(r.tripleOvertimeHours.toFixed(2), marginX + 338, y - 10, {
          size: 7.5,
        });
        drawText(r.workedHours.toFixed(2), marginX + 385, y - 10, {
          font: fontBold,
          size: 7.5,
        });
        drawText(String(r.tardies), marginX + 438, y - 10, { size: 7.5 });
        drawText(String(r.alertaJornada), marginX + 478, y - 10, {
          font: fontBold,
          size: 7.5,
          color:
            r.alertaJornada === 1 ? rgb(0.75, 0.15, 0.15) : rgb(0.05, 0.5, 0.35),
        });
        drawText(String(r.daysComplete), marginX + 514, y - 10, { size: 7.5 });

        page.drawLine({
          start: { x: marginX, y: y - 14 },
          end: { x: marginX + usableWidth, y: y - 14 },
          thickness: 0.4,
          color: rgb(0.9, 0.92, 0.95),
        });
        y -= 16;
      }
    }
    y -= 12;
  }

  const drawDetailHeader = () => {
    page.drawRectangle({
      x: marginX,
      y: y - 16,
      width: usableWidth,
      height: 16,
      color: rgb(0.93, 0.94, 0.97),
    });
    drawText("Fecha y Hora", marginX + 4, y - 11, { font: fontBold, size: 7.5 });
    drawText("Colaborador", marginX + 105, y - 11, { font: fontBold, size: 7.5 });
    drawText("Mov.", marginX + 235, y - 11, { font: fontBold, size: 7.5 });
    drawText("Sucursal / Terminal", marginX + 295, y - 11, {
      font: fontBold,
      size: 7.5,
    });
    drawText("Sello SHA-256", marginX + 435, y - 11, { font: fontBold, size: 7.5 });
    y -= 20;
  };

  if (input.includeDetail) {
    ensureSpace(44);
    drawText("2. BITACORA CRONOLOGICA Y SELLOS DE INTEGRIDAD", marginX, y, {
      font: fontBold,
      size: 9.5,
      color: rgb(0.12, 0.11, 0.29),
    });
    y -= 14;
    drawDetailHeader();

    if (input.detailRows.length === 0) {
      drawText("Sin registros de asistencia en el periodo.", marginX + 4, y - 4, {
        size: 8,
        color: rgb(0.45, 0.5, 0.58),
      });
      y -= 18;
    } else {
      for (const r of input.detailRows) {
        if (y - 16 < bottomLimit) {
          newPage();
          drawDetailHeader();
        }
        const dateFmt = new Date(r.timestampLocalIso).toLocaleString("es-MX", {
          timeZone: input.org.zonaHoraria,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        const sealShort = r.selloIntegridadSha256
          ? r.selloIntegridadSha256.slice(0, 14)
          : "Sin sello(prev)";

        drawText(dateFmt, marginX + 4, y - 10, { size: 7, maxLen: 20 });
        drawText(r.empleadoNombre ?? "No identificado", marginX + 105, y - 10, {
          size: 7,
          maxLen: 24,
        });
        drawText(r.tipo, marginX + 235, y - 10, { size: 7, maxLen: 12 });
        drawText(`${r.sucursalNombre} / ${r.dispositivoNombre}`, marginX + 295, y - 10, {
          size: 7,
          maxLen: 26,
        });
        drawText(sealShort, marginX + 435, y - 10, {
          font: fontMono,
          size: 7,
          maxLen: 16,
        });

        page.drawLine({
          start: { x: marginX, y: y - 14 },
          end: { x: marginX + usableWidth, y: y - 14 },
          thickness: 0.4,
          color: rgb(0.9, 0.92, 0.95),
        });
        y -= 16;
      }
    }
    y -= 10;
  }

  const canonicalSummary = JSON.stringify({
    org: input.org.nombre,
    rfc,
    imss,
    branchLabel: input.branchLabel,
    periodLabel: input.periodLabel,
    issuedAtIso: input.issuedAtIso,
    complianceCount: input.complianceRows.length,
    detailCount: input.detailRows.length,
    totals: input.complianceRows.map((c) => [
      c.empleadoId,
      c.ordinaryHours,
      c.doubleOvertimeHours,
      c.tripleOvertimeHours,
      c.alertaJornada,
    ]),
  });
  const documentHash = computeDocumentIntegrityHash(canonicalSummary);

  ensureSpace(44);
  page.drawRectangle({
    x: marginX,
    y: y - 34,
    width: usableWidth,
    height: 34,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.8, 0.84, 0.9),
    borderWidth: 0.75,
  });
  drawText(
    "SELLO CRIPTOGRAFICO DEL DOCUMENTO (SHA-256):",
    marginX + 8,
    y - 12,
    { font: fontBold, size: 7.5 }
  );
  drawText(documentHash, marginX + 8, y - 24, {
    font: fontMono,
    size: 7.5,
    color: rgb(0.12, 0.11, 0.29),
    maxLen: 70,
  });

  // Pie de página en todas las hojas
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i]!;
    p.drawText(
      toWinAnsi(
        `Checador Facial IQMX - Reporte Oficial STPS | SHA-256: ${documentHash.slice(0, 16)}... | Pagina ${i + 1} de ${totalPages}`,
        110
      ),
      {
        x: marginX,
        y: 22,
        font: fontRegular,
        size: 7,
        color: rgb(0.45, 0.5, 0.58),
      }
    );
  }

  const bytes = await doc.save();
  return { bytes, documentHash };
}
