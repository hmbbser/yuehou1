import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient } from "redis";

type SetOptions = {
  ex?: number;
  nx?: true;
};

export type RedisClient = {
  del(key: string): Promise<number>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  get<T = unknown>(key: string): Promise<T | null>;
  incr(key: string): Promise<number>;
  set(key: string, value: string, options?: SetOptions): Promise<"OK" | null>;
};

let redisClient: RedisClient | null = null;

function createUpstashClient(url: string, token: string): RedisClient {
  const client = new UpstashRedis({ url, token });

  return {
    del: (key) => client.del(key),
    eval: (script, keys, args) => client.eval(script, keys, args),
    expire: (key, seconds) => client.expire(key, seconds),
    get: (key) => client.get(key),
    incr: (key) => client.incr(key),
    async set(key, value, options) {
      const result =
        options?.ex && options.nx
          ? await client.set(key, value, { ex: options.ex, nx: true })
          : options?.ex
            ? await client.set(key, value, { ex: options.ex })
            : options?.nx
              ? await client.set(key, value, { nx: true })
              : await client.set(key, value);

      return result === "OK" ? "OK" : null;
    },
  };
}

function createNativeClient(url: string): RedisClient {
  const client = createClient({ url });

  client.on("error", (error) => {
    console.error("Redis connection error", error);
  });

  const ready = client.connect();
  const getReadyClient = async () => {
    await ready;
    return client;
  };

  return {
    async del(key) {
      return (await getReadyClient()).del(key);
    },
    async eval(script, keys, args) {
      return (await getReadyClient()).eval(script, { arguments: args, keys });
    },
    async expire(key, seconds) {
      return (await getReadyClient()).expire(key, seconds);
    },
    async get<T = unknown>(key: string) {
      return ((await getReadyClient()).get(key) as Promise<T | null>);
    },
    async incr(key) {
      return (await getReadyClient()).incr(key);
    },
    async set(key, value, options) {
      const nativeClient = await getReadyClient();
      const result =
        options?.ex && options.nx
          ? await nativeClient.set(key, value, { EX: options.ex, NX: true })
          : options?.ex
            ? await nativeClient.set(key, value, { EX: options.ex })
            : options?.nx
              ? await nativeClient.set(key, value, { NX: true })
              : await nativeClient.set(key, value);

      return result === "OK" ? "OK" : null;
    },
  };
}

export function getRedis() {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  const nativeUrl = process.env.REDIS_URL;

  if (!restUrl || !restToken) {
    if (!nativeUrl) {
      throw new Error("Missing Redis environment variables. Set Vercel KV / Upstash REST variables or REDIS_URL.");
    }
  }

  if (!redisClient) {
    redisClient = restUrl && restToken ? createUpstashClient(restUrl, restToken) : createNativeClient(nativeUrl!);
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
