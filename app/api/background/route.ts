import { NextResponse } from "next/server";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getCustomBackgroundUrl(request: Request) {
  const value = new URL(request.url).searchParams.get("url")?.trim();

  if (!value) return null;

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const seed = encodeURIComponent(`yuehou-${getTodayKey()}`);
  const customUrl = getCustomBackgroundUrl(request);

  return NextResponse.json(
    {
      ok: true,
      url: customUrl ?? `https://picsum.photos/seed/${seed}/1920/1080`,
    },
    { headers: noStoreHeaders },
  );
}
