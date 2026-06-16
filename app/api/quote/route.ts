import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Quote = {
  author: string | null;
  text: string;
};

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

function formatQuote(text: string, author?: string | null) {
  const cleanText = text.trim();
  const cleanAuthor = author?.trim();

  return cleanAuthor ? `「${cleanText}」 —— ${cleanAuthor}` : `「${cleanText}」`;
}

async function fetchHitokoto(): Promise<Quote | null> {
  const categories = ["a", "b", "c", "d", "h", "i", "j", "k"];
  const query = categories.map((category) => `c=${category}`).join("&");
  const response = await fetch(`https://v1.hitokoto.cn/?encode=json&${query}&t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "User-Agent": "yuehou/1.0",
    },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    from?: string;
    from_who?: string | null;
    hitokoto?: string;
  };
  const text = data.hitokoto?.trim();

  if (!text) return null;

  return {
    author: data.from_who || data.from || null,
    text,
  };
}

async function fetchJinrishici(): Promise<Quote | null> {
  const response = await fetch(`https://v1.jinrishici.com/all.json?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "User-Agent": "yuehou/1.0",
    },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    author?: string;
    content?: string;
    origin?: string;
  };
  const text = data.content?.trim();

  if (!text) return null;

  return {
    author: data.author || data.origin || null,
    text,
  };
}

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("source");
  const fetchers =
    source === "hitokoto"
      ? [fetchHitokoto]
      : Math.random() > 0.5
        ? [fetchHitokoto, fetchJinrishici]
        : [fetchJinrishici, fetchHitokoto];

  for (const fetchQuote of fetchers) {
    try {
      const quote = await fetchQuote();

      if (quote) {
        return NextResponse.json(
          {
            ok: true,
            quote: formatQuote(quote.text, quote.author),
          },
          { headers: noStoreHeaders },
        );
      }
    } catch {
      // Try the next source.
    }
  }

  return NextResponse.json({ ok: false, quote: null }, { headers: noStoreHeaders, status: 503 });
}
