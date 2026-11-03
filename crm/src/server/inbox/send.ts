import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { graphRequest, MetaApiError, normalizeRecipient } from "@/lib/meta/client";
import { destinatarioMeta, type Destinatario } from "@/lib/meta/destinatario";
import { publish } from "@/server/events/bus";
import {
  getCredentialsByOrg,
  getCredentialsByPhoneNumberId,
  markReconnectRequired,
  type Credentials,
} from "@/server/whatsapp/credentials";
import { isWindowOpen, replyWindow } from "@/server/inbox/window";
import { plainSocialText } from "@/lib/social-text";
import { IG_PREFIX } from "@/server/inbox/identity";
import {
  getInstagramCredentialsByOrg,
  markInstagramReconnectRequired,
  type InstagramCredentials,
} from "@/server/instagram/credentials";
import { sendInstagramText } from "@/server/instagram/send";
import { FB_PREFIX } from "@/server/inbox/identity";
import {
  getMessengerCredentialsByOrg,
  markMessengerReconnectRequired,
  type MessengerCredentials,
} from "@/server/messenger/credentials";
import { sendMessengerText } from "@/server/messenger/send";
import {
  capabilitiesFor,
  textFits,
  windowClosedMessage,
  aiWindowClosedMessage,
} from "@/server/channels/capabilities";
import { isChannelEnabledForOrg } from "@/server/channels/enabled";
import { serializeMessage } from "@/server/inbox/ingest";
import { conCita, type CitaEncontrada } from "@/server/inbox/quotes";
import {
  saveMediaFile,
  uploadGraphMedia,
  validateOutgoing,
} from "@/server/whatsapp/media";

/** Error tipado del envío; `code` mapea a HTTP en la capa de API. */
export class SendError extends Error {
  code:
    | "sandbox_violation"
    | "not_connected"
    | "reconnect_required"
    | "window_closed"
    | "meta_error"
    | "meta_unavailable"
    | "upload_failed"
    | "reply_unavailable";
  /** 008: presente cuando el fallo ocurrió TRAS persistir el mensaje (failed). */
  messageId?: string;

  constructor(code: SendError["code"], message: string) {
    super(message);
    this.name = "SendError";
    this.code = code;
  }
}

type SendResult = { messageId: string };

type SendTarget = {
  conversation: typeof schema.conversation.$inferSelect;
  /** null cuando el destino no es WhatsApp (014). */
  credentials: Credentials | null;
  /** El destinatario en la forma que Meta espera: `to` o `recipient`. */
  destinatario: Destinatario;
  /** El identificador a secas, para lo que no arma un payload de Graph. */
  recipient: string;
  /** 014: presente solo en conversaciones de Instagram. */
  instagram?: InstagramCredentials;
  /** 017: presente solo en conversaciones de Messenger. */
  messenger?: MessengerCredentials;
  /**
   * 024: el envío sale con la etiqueta de agente humano. Lo decide el
   * pre-vuelo (`assertReplyWindow`), no cada canal por su cuenta.
   */
  humanAgentTag?: boolean;
};

/**
 * 024 — La puerta de la ventana para los canales con extensión humana
 * (Instagram y Messenger). Devuelve si el envío lleva la etiqueta.
 */
function assertReplyWindow(
  conversation: SendTarget["conversation"],
  aiGenerated: boolean
): boolean {
  const w = replyWindow(conversation.channel, conversation.lastInboundAt);
  if (!w.operatorOpen) {
    throw new SendError("window_closed", windowClosedMessage(conversation.channel));
  }
  if (aiGenerated && !w.standardOpen) {
    throw new SendError("window_closed", aiWindowClosedMessage(conversation.channel));
  }
  return w.humanAgentTag;
}

/**
 * Pre-flight común de todo envío por la conversación (008): existencia +
 * tenant, sandbox del Laboratorio (ASERCIÓN DURA, FR-031: jamás toca la API
 * real), ventana de 24 h, credenciales y destinatario.
 */
