import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL es obligatoria")
    .default(
      "postgresql://postgres:78f35c961a449ea407@db:5432/iqmx_test?options=-csearch_path%3Dchecador,public"
    ),
  REDIS_URL: z.string().min(1).default("redis://redis:6379"),
  APP_BASE_URL: z.string().url().default("http://localhost:3002"),
  PROVISION_SECRET_KEY: z.string().min(16).optional(),
  MAILTRAP_API_TOKEN: z.string().optional(),
  MAILTRAP_API_URL: z
    .string()
    .url()
    .default("https://send.api.mailtrap.io/api/send"),
  MAIL_FROM_EMAIL: z.string().email().default("no-reply@iqissmexico.com"),
  MAIL_FROM_NAME: z.string().default("Checador Facial IQISS"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;
  cachedEnv = serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    APP_BASE_URL: process.env.APP_BASE_URL,
    PROVISION_SECRET_KEY: process.env.PROVISION_SECRET_KEY,
    MAILTRAP_API_TOKEN: process.env.MAILTRAP_API_TOKEN || undefined,
    MAILTRAP_API_URL: process.env.MAILTRAP_API_URL || undefined,
    MAIL_FROM_EMAIL: process.env.MAIL_FROM_EMAIL || undefined,
    MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || undefined,
  });
  return cachedEnv;
}
