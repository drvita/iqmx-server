import Redis from "ioredis";
import { getEnv } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  __iqmxChecadorRedis?: Redis;
};

export function getRedis(): Redis {
  if (!globalForRedis.__iqmxChecadorRedis) {
    const env = getEnv();
    globalForRedis.__iqmxChecadorRedis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      lazyConnect: true,
    });
  }
  return globalForRedis.__iqmxChecadorRedis;
}

export async function pingRedis(): Promise<boolean> {
  const redis = getRedis();
  if (redis.status === "wait") {
    await redis.connect();
  }
  const pong = await redis.ping();
  return pong === "PONG";
}