async function prepareSend(
  conversationId: string,
  organizationId: string,
  /** 024: quién escribe decide si puede usar la extensión humana. */
  aiGenerated: boolean = false
): Promise<SendTarget> {
  const db = getDb();
  const rows = await db
    .select({
      conversation: schema.conversation,
      contact: schema.contact,
    })
    .from(schema.conversation)
    .innerJoin(
      schema.contact,
      eq(schema.conversation.contactId, schema.contact.id)
    )
    .where(eq(schema.conversation.id, conversationId))
    .limit(1);
  const row = rows[0];
  if (!row || row.conversation.organizationId !== organizationId) {
    throw new SendError("meta_error", "Conversación no encontrada");
  }

  if (row.conversation.isTest) {
    throw new SendError(
      "sandbox_violation",
      "Conversación de prueba del Laboratorio: el envío real está prohibido"
    );
  }

  // 014: Instagram tiene su propio transporte, su propia ventana y NO tiene
  // plantillas. Se resuelve antes que las credenciales de WhatsApp para no
  // exigirle a una instancia de solo-Instagram un numero conectado.
  if (row.conversation.channel === "instagram") {
    // Una conversacion de un canal apagado puede existir (se apago despues de
    // recibirla): falla claro en vez de intentar un transporte que no aplica.
    if (!(await isChannelEnabledForOrg("instagram", organizationId))) {
      throw new SendError(
        "not_connected",
        "El canal de Instagram está desactivado en esta instancia"
      );
    }
    const igCreds = await getInstagramCredentialsByOrg(organizationId);
    if (!igCreds) {
      throw new SendError(
        "not_connected",
        "No hay cuenta de Instagram conectada"
      );
    }
    if (igCreds.status === "reconnect_required") {
      throw new SendError(
        "reconnect_required",
        "El token de Instagram expiró: reconecta la cuenta en Configuración"
      );
    }
    const igRecipient = row.contact.waIdentity.startsWith(IG_PREFIX)
      ? row.contact.waIdentity.slice(IG_PREFIX.length)
      : row.contact.waIdentity;
    const humanAgentTag = assertReplyWindow(row.conversation, aiGenerated);
    return {
      humanAgentTag,
      conversation: row.conversation,
      credentials: null,
      destinatario: { to: igRecipient },
      recipient: igRecipient,
      instagram: igCreds,
    };
  }

  // 017: Messenger, mismo trato que Instagram: transporte propio, ventana
  // propia (con etiqueta fuera de ella) y sin plantillas.
  if (row.conversation.channel === "messenger") {
    if (!(await isChannelEnabledForOrg("messenger", organizationId))) {
      throw new SendError(
        "not_connected",
        "El canal de Messenger está desactivado en esta instancia"
      );
    }
    const fbCreds = await getMessengerCredentialsByOrg(organizationId);
    if (!fbCreds) {
      throw new SendError(
        "not_connected",
        "No hay página de Facebook conectada"
      );
    }
    if (fbCreds.status === "reconnect_required") {
      throw new SendError(
        "reconnect_required",
        "El token de la página expiró: reconecta Messenger en Configuración"
      );
    }
    const fbRecipient = row.contact.waIdentity.startsWith(FB_PREFIX)
      ? row.contact.waIdentity.slice(FB_PREFIX.length)
      : row.contact.waIdentity;
    const humanAgentTag = assertReplyWindow(row.conversation, aiGenerated);
    return {
      humanAgentTag,
      conversation: row.conversation,
      credentials: null,
      destinatario: { to: fbRecipient },
      recipient: fbRecipient,
      messenger: fbCreds,
    };
  }

  // El nucleo no decide la politica: la consulta. WhatsApp exige plantilla
  // fuera de ventana; Instagram etiqueta y sigue; otro canal podria no tener
  // ventana en absoluto.
  const caps = capabilitiesFor(row.conversation.channel);
  if (
    caps.windowMs !== null &&
    caps.outsideWindow === "template" &&
    !isWindowOpen(row.conversation.lastInboundAt)
  ) {
    throw new SendError(
      "window_closed",
      windowClosedMessage(row.conversation.channel)
    );
  }

  const credentials = row.conversation.phoneNumberId
    ? (await getCredentialsByPhoneNumberId(row.conversation.phoneNumberId)) ??
      (await getCredentialsByOrg(organizationId))
    : await getCredentialsByOrg(organizationId);

  if (!credentials) {
    throw new SendError("not_connected", "No hay número de WhatsApp conectado");
  }
  if (credentials.status === "reconnect_required") {
    throw new SendError(
      "reconnect_required",
      "El token de WhatsApp expiró: reconecta el número en Configuración"
    );
  }

  /**
   * 003 — El destinatario, en el campo que Meta espera para cada forma.
   *
   * Un teléfono va en `to`; un BSUID va en `recipient` con
   * `recipient_type: "individual"`. Se mandaba el BSUID en `to` y Meta
   * respondía 131026, que en la bandeja se lee como si el número del cliente
   * no existiera.
   */
  const destinatario = destinatarioMeta(
    row.contact.phone ? normalizeRecipient(row.contact.phone) : null,
    row.contact.waUserId
  );
  const recipient = destinatario
    ? "to" in destinatario
      ? destinatario.to
      : destinatario.recipient
    : null;
  if (!destinatario || !recipient) {
    throw new SendError(
      "meta_error",
      "El contacto no tiene teléfono ni identidad de WhatsApp utilizable"
    );
  }

  return { conversation: row.conversation, credentials, destinatario, recipient };
}

