import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

export function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("Missing Vercel KV / Upstash Redis environment variables.");
  }

  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }

  return redisClient;
}

export function secretKey(code: string) {
  return `yuehou:secret:${code}`;
}

export function missKey(ipHash: string) {
  return `yuehou:miss:${ipHash}`;
}

export function blacklistKey(ipHash: string) {
  return `yuehou:blacklist:${ipHash}`;
}
