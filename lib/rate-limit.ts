import { blacklistKey, missKey, RedisClient } from "./redis";
import { BLACKLIST_SECONDS, DEFAULT_MISS_WINDOW_SECONDS, MISS_THRESHOLD } from "./types";

export async function isBlacklisted(redis: RedisClient, ipHash: string) {
  return Boolean(await redis.get(blacklistKey(ipHash)));
}

export async function registerSuspiciousMiss(redis: RedisClient, ipHash: string) {
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