/**
 * 039 — El mensaje al que se responde citando, validado ANTES de enviar: de
 * esta conversación, con id en la plataforma y en un canal que cita. Si no,
 * no se envía: mandarlo sin la cita en silencio haría creer al operador que
 * el cliente verá a qué responde.
 */
async function resolverMensajeCitado(
  target: SendTarget,
  replyToMessageId: string | undefined
): Promise<CitaEncontrada | null> {
  if (!replyToMessageId) return null;
  const caps = capabilitiesFor(target.conversation.channel);
  if (!caps.quoteReplies) {
    throw new SendError(
      "reply_unavailable",
      `${caps.label} no permite responder citando un mensaje`
    );
  }
  const rows = await getDb()
    .select({ message: schema.message, media: schema.mediaAsset })
    .from(schema.message)
    .leftJoin(
      schema.mediaAsset,
      eq(schema.message.mediaAssetId, schema.mediaAsset.id)
    )
    .where(
      and(
        eq(schema.message.organizationId, target.conversation.organizationId),
        eq(schema.message.conversationId, target.conversation.id),
        eq(schema.message.id, replyToMessageId)
      )
    );
  const row = rows[0];
  if (!row) {
    throw new SendError(
      "reply_unavailable",
      "El mensaje que quieres citar no es de esta conversación"
    );
  }
  if (!row.message.waMessageId) {
    throw new SendError(
      "reply_unavailable",
      "Ese mensaje no llegó a WhatsApp, así que no se puede citar"
    );
  }
  return row;
}

async function persistOutbound(input: {
  organizationId: string;
  conversationId: string;
  waMessageId: string | null;
  type: string;
  text: string | null;
  /**
   * 014: 'sent' existe porque no todos los canales confirman por webhook.
   * WhatsApp entra como 'pending' y avanza con los `statuses` de Meta;
   * Instagram no manda ese evento salvo que se suscriba aparte, asi que la
   * aceptacion de la plataforma ES la confirmacion. Sin esto el mensaje se
   * queda con el reloj puesto para siempre aunque ya se haya entregado.
   */
  status: "pending" | "sent" | "failed";
  error?: string | null;
  aiGenerated?: boolean;
  origin: "ai" | "operator";
  mediaAssetId?: string | null;
  media?: typeof schema.mediaAsset.$inferSelect | null;
  /** 039: el mensaje citado, ya validado por `resolverMensajeCitado`. */
  cita?: CitaEncontrada | null;
}): Promise<string> {
  const db = getDb();
  const inserted = await db
    .insert(schema.message)
    .values({
      id: newId("message"),
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      waMessageId: input.waMessageId,
      direction: "out",
      type: input.type,
      text: input.text,
      status: input.status,
      error: input.error ?? null,
      aiGenerated: input.aiGenerated ?? false,
      origin: input.origin,
      mediaAssetId: input.mediaAssetId ?? null,
      replyToWaMessageId: input.cita?.message.waMessageId ?? null,
    })
    .returning();
  const message = inserted[0]!;

  await db
    .update(schema.conversation)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.conversation.id, input.conversationId));

  publish(input.organizationId, {
    type: "message.new",
    data: {
      conversationId: input.conversationId,
      message: serializeMessage(message, input.media ?? null, input.cita ?? null),
    },
  });

  return message.id;
}

