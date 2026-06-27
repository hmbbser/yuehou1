import { Readable } from "stream";
import { openMedia, MediaRange } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

function parseRange(value: string | null, size: number): MediaRange | null {
  if (!value) return null;

  const match = value.match(/^bytes=(\d*)-(\d*)$/);

  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  let start = rawStart ? Number(rawStart) : 0;
  let end = rawEnd ? Number(rawEnd) : size - 1;

  if (!rawStart && rawEnd) {
    const suffixLength = Number(rawEnd);

    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null;
  }

  return {
    end: Math.min(end, size - 1),
    start,
  };
}

function contentDisposition(name: string) {
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, (value) =>
    `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `inline; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || "";
    const media = await openMedia(params.id, token);
    const range = parseRange(request.headers.get("range"), media.manifest.size);
    const start = range?.start ?? 0;
    const end = range?.end ?? media.manifest.size - 1;
    const stream = Readable.toWeb(media.createStream(range ?? undefined)) as ReadableStream;
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Content-Disposition": contentDisposition(media.manifest.name),
      "Content-Length": String(end - start + 1),
      "Content-Type": media.manifest.type,
      "X-Content-Type-Options": "nosniff",
    });

    if (range) {
      headers.set("Content-Range", `bytes ${start}-${end}/${media.manifest.size}`);
    }

    return new Response(stream, {
      headers,
      status: range ? 206 : 200,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "媒体不存在。" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
        status: 404,
      },
    );
  }
}
