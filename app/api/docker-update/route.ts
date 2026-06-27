import { spawn } from "child_process";
import { createHash, timingSafeEqual } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateAction = "check" | "update";

type VersionInfo = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
};

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

let updateStartedAt = 0;

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

function isEnabled() {
  return process.env.YUEHOU_DOCKER_UPDATE_ENABLED === "true" && Boolean(process.env.YUEHOU_UPDATE_TOKEN);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

function getRequestToken(request: Request, body: Record<string, unknown>) {
  const authorization = request.headers.get("authorization") || "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return typeof body.token === "string" ? body.token : "";
}

function assertAuthorized(request: Request, body: Record<string, unknown>) {
  const expected = process.env.YUEHOU_UPDATE_TOKEN || "";
  const token = getRequestToken(request, body);

  if (expected.length < 16) {
    throw new Error("Docker 更新密钥未配置。");
  }

  if (!timingSafeEqual(hash(token), hash(expected))) {
    throw new Error("更新密钥不正确。");
  }
}

async function readPackageVersion() {
  const raw = await readFile(path.join(process.cwd(), "package.json"), "utf8");
  const parsed = JSON.parse(raw) as { version?: unknown };

  return typeof parsed.version === "string" ? parsed.version : "0.0.0";
}

async function readLatestVersion() {
  const url =
    process.env.YUEHOU_UPDATE_VERSION_URL ||
    "https://raw.githubusercontent.com/hmbbser/yuehou1/main/package.json";
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("版本检测失败。");
  }

  const data = (await response.json()) as { version?: unknown };

  if (typeof data.version !== "string" || data.version.trim().length === 0) {
    throw new Error("远程版本号无效。");
  }

  return data.version.trim();
}

async function getVersionInfo(): Promise<VersionInfo> {
  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || (await readPackageVersion());
  const latestVersion = await readLatestVersion();

  return {
    currentVersion,
    latestVersion,
    updateAvailable: currentVersion !== latestVersion,
  };
}

function startUpdate(force: boolean) {
  const now = Date.now();

  if (updateStartedAt && now - updateStartedAt < 10 * 60 * 1000) {
    throw new Error("更新正在执行中，请稍后再试。");
  }

  updateStartedAt = now;

  const child = spawn("sh", [path.join(process.cwd(), "scripts", "docker-web-update.sh")], {
    detached: true,
    env: {
      ...process.env,
      YUEHOU_UPDATE_FORCE: force ? "true" : "false",
    },
    stdio: "ignore",
  });

  child.unref();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action === "update" ? "update" : ("check" as UpdateAction);

    if (!isEnabled()) {
      return jsonNoStore({ ok: false, enabled: false, error: "Docker 更新未启用。" }, { status: 403 });
    }

    assertAuthorized(request, body);

    const version = await getVersionInfo();

    if (action === "check") {
      return jsonNoStore({ ok: true, enabled: true, ...version });
    }

    const force = body.force === true;

    if (!force && !version.updateAvailable) {
      return jsonNoStore({ ok: true, enabled: true, started: false, ...version });
    }

    startUpdate(force);

    return jsonNoStore({ ok: true, enabled: true, started: true, ...version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Docker 更新失败。";
    const status = message.includes("密钥") ? 401 : 500;

    return jsonNoStore({ ok: false, enabled: isEnabled(), error: message }, { status });
  }
}