/** Envía un mensaje de texto libre por WhatsApp. */
export async function sendText(input: {
  conversationId: string;
  organizationId: string;
  text: string;
  aiGenerated?: boolean;
  /** 039: id local del mensaje al que se responde citando. */
  replyToMessageId?: string;
}): Promise<SendResult> {
  const target = await prepareSend(
    input.conversationId,
    input.organizationId,
    input.aiGenerated ?? false
  );
  const { credentials, recipient } = target;
  const canal = target.conversation.channel;

  // 024: la IA escribe con formato de WhatsApp (y a veces Markdown). En un
  // canal que no lo dibuja se le quitan las marcas ANTES de medir, enviar y
  // guardar: lo que queda en el hilo es lo que el cliente leyó. Lo que escribe
  // una persona no se toca.
  const text =
    input.aiGenerated && capabilitiesFor(canal).textFormat === "plain"
      ? plainSocialText(input.text)
      : input.text;

  const cita = await resolverMensajeCitado(target, input.replyToMessageId);

  const waMessageId = target.instagram
    ? await callInstagramSend(target, text)
    : target.messenger
      ? await callMessengerSend(target, text)
      : await callGraphSend(
          credentials!,
          conCita(
            {
              messaging_product: "whatsapp",
              ...target.destinatario,
              type: "text",
              text: { body: text },
            },
            cita?.message.waMessageId
          )
        );

  const messageId = await persistOutbound({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    waMessageId,
    type: "text",
    text,
    // Un canal sin acuses de entrega confirma al aceptar; uno con acuses
    // avanza despues por webhook. Sin esta distincion el mensaje se queda
    // con el reloj puesto para siempre.
    status: capabilitiesFor(target.conversation.channel).deliveryReceipts
      ? "pending"
      : "sent",
    aiGenerated: input.aiGenerated,
    origin: input.aiGenerated ? "ai" : "operator",
    cita,
  });

  return { messageId };
}

/**
 * 008 — Envía un adjunto de archivo (imagen/video/audio/documento).
 * El archivo queda ANTES en el volumen local (fuente durable de la preview);
 * si Graph falla tras eso, el mensaje se persiste `failed` (visible en el
 * hilo, nunca se pierde en silencio) y el SendError lleva `messageId`.
 */
