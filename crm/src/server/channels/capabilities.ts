import { CHANNEL_LABEL, type Channel } from "@/lib/channels";

/**
 * 014 — Capacidades declaradas por canal.
 *
 * El núcleo NO debe saber las reglas de WhatsApp: debe preguntarlas. Antes,
 * la ventana de 24 h y el "usa una plantilla aprobada" vivían incrustados en
 * el camino genérico de envío, así que cada canal nuevo tenía que pelearse con
 * suposiciones que no eran suyas — Instagram no tiene plantillas, y su salida
 * fuera de ventana es una etiqueta.
 *
 * Agregar un canal debería ser: escribir su adaptador y declarar aquí lo que
 * puede y no puede hacer.
 */

export type OutsideWindowStrategy =
  /** Solo se puede reabrir con una plantilla aprobada (WhatsApp). */
  | "template"
  /** Se marca el mensaje como respuesta de agente humano (Instagram). */
  | "human_agent_tag"
  /** No hay forma: fuera de ventana no se envía. */
  | "none";

export type ChannelCapabilities = {
  /** Etiqueta legible, para mensajes de error dirigidos al operador. */
  label: string;
  /** Ventana de servicio en ms desde el último entrante; null = sin ventana. */
  windowMs: number | null;
  /** Qué se puede hacer cuando la ventana está cerrada. */
  outsideWindow: OutsideWindowStrategy;
  /**
   * 024 — Hasta cuándo puede contestar una PERSONA con la etiqueta de agente
   * humano, en ms desde el último entrante. null = el canal no tiene esa
   * extensión. La IA nunca la usa: Meta la reserva a personas.
   */
  humanAgentWindowMs: number | null;
  /**
   * 024 — Qué formato de texto dibuja el canal. `plain`: ninguno, así que al
   * texto de la IA se le quitan las marcas antes de enviarlo.
   */
  textFormat: "whatsapp" | "plain";
  /** Límite de texto en BYTES (no caracteres); null = sin límite práctico. */
  maxTextBytes: number | null;
  /** ¿Se pueden mandar adjuntos por este canal hoy? */
  outboundMedia: boolean;
  /**
   * 028 — ¿Admite ubicación y contactos? Son mensajes de WhatsApp: en los
   * demás canales el compositor ni los ofrece.
   */
  structuredMessages: boolean;
  /**
   * ¿El estado del mensaje avanza por webhook (entregado/leído)? Si no, la
   * aceptación de la plataforma es la confirmación y el mensaje nace `sent`
   * — sin esto se queda con el reloj puesto para siempre.
   */
  deliveryReceipts: boolean;
  /**
   * 039 — ¿Se puede responder citando un mensaje concreto? Solo WhatsApp
   * (`context.message_id`). Zernio ignora la cita en Instagram y Messenger, e
   * Instagram con Instagram Login no la documenta (spec 039 · D5).
   */
  quoteReplies: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const CHANNEL_CAPABILITIES: Record<Channel, ChannelCapabilities> = {
  whatsapp: {
    label: CHANNEL_LABEL.whatsapp,
    windowMs: DAY_MS,
    outsideWindow: "template",
    humanAgentWindowMs: null,
    textFormat: "whatsapp",
    maxTextBytes: null,
    outboundMedia: true,
    structuredMessages: true,
    deliveryReceipts: true,
    quoteReplies: true,
  },
  instagram: {
    label: CHANNEL_LABEL.instagram,
    windowMs: DAY_MS,
    outsideWindow: "human_agent_tag",
    humanAgentWindowMs: 7 * DAY_MS,
    textFormat: "plain",
    // Meta corta en 1000 bytes: con acentos y emojis el margen real es menor
    // de lo que aparenta al contar caracteres.
    maxTextBytes: 1000,
    outboundMedia: false,
    structuredMessages: false,
    deliveryReceipts: false,
    quoteReplies: false,
  },
  // 017: Messenger comparte la plataforma de mensajería de Meta con Instagram
  // (misma ventana de 24 h, misma etiqueta HUMAN_AGENT fuera de ella, sin
  // plantillas), pero admite textos más largos: 2000 caracteres. Se declara
  // en bytes para no ser más generoso que la plataforma con acentos y emojis.
  messenger: {
    label: CHANNEL_LABEL.messenger,
    windowMs: DAY_MS,
    outsideWindow: "human_agent_tag",
    humanAgentWindowMs: 7 * DAY_MS,
    textFormat: "plain",
    maxTextBytes: 2000,
    outboundMedia: false,
    structuredMessages: false,
    deliveryReceipts: true,
    quoteReplies: false,
  },
};

export function capabilitiesFor(channel: Channel): ChannelCapabilities {
  return CHANNEL_CAPABILITIES[channel] ?? CHANNEL_CAPABILITIES.whatsapp;
}

/**
 * 022 — La ventana de servicio de un canal, en ms. Con `null` (un canal sin
 * ventana) se devuelve Infinity: nunca se cierra.
 */
export function windowMsFor(channel: Channel): number {
  return capabilitiesFor(channel).windowMs ?? Number.POSITIVE_INFINITY;
}

/** Mensaje para el operador cuando la ventana está cerrada, según el canal. */
export function windowClosedMessage(channel: Channel): string {
  const caps = capabilitiesFor(channel);
  switch (caps.outsideWindow) {
    case "template":
      return "La ventana de 24 horas está cerrada; usa una plantilla aprobada";
    case "human_agent_tag":
      // 024: dentro de la extensión el envío sale etiquetado solo y no se le
      // pide nada al operador; este mensaje es para cuando también venció.
      return `La ventana de atención de ${caps.label} está cerrada: solo se puede contestar hasta ${dias(caps.humanAgentWindowMs)} después del último mensaje del cliente. Hay que esperar a que vuelva a escribir`;
    case "none":
      return `La ventana de ${caps.label} está cerrada y este canal no permite reabrirla: hay que esperar a que el cliente vuelva a escribir`;
  }
}

/**
 * 024 — Mensaje cuando quien intenta escribir es la IA y la ventana normal ya
 * cerró, aunque una persona todavía pueda contestar.
 */
export function aiWindowClosedMessage(channel: Channel): string {
  const caps = capabilitiesFor(channel);
  return `La ventana de respuestas automáticas de ${caps.label} está cerrada: pasadas ${horas(caps.windowMs)} del último mensaje del cliente solo puede contestar una persona`;
}

const horas = (ms: number | null) => `${Math.round((ms ?? 0) / (60 * 60 * 1000))} horas`;
const dias = (ms: number | null) => `${Math.round((ms ?? 0) / DAY_MS)} días`;

/** ¿Este texto cabe en el canal? */
export function textFits(channel: Channel, text: string): boolean {
  const max = capabilitiesFor(channel).maxTextBytes;
  if (max === null) return true;
  return Buffer.byteLength(text, "utf8") <= max;
}
