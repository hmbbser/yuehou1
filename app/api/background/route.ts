import { NextResponse } from "next/server";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const seed = encodeURIComponent(`yuehou-${getTodayKey()}`);

  return NextResponse.json(
    {
      ok: true,
      url: `https://picsum.photos/seed/${seed}/1920/1080`,
    },
    { headers: noStoreHeaders },
  );
}
