export const APP_MODULES = [
  "inbox",
  "pipeline",
  "agenda",
  "contacts",
  "asistentes",
  "whatsapp",
  "team",
] as const;

export type AppModule = (typeof APP_MODULES)[number];

export const MODULE_METADATA: Record<
  AppModule,
  { label: string; description: string }
> = {
  inbox: {
    label: "Bandeja de Mensajes",
    description: "Ver y responder chats de WhatsApp en tiempo real",
  },
  pipeline: {
    label: "Pipeline de Ventas",
    description: "Tablero Kanban de leads, etapas y montos",
  },
  agenda: {
    label: "Agenda y Citas",
    description: "Ver disponibilidad, citas reservadas y salas",
  },
  contacts: {
    label: "Directorio de Contactos",
    description: "Información de clientes, notas y fichas",
  },
  asistentes: {
    label: "Asistentes IA",
    description: "Configuración de prompts, personalidades y conocimiento",
  },
  whatsapp: {
    label: "Líneas de WhatsApp",
    description: "Conectar nuevos números y administrar onboarding",
  },
  team: {
    label: "Gestión de Equipo",
    description: "Invitar miembros, cambiar roles y configurar permisos",
  },
};
