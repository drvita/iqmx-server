import { describe, expect, it } from "vitest";
import {
  computeScaledDimensions,
  isHeicFile,
  MAX_ENROLLMENT_IMAGE_BYTES,
  selectFilesWithinLimit,
  validateImageFileForEnrollment,
} from "@/lib/pwa-ml/image-loader";

describe("image-loader para enrolamiento facial (HEIC y carga múltiple)", () => {
  it("detecta archivos HEIC/HEIF por MIME o extensión (incluyendo mayúsculas y MIME vacío)", () => {
    expect(isHeicFile({ name: "IMG_1024.HEIC", type: "" })).toBe(true);
    expect(isHeicFile({ name: "foto.heif", type: "image/heif" })).toBe(true);
    expect(isHeicFile({ name: "foto.bin", type: "image/heic" })).toBe(true);
    expect(isHeicFile({ name: "foto.jpg", type: "image/jpeg" })).toBe(false);
  });

  it("valida formato y tamaño máximo de 20 MB", () => {
    expect(
      validateImageFileForEnrollment({
        name: "rostro.HEIC",
        type: "",
        size: 1_500_000,
      })
    ).toEqual({ ok: true });

    expect(
      validateImageFileForEnrollment({
        name: "vacio.jpg",
        type: "image/jpeg",
        size: 0,
      }).ok
    ).toBe(false);

    expect(
      validateImageFileForEnrollment({
        name: "gigante.png",
        type: "image/png",
        size: MAX_ENROLLMENT_IMAGE_BYTES + 1,
      }).ok
    ).toBe(false);

    expect(
      validateImageFileForEnrollment({
        name: "documento.pdf",
        type: "application/pdf",
        size: 12_000,
      }).ok
    ).toBe(false);
  });

  it("escala imágenes grandes proporcionalmente sin agrandar imágenes pequeñas", () => {
    expect(computeScaledDimensions(800, 600, 1280)).toEqual({
      width: 800,
      height: 600,
    });
    expect(computeScaledDimensions(4032, 3024, 1280)).toEqual({
      width: 1280,
      height: 960,
    });
    expect(computeScaledDimensions(1500, 3000, 1280)).toEqual({
      width: 640,
      height: 1280,
    });
  });

  it("limita la selección múltiple a los espacios restantes hasta máximo 3", () => {
    expect(selectFilesWithinLimit(["a", "b", "c", "d"], 0, 3)).toEqual({
      selected: ["a", "b", "c"],
      ignoredCount: 1,
    });
    expect(selectFilesWithinLimit(["a", "b", "c"], 2, 3)).toEqual({
      selected: ["a"],
      ignoredCount: 2,
    });
    expect(selectFilesWithinLimit(["a"], 3, 3)).toEqual({
      selected: [],
      ignoredCount: 1,
    });
  });
});
