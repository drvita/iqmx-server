import type * as OrtTypes from "onnxruntime-web";
import {
  cropAndResizeToMiniFasTensor,
  estimateAffineTransform112,
  l2Normalize,
  letterboxToScrfdTensor,
  nonMaximumSuppression,
  softmax,
  warpAffineRgbaToRgbTensor,
  type BoundingBox,
  type FaceDetection,
  type Point2D,
} from "./math-utils";

export type OrtModule = typeof OrtTypes;
export type InferenceSessionLike = OrtTypes.InferenceSession;

export interface LivenessResult {
  livenessScore: number;
  spoofPaperScore: number;
  spoofScreenScore: number;
}

interface ScrfdLevelSpec {
  stride: number;
  scoreName: string;
  bboxName: string;
  kpsName: string;
}

const SCRFD_LEVELS: readonly ScrfdLevelSpec[] = [
  { stride: 8, scoreName: "443", bboxName: "446", kpsName: "449" },
  { stride: 16, scoreName: "468", bboxName: "471", kpsName: "474" },
  { stride: 32, scoreName: "493", bboxName: "496", kpsName: "499" },
] as const;

const SCRFD_INPUT_SIZE = 640;
const SCRFD_NUM_ANCHORS = 2;

export function decodeScrfdOutputs(
  outputs: Record<string, { data: ArrayLike<number> }>,
  scale: number,
  padX: number,
  padY: number,
  imageWidth: number,
  imageHeight: number,
  scoreThreshold = 0.5,
  iouThreshold = 0.4
): FaceDetection[] {
  const candidates: FaceDetection[] = [];

  for (const level of SCRFD_LEVELS) {
    const scoreTensor = outputs[level.scoreName];
    const bboxTensor = outputs[level.bboxName];
    const kpsTensor = outputs[level.kpsName];
    if (!scoreTensor || !bboxTensor || !kpsTensor) continue;

    const scores = scoreTensor.data;
    const bboxes = bboxTensor.data;
    const kps = kpsTensor.data;

    const gridSize = SCRFD_INPUT_SIZE / level.stride;
    const totalAnchors = gridSize * gridSize * SCRFD_NUM_ANCHORS;
    const count = Math.min(totalAnchors, scores.length);

    for (let idx = 0; idx < count; idx++) {
      const score = scores[idx] ?? 0;
      if (score < scoreThreshold) continue;

      const cellIdx = Math.floor(idx / SCRFD_NUM_ANCHORS);
      const row = Math.floor(cellIdx / gridSize);
      const col = cellIdx % gridSize;
      const cx = col * level.stride;
      const cy = row * level.stride;

      const bOffset = idx * 4;
      const x1 = Math.max(
        0,
        ((cx - (bboxes[bOffset] ?? 0) * level.stride) - padX) / scale
      );
      const y1 = Math.max(
        0,
        ((cy - (bboxes[bOffset + 1] ?? 0) * level.stride) - padY) / scale
      );
      const x2 = Math.min(
        imageWidth,
        ((cx + (bboxes[bOffset + 2] ?? 0) * level.stride) - padX) / scale
      );
      const y2 = Math.min(
        imageHeight,
        ((cy + (bboxes[bOffset + 3] ?? 0) * level.stride) - padY) / scale
      );

      if (x2 <= x1 || y2 <= y1) continue;

      const kOffset = idx * 10;
      const landmarks: [Point2D, Point2D, Point2D, Point2D, Point2D] = [
        {
          x: (cx + (kps[kOffset] ?? 0) * level.stride - padX) / scale,
          y: (cy + (kps[kOffset + 1] ?? 0) * level.stride - padY) / scale,
        },
        {
          x: (cx + (kps[kOffset + 2] ?? 0) * level.stride - padX) / scale,
          y: (cy + (kps[kOffset + 3] ?? 0) * level.stride - padY) / scale,
        },
        {
          x: (cx + (kps[kOffset + 4] ?? 0) * level.stride - padX) / scale,
          y: (cy + (kps[kOffset + 5] ?? 0) * level.stride - padY) / scale,
        },
        {
          x: (cx + (kps[kOffset + 6] ?? 0) * level.stride - padX) / scale,
          y: (cy + (kps[kOffset + 7] ?? 0) * level.stride - padY) / scale,
        },
        {
          x: (cx + (kps[kOffset + 8] ?? 0) * level.stride - padX) / scale,
          y: (cy + (kps[kOffset + 9] ?? 0) * level.stride - padY) / scale,
        },
      ];

      candidates.push({
        bbox: { x1, y1, x2, y2 },
        score,
        landmarks,
      });
    }
  }

  return nonMaximumSuppression(candidates, iouThreshold).sort((a, b) => {
    const areaA = (a.bbox.x2 - a.bbox.x1) * (a.bbox.y2 - a.bbox.y1);
    const areaB = (b.bbox.x2 - b.bbox.x1) * (b.bbox.y2 - b.bbox.y1);
    return areaB - areaA;
  });
}

