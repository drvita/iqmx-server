/**
 * Prepara los artefactos locales de IA para Fase 0:
 * 1. Copia binarios WASM y runtime JS de onnxruntime-web hacia public/ort/
 * 2. Descarga los 3 modelos .onnx hacia public/models/ (con URLs de respaldo)
 * 3. Valida tamaños mínimos, calcula SHA-256 y genera public/models/manifest.json
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const modelsDir = path.join(rootDir, "public", "models");
const ortDir = path.join(rootDir, "public", "ort");
const ortDistDir = path.join(rootDir, "node_modules", "onnxruntime-web", "dist");

const MIN_MODEL_BYTES = 100 * 1024; // 100 KB mínimo para descartar HTML de error

const MODEL_SPECS = [
  {
    id: "face-detector",
    filename: "det_500m.onnx",
    stage: "Detección y 5 Landmarks (SCRFD buffalo_s)",
    urls: [
      "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_s/det_500m.onnx",
      "https://huggingface.co/tonythethompson/insightface-buffalo-s-onnx/resolve/main/det_500m.onnx",
    ],
  },
  {
    id: "liveness-detector",
    filename: "2.7_80x80_MiniFASNetV2.onnx",
    stage: "Anti-Spoofing / Liveness (MiniFASNetV2)",
    urls: [
      "https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/resolve/main/2.7_80x80_MiniFASNetV2.onnx",
      "https://github.com/QingHeYang/Silent-Face-Anti-Spoofing-onnx/raw/main/onnx/2.7_80x80_MiniFASNetV2.onnx",
    ],
  },
  {
    id: "face-recognizer",
    filename: "w600k_mbf.onnx",
    stage: "Reconocimiento 512d (MobileFaceNet buffalo_s)",
    urls: [
      "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_s/w600k_mbf.onnx",
      "https://huggingface.co/tonythethompson/insightface-buffalo-s-onnx/resolve/main/w600k_mbf.onnx",
    ],
  },
];

async function fileExistsWithMinSize(filePath, minBytes) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size >= minBytes;
  } catch {
    return false;
  }
}

async function computeSha256(filePath) {
  const buffer = await fs.readFile(filePath);
  return {
    sizeBytes: buffer.byteLength,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

async function copyOrtWasmFiles() {
  await fs.mkdir(ortDir, { recursive: true });
  let entries;
  try {
    entries = await fs.readdir(ortDistDir);
  } catch (error) {
    // En contenedores de producción (standalone), node_modules no está presente.
    // Verificamos si los binarios WASM/MJS ya fueron copiados a public/ort/ durante el build.
    try {
      const existingInPublic = await fs.readdir(ortDir);
      const wasmFiles = existingInPublic.filter(
        (name) =>
          name.startsWith("ort-wasm") &&
          (name.endsWith(".wasm") || name.endsWith(".mjs"))
      );
      if (wasmFiles.length > 0) {
        console.log(
          `[ort] Se detectaron ${wasmFiles.length} binarios WASM/MJS preinstalados en public/ort/`
        );
        return wasmFiles;
      }
    } catch {
      // Ignorar y continuar con advertencia
    }

    console.warn(
      "[models:download] No se encontró node_modules/onnxruntime-web/dist ni binarios en public/ort/.",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }

  const runtimeFiles = entries.filter(
    (name) =>
      name.startsWith("ort-wasm") &&
      (name.endsWith(".wasm") || name.endsWith(".mjs"))
  );

  const copied = [];
  for (const file of runtimeFiles) {
    const src = path.join(ortDistDir, file);
    const dest = path.join(ortDir, file);
    await fs.copyFile(src, dest);
    copied.push(file);
  }
  console.log(`[ort] Copiados ${copied.length} archivos WASM/MJS a public/ort/`);
  return copied;
}

async function downloadModel(spec) {
  const destPath = path.join(modelsDir, spec.filename);
  const tmpPath = `${destPath}.tmp`;

  if (await fileExistsWithMinSize(destPath, MIN_MODEL_BYTES)) {
    const info = await computeSha256(destPath);
    console.log(
      `[models] Ya existe ${spec.filename} (${(info.sizeBytes / 1024 / 1024).toFixed(2)} MB)`
    );
    return {
      id: spec.id,
      filename: spec.filename,
      stage: spec.stage,
      sizeBytes: info.sizeBytes,
      sha256: info.sha256,
      sourceUrl: "local-cache",
      ready: true,
    };
  }

  let lastError = null;
  for (const url of spec.urls) {
    try {
      console.log(`[models] Descargando ${spec.filename} desde ${url} ...`);
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "iqmx-checador-setup/0.1",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        throw new Error(`Respuesta HTML inesperada (${contentType})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.byteLength < MIN_MODEL_BYTES) {
        throw new Error(
          `Archivo demasiado pequeño (${buffer.byteLength} bytes < ${MIN_MODEL_BYTES})`
        );
      }

      await fs.writeFile(tmpPath, buffer);
      await fs.rename(tmpPath, destPath);
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

      console.log(
        `[models] OK ${spec.filename} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`
      );

      return {
        id: spec.id,
        filename: spec.filename,
        stage: spec.stage,
        sizeBytes: buffer.byteLength,
        sha256,
        sourceUrl: url,
        ready: true,
      };
    } catch (error) {
      lastError = error;
      await fs.unlink(tmpPath).catch(() => {});
      console.warn(
        `[models] Falló ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new Error(
    `No se pudo descargar ${spec.filename}: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

async function main() {
  await fs.mkdir(modelsDir, { recursive: true });
  const ortFiles = await copyOrtWasmFiles();

  const models = [];
  for (const spec of MODEL_SPECS) {
    models.push(await downloadModel(spec));
  }

  const manifest = {
    version: "buffalo_s_v1",
    generatedAt: new Date().toISOString(),
    ortFiles,
    models,
  };

  const manifestPath = path.join(modelsDir, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[models] Manifiesto generado en ${manifestPath}`);
}

main().catch((error) => {
  console.error("[models:download] Error fatal:", error);
  process.exit(1);
});
