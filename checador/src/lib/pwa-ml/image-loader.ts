export const MAX_ENROLLMENT_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_ENROLLMENT_CANVAS_DIM = 1280;

const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const SUPPORTED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
]);

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().trim().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

/**
 * Detecta si un archivo corresponde a formato HEIC/HEIF (iPhone/iOS) por MIME o extensión.
 */
export function isHeicFile(file: { name: string; type?: string }): boolean {
  const mime = (file.type ?? "").toLowerCase().trim();
  if (HEIC_MIME_TYPES.has(mime)) return true;
  const ext = getExtension(file.name);
  return ext === "heic" || ext === "heif";
}

/**
 * Valida tamaño y formato antes de decodificar una fotografía para enrolamiento.
 */
export function validateImageFileForEnrollment(file: {
  name: string;
  type?: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      ok: false,
      error: `El archivo "${file.name}" está vacío o dañado.`,
    };
  }
  if (file.size > MAX_ENROLLMENT_IMAGE_BYTES) {
    return {
      ok: false,
      error: `El archivo "${file.name}" supera el máximo de 20 MB.`,
    };
  }

  const mime = (file.type ?? "").toLowerCase().trim();
  const ext = getExtension(file.name);
  const isMimeImage = mime.startsWith("image/");
  const isKnownExt = SUPPORTED_EXTENSIONS.has(ext);

  if (!isMimeImage && !isKnownExt) {
    return {
      ok: false,
      error: `El archivo "${file.name}" no es una imagen compatible (usa JPG, PNG, WebP o HEIC).`,
    };
  }

  return { ok: true };
}

/**
 * Calcula dimensiones escaladas manteniendo la relación de aspecto sin agrandar imágenes pequeñas.
 */
export function computeScaledDimensions(
  width: number,
  height: number,
  maxDim: number = MAX_ENROLLMENT_CANVAS_DIM
): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(width));
  const safeH = Math.max(1, Math.round(height));
  const maxSide = Math.max(safeW, safeH);
  if (maxSide <= maxDim) {
    return { width: safeW, height: safeH };
  }
  const scale = maxDim / maxSide;
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

/**
 * Recorta una lista de archivos seleccionados a los espacios disponibles del colaborador.
 */
export function selectFilesWithinLimit<T>(
  files: readonly T[],
  currentCount: number,
  maxCount: number = 3
): { selected: T[]; ignoredCount: number } {
  const remaining = Math.max(0, maxCount - currentCount);
  const selected = files.slice(0, remaining);
  return {
    selected,
    ignoredCount: Math.max(0, files.length - selected.length),
  };
}

export type ImageDecodeStage = "converting_heic" | "decoding";

function loadHtmlImageFromBlob(blob: Blob, filename: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          `No se pudo leer la imagen "${filename}". Verifica que no esté dañada o en un formato no soportado.`
        )
      );
    };
    img.src = url;
  });
}

/**
 * Decodifica una imagen (incluyendo HEIC/HEIF de iPhone) a un HTMLCanvasElement
 * 100% en el navegador, escalada para inferencia biométrica estable.
 */
export async function decodeImageFileToCanvas(
  file: File,
  onStage?: (stage: ImageDecodeStage) => void
): Promise<HTMLCanvasElement> {
  const validation = validateImageFileForEnrollment(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  let sourceBlob: Blob = file;
  if (isHeicFile(file)) {
    onStage?.("converting_heic");
    try {
      const { heicTo } = await import("heic-to");
      sourceBlob = await heicTo({
        blob: file,
        type: "image/jpeg",
        quality: 0.9,
      });
    } catch {
      throw new Error(
        `No se pudo convertir la foto HEIC "${file.name}". Intenta exportarla como JPG o toma una nueva fotografía.`
      );
    }
  }

  onStage?.("decoding");
  const img = await loadHtmlImageFromBlob(sourceBlob, file.name);
  const { width, height } = computeScaledDimensions(
    img.naturalWidth || 480,
    img.naturalHeight || 480
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("El navegador no pudo inicializar el lienzo de imagen.");
  }
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}
