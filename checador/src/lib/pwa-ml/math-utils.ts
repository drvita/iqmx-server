export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FaceDetection {
  bbox: BoundingBox;
  score: number;
  landmarks: [Point2D, Point2D, Point2D, Point2D, Point2D];
}

export type AffineMatrix2x3 = [
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * Coordenadas estándar de los 5 landmarks faciales para ArcFace / MobileFaceNet (112x112):
 * ojo izquierdo, ojo derecho, punta de nariz, comisura izquierda, comisura derecha.
 */
export const ARCFACE_DST_LANDMARKS: readonly [
  Point2D,
  Point2D,
  Point2D,
  Point2D,
  Point2D,
] = [
  { x: 38.2946, y: 51.6963 },
  { x: 73.5318, y: 51.5014 },
  { x: 56.0252, y: 71.7366 },
  { x: 41.5493, y: 92.3655 },
  { x: 70.7299, y: 92.2041 },
] as const;

export function l2Normalize(vec: Float32Array): Float32Array {
  const out = new Float32Array(vec.length);
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i] ?? 0;
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq);
  if (norm <= 1e-12) {
    return out;
  }
  for (let i = 0; i < vec.length; i++) {
    out[i] = (vec[i] ?? 0) / norm;
  }
  return out;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom <= 1e-12) return 0;
  return dot / denom;
}

export function softmax(logits: ArrayLike<number>): Float32Array {
  const n = logits.length;
  const probs = new Float32Array(n);
  if (n === 0) return probs;

  let maxVal = -Infinity;
  for (let i = 0; i < n; i++) {
    const val = logits[i] ?? 0;
    if (val > maxVal) maxVal = val;
  }

  let sumExp = 0;
  for (let i = 0; i < n; i++) {
    const e = Math.exp((logits[i] ?? 0) - maxVal);
    probs[i] = e;
    sumExp += e;
  }

  if (sumExp <= 0) return probs;
  for (let i = 0; i < n; i++) {
    probs[i] = (probs[i] ?? 0) / sumExp;
  }
  return probs;
}

