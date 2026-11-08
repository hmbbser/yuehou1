import { NextResponse } from "next/server";
import { deleteMediaUpload } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const headers = { "Cache-Control": "no-store" };
  try {
    await deleteMediaUpload(params.id, request.headers.get("x-upload-token") || "");
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json({ ok: false, error: "无法移除视频，请稍后重试。" }, { status: 400, headers });
  }
}