export async function sendMediaMessage(input: {
  conversationId: string;
  organizationId: string;
  file: { data: Buffer; mimeType: string; fileName?: string };
  caption?: string;
  /** 039: id local del mensaje al que se responde citando. */
  replyToMessageId?: string;
}): Promise<SendResult> {
  // Validación previa (FR-007): tipo y tamaño antes de tocar disco o red.
  const kind = validateOutgoing(input.file.mimeType, input.file.data.byteLength);

  const target = await prepareSend(input.conversationId, input.organizationId);
  const { credentials, recipient } = target;
  const sendCaps = capabilitiesFor(target.conversation.channel);
  if (!sendCaps.outboundMedia) {
    throw new SendError(
      "meta_error",
      `Todavía no se pueden enviar adjuntos por ${sendCaps.label}; manda el texto`
    );
  }
  const cita = await resolverMensajeCitado(target, input.replyToMessageId);

  const db = getDb();
  const assetId = newId("mediaAsset");
  const storagePath = await saveMediaFile(
    input.organizationId,
    assetId,
    input.file.data
  );
  const assetRows = await db
    .insert(schema.mediaAsset)
    .values({
      id: assetId,
      organizationId: input.organizationId,
      kind,
      mimeType: input.file.mimeType,
      fileName: input.file.fileName ?? null,
      fileSize: input.file.data.byteLength,
      caption: input.caption ?? null,
      storagePath,
      fetchStatus: "available",
    })
    .returning();
  const asset = assetRows[0]!;

  try {
    const waMediaId = await uploadGraphMedia(credentials!, input.file);
    await db
      .update(schema.mediaAsset)
      .set({ waMediaId, updatedAt: new Date() })
      .where(eq(schema.mediaAsset.id, assetId));

    const mediaPayload: Record<string, unknown> = { id: waMediaId };
    if (input.caption && kind !== "audio") mediaPayload.caption = input.caption;
    if (kind === "document" && input.file.fileName) {
      mediaPayload.filename = input.file.fileName;
    }
    const waMessageId = await callGraphSend(
      credentials!,
      conCita(
        {
          messaging_product: "whatsapp",
          ...target.destinatario,
          type: kind,
          [kind]: mediaPayload,
        },
        cita?.message.waMessageId
      )
    );

    const messageId = await persistOutbound({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      waMessageId,
      type: kind,
      text: null,
      status: "pending",
      origin: "operator",
      mediaAssetId: assetId,
      media: asset,
      cita,
    });
    return { messageId };
  } catch (err) {
    let sendErr: SendError;
    if (err instanceof SendError) {
      sendErr = err;
    } else if (err instanceof MetaApiError && err.isAuthError) {
      // Mismo criterio que el texto: SOLO 401/código 190 (fix 2026-08-04).
      await markReconnectRequired(input.organizationId);
      sendErr = new SendError(
        "reconnect_required",
        "El token de WhatsApp expiró: reconecta el número en Configuración"
      );
    } else {
      sendErr = new SendError(
        "upload_failed",
        "No se pudo subir el adjunto a WhatsApp"
      );
    }
    // El contenido NO se pierde: mensaje failed con el asset ya en disco.
    sendErr.messageId = await persistOutbound({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      waMessageId: null,
      type: kind,
      text: null,
      status: "failed",
      error: sendErr.message,
      origin: "operator",
      mediaAssetId: assetId,
      media: asset,
      cita,
    });
    throw sendErr;
  }
}

