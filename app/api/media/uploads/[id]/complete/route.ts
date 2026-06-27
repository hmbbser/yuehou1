import { NextResponse } from "next/server";
import { completeMediaUpload } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

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

export async function POST(request: Request, { params }: Params) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: unknown };
    const manifest = await completeMediaUpload(params.id, typeof body.token === "string" ? body.token : "");

    return jsonNoStore({ ok: true, uploaded: manifest.uploaded });
  } catch (error) {
    return jsonNoStore(
      { ok: false, error: error instanceof Error ? error.message : "视频上传完成失败。" },
      { status: 400 },
    );
  }
}
