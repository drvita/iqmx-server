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
  });
  return cachedEnv;
}
