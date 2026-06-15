import { Redis } from "@upstash/redis";
import { blacklistKey, missKey } from "./redis";
import { BLACKLIST_SECONDS, DEFAULT_MISS_WINDOW_SECONDS, MISS_THRESHOLD } from "./types";

export async function isBlacklisted(redis: Redis, ipHash: string) {
  return Boolean(await redis.get(blacklistKey(ipHash)));
}

export async function registerSuspiciousMiss(redis: Redis, ipHash: string) {
  const key = missKey(ipHash);
  const misses = await redis.incr(key);

  if (misses === 1) {
    await redis.expire(key, DEFAULT_MISS_WINDOW_SECONDS);
  }

  if (misses >= MISS_THRESHOLD) {
    await redis.set(blacklistKey(ipHash), "1", { ex: BLACKLIST_SECONDS });
  }

  return misses;
}