export function computeIoU(boxA: BoundingBox, boxB: BoundingBox): number {
  const interX1 = Math.max(boxA.x1, boxB.x1);
  const interY1 = Math.max(boxA.y1, boxB.y1);
  const interX2 = Math.min(boxA.x2, boxB.x2);
  const interY2 = Math.min(boxA.y2, boxB.y2);

  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const interArea = interW * interH;
  if (interArea <= 0) return 0;

  const areaA = Math.max(0, boxA.x2 - boxA.x1) * Math.max(0, boxA.y2 - boxA.y1);
  const areaB = Math.max(0, boxB.x2 - boxB.x1) * Math.max(0, boxB.y2 - boxB.y1);
  const unionArea = areaA + areaB - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

export function nonMaximumSuppression(
  detections: readonly FaceDetection[],
  iouThreshold = 0.4
): FaceDetection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept: FaceDetection[] = [];

  for (const candidate of sorted) {
    let suppressed = false;
    for (const existing of kept) {
      if (computeIoU(candidate.bbox, existing.bbox) > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) {
      kept.push(candidate);
    }
  }

  return kept;
}

/**
 * Estima la transformación de similitud 2D (escala + rotación + traslación, sin reflexión)
 * mediante mínimos cuadrados desde `landmarks5` (origen) hacia `ARCFACE_DST_LANDMARKS` (destino 112x112).
 * Devuelve [a, -b, tx, b, a, ty] tal que:
 *   dstX = a * srcX - b * srcY + tx
 *   dstY = b * srcX + a * srcY + ty
 */
export function estimateAffineTransform112(
  landmarks5: readonly Point2D[]
): AffineMatrix2x3 {
  if (landmarks5.length !== 5) {
    throw new Error("Se requieren exactamente 5 landmarks para alineación ArcFace");
  }

  let srcMeanX = 0;
  let srcMeanY = 0;
  let dstMeanX = 0;
  let dstMeanY = 0;

  for (let i = 0; i < 5; i++) {
    const src = landmarks5[i]!;
    const dst = ARCFACE_DST_LANDMARKS[i]!;
    srcMeanX += src.x;
    srcMeanY += src.y;
    dstMeanX += dst.x;
    dstMeanY += dst.y;
  }

  srcMeanX /= 5;
  srcMeanY /= 5;
  dstMeanX /= 5;
  dstMeanY /= 5;

  let srcVar = 0;
  let numA = 0;
  let numB = 0;

  for (let i = 0; i < 5; i++) {
    const src = landmarks5[i]!;
    const dst = ARCFACE_DST_LANDMARKS[i]!;
    const sx = src.x - srcMeanX;
    const sy = src.y - srcMeanY;
    const dx = dst.x - dstMeanX;
    const dy = dst.y - dstMeanY;

    srcVar += sx * sx + sy * sy;
    numA += sx * dx + sy * dy;
    numB += sx * dy - sy * dx;
  }

  if (srcVar <= 1e-12) {
    return [1, 0, 0, 0, 1, 0];
  }

  const a = numA / srcVar;
  const b = numB / srcVar;
  const tx = dstMeanX - (a * srcMeanX - b * srcMeanY);
  const ty = dstMeanY - (b * srcMeanX + a * srcMeanY);

  return [a, -b, tx, b, a, ty];
}

function sampleRgbaBilinear(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  srcX: number,
  srcY: number
): [number, number, number] {
  if (srcX < 0 || srcY < 0 || srcX > width - 1 || srcY > height - 1) {
    return [0, 0, 0];
  }

  const x0 = Math.floor(srcX);
  const y0 = Math.floor(srcY);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const wx = srcX - x0;
  const wy = srcY - y0;

  const idx00 = (y0 * width + x0) * 4;
  const idx10 = (y0 * width + x1) * 4;
  const idx01 = (y1 * width + x0) * 4;
  const idx11 = (y1 * width + x1) * 4;

  const w00 = (1 - wx) * (1 - wy);
  const w10 = wx * (1 - wy);
  const w01 = (1 - wx) * wy;
  const w11 = wx * wy;

  const r =
    (rgba[idx00] ?? 0) * w00 +
    (rgba[idx10] ?? 0) * w10 +
    (rgba[idx01] ?? 0) * w01 +
    (rgba[idx11] ?? 0) * w11;
  const g =
    (rgba[idx00 + 1] ?? 0) * w00 +
    (rgba[idx10 + 1] ?? 0) * w10 +
    (rgba[idx01 + 1] ?? 0) * w01 +
    (rgba[idx11 + 1] ?? 0) * w11;
  const b =
    (rgba[idx00 + 2] ?? 0) * w00 +
    (rgba[idx10 + 2] ?? 0) * w10 +
    (rgba[idx01 + 2] ?? 0) * w01 +
    (rgba[idx11 + 2] ?? 0) * w11;

  return [r, g, b];
}

/**
 * Aplica la transformación afín inversa desde una imagen RGBA hacia un tensor
 * NCHW [1, 3, outSize, outSize] en orden RGB normalizado con (pixel - 127.5) / 127.5.
 */
export function warpAffineRgbaToRgbTensor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  matrix: AffineMatrix2x3,
  outSize = 112
): Float32Array {
  const [m00, m01, m02, m10, m11, m12] = matrix;
  const det = m00 * m11 - m01 * m10;
  const planeSize = outSize * outSize;
  const tensor = new Float32Array(3 * planeSize);

  if (Math.abs(det) <= 1e-12 || width <= 0 || height <= 0) {
    return tensor;
  }

  // Inversa de la matriz afín 2x3 para mapear cada píxel destino -> origen
  const inv00 = m11 / det;
  const inv01 = -m01 / det;
  const inv02 = (m01 * m12 - m11 * m02) / det;
  const inv10 = -m10 / det;
  const inv11 = m00 / det;
  const inv12 = (m10 * m02 - m00 * m12) / det;

  for (let dy = 0; dy < outSize; dy++) {
    for (let dx = 0; dx < outSize; dx++) {
      const sx = inv00 * dx + inv01 * dy + inv02;
      const sy = inv10 * dx + inv11 * dy + inv12;
      const [r, g, b] = sampleRgbaBilinear(rgba, width, height, sx, sy);

      const offset = dy * outSize + dx;
      tensor[offset] = (r - 127.5) / 127.5;
      tensor[planeSize + offset] = (g - 127.5) / 127.5;
      tensor[planeSize * 2 + offset] = (b - 127.5) / 127.5;
    }
  }

  return tensor;
}

