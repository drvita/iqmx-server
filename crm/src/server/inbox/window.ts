/**
 * Ventana de servicio de 24 horas de WhatsApp: solo se puede enviar texto
 * libre dentro de las 24h siguientes al último mensaje ENTRANTE. Una
 * conversación sin entrantes (p. ej. iniciada por plantilla) tiene la
 * ventana cerrada.
 */

import type { Channel } from "@/lib/channels";
import { capabilitiesFor, windowMsFor } from "@/server/channels/capabilities";

export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** 024 — Quién puede escribir ahora en una conversación, y cómo sale. */
export type ReplyWindow = {
  /** Ventana normal del canal abierta: escribe cualquiera, persona o IA. */
  standardOpen: boolean;
  /** Una persona puede escribir (ventana normal o extensión humana). */
  operatorOpen: boolean;
  /** La respuesta de la persona sale con la etiqueta de agente humano. */
  humanAgentTag: boolean;
  /** Lo que le queda a una persona para contestar, en ms. */
  operatorRemainingMs: number;
};

/**
 * 024 — La ventana de respuesta de un canal, vista desde quien escribe.
 *
 * Cuenta desde el último mensaje del CLIENTE: lo que manda el negocio no la
 * alarga. Sin entrantes, con una fecha inválida o con una del futuro no hay
 * ventana: no se puede afirmar que el cliente escribió hace poco.
 */
export function replyWindow(
  channel: Channel,
  lastInboundAt: Date | null,
  now: Date = new Date()
): ReplyWindow {
  const cerrada: ReplyWindow = {
    standardOpen: false,
    operatorOpen: false,
    humanAgentTag: false,
    operatorRemainingMs: 0,
  };
  const elapsed = lastInboundAt ? now.getTime() - lastInboundAt.getTime() : NaN;
  if (!Number.isFinite(elapsed) || elapsed < 0) return cerrada;

  const standardMs = windowMsFor(channel);
  const standardOpen = elapsed < standardMs;
  if (!Number.isFinite(standardMs)) {
    return {
      standardOpen: true,
      operatorOpen: true,
      humanAgentTag: false,
      operatorRemainingMs: Number.MAX_SAFE_INTEGER,
    };
  }
  // La extensión nunca es más corta que la ventana normal.
  const limit = Math.max(standardMs, capabilitiesFor(channel).humanAgentWindowMs ?? 0);
  const operatorOpen = elapsed < limit;
  return {
    standardOpen,
    operatorOpen,
    humanAgentTag: operatorOpen && !standardOpen,
    operatorRemainingMs: operatorOpen ? limit - elapsed : 0,
  };
}

export function isWindowOpen(
  lastInboundAt: Date | null,
  now: Date = new Date(),
  windowMs = WINDOW_MS
): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < windowMs;
}

/** Ventana extendida de 7 días para canales de mensajería de Meta con etiqueta HUMAN_AGENT (Messenger / Instagram). */
export function isWithinSevenDaysWindow(
  lastInboundAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < SEVEN_DAYS_MS;
}

/** Milisegundos restantes de ventana (0 si está cerrada). */
export function windowRemainingMs(
  lastInboundAt: Date | null,
  now: Date = new Date()
): number {
  if (!lastInboundAt) return 0;
  const remaining = WINDOW_MS - (now.getTime() - lastInboundAt.getTime());
  return Math.max(0, remaining);
}

