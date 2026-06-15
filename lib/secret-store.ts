import { getRedis, secretKey } from "./redis";
import { generateCode, isValidCode } from "./security";
import { SecretRecord } from "./types";

const CONSUME_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then
  return {0}
end

local record = cjson.decode(raw)
if record["mode"] == "password" then
  if ARGV[1] == "" or ARGV[1] ~= record["proofHash"] then
    return {2}
  end
end

redis.call("DEL", KEYS[1])
return {1, raw}
`;

export async function createSecret(record: SecretRecord) {
  const redis = getRedis();
  const ttl = record.expiresAt ? Math.max(1, Math.floor((record.expiresAt - Date.now()) / 1000)) : undefined;

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const code = generateCode();
    const key = secretKey(code);
    const result = ttl
      ? await redis.set(key, JSON.stringify(record), { nx: true, ex: ttl })
      : await redis.set(key, JSON.stringify(record), { nx: true });

    if (result === "OK") {
      return code;
    }
  }

  throw new Error("Unable to allocate a short code. Please try again.");
}

export async function getSecretRecord(code: string) {
  if (!isValidCode(code)) {
    return null;
  }

  const redis = getRedis();
  const raw = await redis.get<string | SecretRecord>(secretKey(code));

  if (!raw) {
    return null;
  }

  const record = typeof raw === "string" ? (JSON.parse(raw) as SecretRecord) : raw;

  if (record.expiresAt && record.expiresAt <= Date.now()) {
    await redis.del(secretKey(code));
    return null;
  }

  return record;
}

export async function consumeSecret(code: string, proofHash?: string) {
  const redis = getRedis();
  const result = (await redis.eval(CONSUME_SCRIPT, [secretKey(code)], [proofHash ?? ""])) as [number, string?];
  const status = result[0];

  if (status === 0) {
    return { status: "missing" as const };
  }

  if (status === 2) {
    return { status: "wrong_password" as const };
  }

  const record = JSON.parse(result[1] ?? "{}") as SecretRecord;

  if (record.expiresAt && record.expiresAt <= Date.now()) {
    return { status: "missing" as const };
  }

  return { status: "ok" as const, record };
}
