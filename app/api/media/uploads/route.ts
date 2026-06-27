import { NextResponse } from "next/server";
import { createMediaUpload, maxVideoBytes } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function normalizeExpiresIn(value: unknown) {
  if (value === null || value === undefined) return null;
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 60 || seconds > 60 * 60 * 24 * 365) {
    return undefined;
  }

  return Math.round(seconds);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const expiresIn = normalizeExpiresIn(body.expiresIn);

    if (expiresIn === undefined) {
      return jsonNoStore({ ok: false, error: "销毁时间不合法。" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name : "";
    const type = typeof body.type === "string" ? body.type : "";
    const size = Number(body.size);
    const upload = await createMediaUpload({ expiresIn, name, size, type });

    return jsonNoStore({
      ok: true,
      chunkSize: upload.chunkSize,
      media: {
        kind: "video",
        id: upload.id,
        name: upload.manifest.name,
        size: upload.manifest.size,
        token: upload.token,
        type: upload.manifest.type,
      },
      uploadId: upload.id,
      uploadToken: upload.token,
    });
  } catch (error) {
    return jsonNoStore(
      { ok: false, error: error instanceof Error ? error.message : "视频上传初始化失败。" },
      { status: 400 },
    );
  }
}

export async function GET() {
  return jsonNoStore({ ok: true, maxVideoBytes });
}
