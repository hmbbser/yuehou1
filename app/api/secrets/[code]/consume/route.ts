import { NextResponse } from "next/server";
import { isBlacklisted, registerSuspiciousMiss } from "@/lib/rate-limit";
import { getRedis } from "@/lib/redis";
import { consumeSecret } from "@/lib/secret-store";
import { getClientIpFromRequest, hashIp, isValidCode } from "@/lib/security";

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

type Params = {
  params: {
    code: string;
  };
};

export async function POST(request: Request, { params }: Params) {
  const ipHash = hashIp(getClientIpFromRequest(request));

  try {
    const redis = getRedis();

    if (await isBlacklisted(redis, ipHash)) {
      return jsonNoStore({ ok: false, error: "访问过于频繁，请 24 小时后再试。" }, { status: 429 });
    }

    if (!isValidCode(params.code)) {
      await registerSuspiciousMiss(redis, ipHash);
      return jsonNoStore({ ok: false, error: "链接不存在或已销毁。" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { proofHash?: unknown };
    const result = await consumeSecret(params.code, typeof body.proofHash === "string" ? body.proofHash : undefined);

    if (result.status === "missing") {
      await registerSuspiciousMiss(redis, ipHash);
      return jsonNoStore({ ok: false, error: "链接不存在、已过期或已销毁。" }, { status: 404 });
    }

    if (result.status === "wrong_password") {
      await registerSuspiciousMiss(redis, ipHash);
      return jsonNoStore({ ok: false, error: "密码不正确，内容尚未销毁。" }, { status: 401 });
    }

    return jsonNoStore({
      ok: true,
      record:
        result.record.mode === "plain"
          ? { mode: "plain", secret: result.record.secret }
          : { mode: "password", encrypted: result.record.encrypted },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取失败。";
    const status = message.includes("Redis") || message.includes("environment") ? 503 : 500;

    return jsonNoStore({ ok: false, error: message }, { status });
  }
}