export async function runScrfdDetection(
  ort: OrtModule,
  session: InferenceSessionLike,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  scoreThreshold = 0.5
): Promise<FaceDetection[]> {
  const { tensor, scale, padX, padY } = letterboxToScrfdTensor(
    rgba,
    width,
    height,
    SCRFD_INPUT_SIZE
  );
  const inputName = session.inputNames[0] ?? "input.1";
  const feeds = {
    [inputName]: new ort.Tensor("float32", tensor, [
      1,
      3,
      SCRFD_INPUT_SIZE,
      SCRFD_INPUT_SIZE,
    ]),
  };

  const outputs = await session.run(feeds);
  const plainOutputs: Record<string, { data: ArrayLike<number> }> = {};
  for (const name of Object.keys(outputs)) {
    const t = outputs[name];
    if (t) {
      plainOutputs[name] = { data: t.data as ArrayLike<number> };
    }
  }

  return decodeScrfdOutputs(
    plainOutputs,
    scale,
    padX,
    padY,
    width,
    height,
    scoreThreshold
  );
}

export async function runMiniFasLiveness(
  ort: OrtModule,
  session: InferenceSessionLike,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  bbox: BoundingBox
): Promise<LivenessResult> {
  const tensor = cropAndResizeToMiniFasTensor(rgba, width, height, bbox, 2.7, 80);
  const inputName = session.inputNames[0] ?? "input";
  const feeds = {
    [inputName]: new ort.Tensor("float32", tensor, [1, 3, 80, 80]),
  };

  const outputs = await session.run(feeds);
  const outName = session.outputNames[0] ?? "output";
  const logitsTensor = outputs[outName];
  if (!logitsTensor) {
    throw new Error("MiniFASNetV2 no devolvió tensor de salida");
  }

  const probs = softmax(logitsTensor.data as ArrayLike<number>);
  return {
    spoofPaperScore: probs[0] ?? 0,
    livenessScore: probs[1] ?? 0,
    spoofScreenScore: probs[2] ?? 0,
  };
}

export async function runArcFaceEmbedding(
  ort: OrtModule,
  session: InferenceSessionLike,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  landmarks: readonly Point2D[]
): Promise<Float32Array> {
  const affine = estimateAffineTransform112(landmarks);
  const alignedTensor = warpAffineRgbaToRgbTensor(
    rgba,
    width,
    height,
    affine,
    112
  );
  const inputName = session.inputNames[0] ?? "input.1";
  const feeds = {
    [inputName]: new ort.Tensor("float32", alignedTensor, [1, 3, 112, 112]),
  };

  const outputs = await session.run(feeds);
  const outName = session.outputNames[0] ?? "516";
  const embTensor = outputs[outName];
  if (!embTensor) {
    throw new Error("MobileFaceNet no devolvió embedding 512d");
  }

  const raw = embTensor.data as ArrayLike<number>;
  const vec = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    vec[i] = raw[i] ?? 0;
  }
  return l2Normalize(vec);
}
