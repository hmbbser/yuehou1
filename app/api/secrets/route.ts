import { NextResponse } from "next/server";
import { createSecret } from "@/lib/secret-store";
import { EncryptedPayload, SecretRecord } from "@/lib/types";
import { getUploadLimits } from "@/lib/server-upload-limits";
import { isStorageFullError } from "@/lib/storage-errors";
import { formatFileSize } from "@/lib/upload-limits";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers;

  return NextResponse.json(body, {
    ...init,
    headers: {
      ...noStoreHeaders,
      ...(headers as Record<string, string> | undefined),
    },
  });
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;

  return (
    typeof payload.ciphertext === "string" &&
    typeof payload.iv === "string" &&
    typeof payload.salt === "string" &&
    typeof payload.iterations === "number"
  );
}

function normalizeExpiresIn(value: unknown) {
  if (value === null || value === undefined) return null;
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 60 || seconds > 60 * 60 * 24 * 365) {
    return undefined;
  }

  return Math.round(seconds);
}

function getCreateErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "创建失败。";

  if (isStorageFullError(error)) return "存储容量不足，无法保存内容。请减少照片或文字，或等待已有内容销毁后重试。";

  if (message.includes("NOPERM") || message.includes("no permissions")) {
    return "Redis Token 没有写入权限。请在 Upstash 复制 REST API 的读写 Token，并更新 Vercel 环境变量后重新部署。";
  }

  if (message.includes("Redis") || message.includes("environment")) {
    return "Redis 环境变量未配置或不可用。Vercel 请检查 UPSTASH_REDIS_REST_URL / TOKEN，自建 Docker 请检查 REDIS_URL。";
  }

  return "创建失败，请稍后重试。";
}

export async function POST(request: Request) {
  try {
    const { maxSecretRequestBytes } = getUploadLimits();
    const tooLarge = () => jsonNoStore({ ok: false, error: `内容超过当前存储容量（${formatFileSize(maxSecretRequestBytes)}），请减少照片或文字后重试。` }, { status: 413 });
    if (Number(request.headers.get("content-length")) > maxSecretRequestBytes) return tooLarge();
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > maxSecretRequestBytes) {
          await reader.cancel();
          return tooLarge();
        }
        chunks.push(value);
      }
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    const mode = body.mode;
    const expiresIn = normalizeExpiresIn(body.expiresIn);

    if (expiresIn === undefined) {
      return jsonNoStore({ ok: false, error: "销毁时间不合法。" }, { status: 400 });
    }

    const now = Date.now();
    const expiresAt = expiresIn ? now + expiresIn * 1000 : null;
    let record: SecretRecord;

    if (mode === "password") {
      if (!isEncryptedPayload(body.encrypted) || typeof body.proofHash !== "string") {
        return jsonNoStore({ ok: false, error: "密码加密数据不完整。" }, { status: 400 });
      }

      record = {
        version: 1,
        mode: "password",
        encrypted: body.encrypted,
        proofHash: body.proofHash,
        createdAt: now,
        expiresAt,
      };
    } else if (mode === "plain") {
      if (typeof body.secret !== "string" || body.secret.trim().length === 0) {
        return jsonNoStore({ ok: false, error: "秘密内容不能为空。" }, { status: 400 });
      }

      record = {
        version: 1,
        mode: "plain",
        secret: body.secret,
        createdAt: now,
        expiresAt,
      };
    } else {
      return jsonNoStore({ ok: false, error: "未知创建模式。" }, { status: 400 });
    }

    const code = await createSecret(record);
    const origin = new URL(request.url).origin;

    return jsonNoStore({
      ok: true,
      code,
      path: `/${code}`,
      url: `${origin}/${code}`,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    const status = isStorageFullError(error) ? 507 :
      rawMessage.includes("NOPERM") ||
      rawMessage.includes("no permissions") ||
      rawMessage.includes("Redis") ||
      rawMessage.includes("environment")
        ? 503
        : 500;

    return jsonNoStore({ ok: false, error: getCreateErrorMessage(error) }, { status });
  }
}