/**
 * Recorta la región expandida por `scale` (2.7 por defecto para MiniFASNetV2),
 * redimensiona a outSize x outSize y entrega tensor NCHW [1, 3, 80, 80] en orden BGR [0..255].
 */
export function cropAndResizeToMiniFasTensor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  bbox: BoundingBox,
  scale = 2.7,
  outSize = 80
): Float32Array {
  const planeSize = outSize * outSize;
  const tensor = new Float32Array(3 * planeSize);
  if (width <= 0 || height <= 0) return tensor;

  const boxW = Math.max(1, bbox.x2 - bbox.x1);
  const boxH = Math.max(1, bbox.y2 - bbox.y1);
  const centerX = bbox.x1 + boxW / 2;
  const centerY = bbox.y1 + boxH / 2;

  const boundedScale = Math.min(
    scale,
    (width - 1) / boxW,
    (height - 1) / boxH
  );
  const effectiveScale = Math.max(1, boundedScale);
  const newW = boxW * effectiveScale;
  const newH = boxH * effectiveScale;

  const cropX1 = Math.max(0, centerX - newW / 2);
  const cropY1 = Math.max(0, centerY - newH / 2);
  const cropX2 = Math.min(width - 1, cropX1 + newW);
  const cropY2 = Math.min(height - 1, cropY1 + newH);
  const cropW = Math.max(1, cropX2 - cropX1);
  const cropH = Math.max(1, cropY2 - cropY1);

  for (let dy = 0; dy < outSize; dy++) {
    const sy = cropY1 + ((dy + 0.5) * cropH) / outSize - 0.5;
    const clampedY = Math.max(0, Math.min(height - 1, sy));
    for (let dx = 0; dx < outSize; dx++) {
      const sx = cropX1 + ((dx + 0.5) * cropW) / outSize - 0.5;
      const clampedX = Math.max(0, Math.min(width - 1, sx));
      const [r, g, b] = sampleRgbaBilinear(rgba, width, height, clampedX, clampedY);

      const offset = dy * outSize + dx;
      // Silent-Face-Anti-Spoofing espera BGR sin dividir por 255
      tensor[offset] = b;
      tensor[planeSize + offset] = g;
      tensor[planeSize * 2 + offset] = r;
    }
  }

  return tensor;
}

export interface LetterboxScrfdResult {
  tensor: Float32Array;
  scale: number;
  padX: number;
  padY: number;
}

/**
 * Convierte imagen RGBA a tensor NCHW [1, 3, inputSize, inputSize] con letterbox
 * para SCRFD (det_500m.onnx), normalizando con (pixel - 127.5) / 128.0 en orden RGB.
 */
export function letterboxToScrfdTensor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  inputSize = 640
): LetterboxScrfdResult {
  const planeSize = inputSize * inputSize;
  const tensor = new Float32Array(3 * planeSize);
  // Fondo 0 tras normalizar (~127.5 gris neutro)
  if (width <= 0 || height <= 0) {
    return { tensor, scale: 1, padX: 0, padY: 0 };
  }

  const scale = Math.min(inputSize / width, inputSize / height);
  const resizedW = Math.max(1, Math.round(width * scale));
  const resizedH = Math.max(1, Math.round(height * scale));
  const padX = 0;
  const padY = 0;

  for (let dy = 0; dy < resizedH; dy++) {
    const sy = Math.min(height - 1, Math.max(0, (dy + 0.5) / scale - 0.5));
    for (let dx = 0; dx < resizedW; dx++) {
      const sx = Math.min(width - 1, Math.max(0, (dx + 0.5) / scale - 0.5));
      const [r, g, b] = sampleRgbaBilinear(rgba, width, height, sx, sy);

      const offset = dy * inputSize + dx;
      tensor[offset] = (r - 127.5) / 128.0;
      tensor[planeSize + offset] = (g - 127.5) / 128.0;
      tensor[planeSize * 2 + offset] = (b - 127.5) / 128.0;
    }
  }

  return { tensor, scale, padX, padY };
}
