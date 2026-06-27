import { NextResponse } from "next/server";
import { appendMediaChunk } from "@/lib/media-store";

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

export async function PUT(request: Request, { params }: Params) {
  try {
    const token = request.headers.get("x-upload-token") || "";
    const offset = Number(request.headers.get("x-upload-offset") || "0");
    const bytes = await request.arrayBuffer();
    const manifest = await appendMediaChunk(params.id, token, offset, bytes);

    return jsonNoStore({ ok: true, uploaded: manifest.uploaded });
  } catch (error) {
    return jsonNoStore(
      { ok: false, error: error instanceof Error ? error.message : "视频分片上传失败。" },
      { status: 400 },
    );
  }
}