export type LocationInput = {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

export type ContactInput = { name: string; phone: string };

/** 008 — Envía una ubicación o contactos (payload estructurado, sin archivo). */
export async function sendStructured(
  input: {
    conversationId: string;
    organizationId: string;
    /** 039: id local del mensaje al que se responde citando. */
    replyToMessageId?: string;
  } & (
    | { kind: "location"; location: LocationInput }
    | { kind: "contacts"; contacts: ContactInput[] }
  )
): Promise<SendResult> {
  const target = await prepareSend(
    input.conversationId,
    input.organizationId
  );
  const { credentials } = target;
  // Ubicaciones y contactos son mensajes de WhatsApp: en los demás canales no
  // hay credenciales de WhatsApp que usar y Graph los rechazaría.
  if (!credentials) {
    throw new SendError(
      "meta_error",
      "Este canal no admite ubicaciones ni contactos; manda el texto"
    );
  }
  const cita = await resolverMensajeCitado(target, input.replyToMessageId);

  const payload =
    input.kind === "location"
      ? { type: "location", location: input.location }
      : {
          type: "contacts",
          contacts: input.contacts.map((c) => ({
            name: { formatted_name: c.name, first_name: c.name },
            phones: [{ phone: c.phone, type: "CELL" }],
          })),
        };

  const waMessageId = await callGraphSend(
    credentials,
    conCita(
      {
        messaging_product: "whatsapp",
        ...target.destinatario,
        ...payload,
      },
      cita?.message.waMessageId
    )
  );

  const db = getDb();
  const assetRows = await db
    .insert(schema.mediaAsset)
    .values({
      id: newId("mediaAsset"),
      organizationId: input.organizationId,
      kind: input.kind,
      payload: input.kind === "location" ? input.location : input.contacts,
      fetchStatus: "available",
    })
    .returning();
  const asset = assetRows[0]!;

  const messageId = await persistOutbound({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    waMessageId,
    type: input.kind,
    text: null,
    status: "pending",
    origin: "operator",
    mediaAssetId: asset.id,
    media: asset,
    cita,
  });
  return { messageId };
}

/** Llama a Graph /messages y traduce errores de Meta a SendError. */
export async function callGraphSend(
  credentials: Credentials,
  payload: unknown
): Promise<string> {
  try {
    const res = await graphRequest<{ messages?: { id: string }[] }>(
      `${credentials.phoneNumberId}/messages`,
      { method: "POST", token: credentials.token, body: payload }
    );
    const id = res.messages?.[0]?.id;
    if (!id) throw new SendError("meta_error", "Meta no devolvió ID de mensaje");
    return id;
  } catch (err) {
    if (err instanceof MetaApiError) {
      if (err.isAuthError) {
        await markReconnectRequired(credentials.organizationId);
        throw new SendError(
          "reconnect_required",
          "El token de WhatsApp expiró: reconecta el número en Configuración"
        );
      }
      if (err.status === 0 || err.status >= 500) {
        throw new SendError("meta_unavailable", "Meta no está disponible ahora");
      }
      throw new SendError("meta_error", err.message);
    }
    throw err;
  }
}


/**
 * 014 — Envío por el canal de Instagram. Traduce los fallos al mismo
 * vocabulario de SendError que ya usa WhatsApp, para que la bandeja no tenga
 * que aprender un idioma por plataforma.
 */
async function callInstagramSend(
  target: SendTarget,
  text: string
): Promise<string> {
  const creds = target.instagram!;

  const caps = capabilitiesFor("instagram");
  if (!textFits("instagram", text)) {
    throw new SendError(
      "meta_error",
      `${caps.label} no acepta mensajes de más de ${caps.maxTextBytes} bytes: acorta el texto`
    );
  }

  // 024: quién puede usarla lo decidió ya el pre-vuelo (assertReplyWindow).
  const humanAgentTag = target.humanAgentTag ?? false;

  try {
    const res = await sendInstagramText({
      credentials: creds,
      recipient: target.recipient,
      threadRef: target.conversation.channelThreadRef,
      text,
      humanAgentTag,
    });
    return res.platformMessageId;
  } catch (err) {
    if (err instanceof MetaApiError) {
      if (err.isAuthError) {
        await markInstagramReconnectRequired(creds.organizationId);
        throw new SendError(
          "reconnect_required",
          "El token de Instagram expiró o fue revocado: reconecta la cuenta"
        );
      }
      if (err.status === 0 || err.status >= 500) {
        throw new SendError(
          "meta_unavailable",
          "Instagram no está disponible en este momento; intenta de nuevo"
        );
      }
      throw new SendError("meta_error", err.message);
    }
    throw err;
  }
}

/**
 * 017 — Envío por el canal de Messenger. Mismo vocabulario de SendError que
 * WhatsApp e Instagram: la bandeja no aprende un idioma por plataforma.
 */
async function callMessengerSend(
  target: SendTarget,
  text: string
): Promise<string> {
  const creds = target.messenger!;

  const caps = capabilitiesFor("messenger");
  if (!textFits("messenger", text)) {
    throw new SendError(
      "meta_error",
      `${caps.label} no acepta mensajes de más de ${caps.maxTextBytes} bytes: acorta el texto`
    );
  }

  // 024: quién puede usarla lo decidió ya el pre-vuelo (assertReplyWindow).
  const humanAgentTag = target.humanAgentTag ?? false;

  try {
    const res = await sendMessengerText({
      credentials: creds,
      recipient: target.recipient,
      // Zernio responde dentro de SU conversación, no al PSID: sin esta
      // referencia el envío no tiene a dónde ir.
      threadRef: target.conversation.channelThreadRef,
      text,
      humanAgentTag,
    });
    return res.platformMessageId;
  } catch (err) {
    if (err instanceof MetaApiError) {
      if (err.isAuthError) {
        await markMessengerReconnectRequired(creds.organizationId);
        throw new SendError(
          "reconnect_required",
          "El token de la página expiró o fue revocado: reconecta Messenger"
        );
      }
      if (err.status === 0 || err.status >= 500) {
        throw new SendError(
          "meta_unavailable",
          "Messenger no está disponible en este momento; intenta de nuevo"
        );
      }
      throw new SendError("meta_error", err.message);
    }
    throw err;
  }
}
