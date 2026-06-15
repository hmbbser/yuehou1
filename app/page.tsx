"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LogoMark } from "@/components/LogoMark";
import { Shell } from "@/components/Shell";
import { encryptWithPassword } from "@/lib/client-crypto";

type ExpiryValue = "300" | "custom" | "never";

type CreateResponse =
  | { ok: true; code: string; url: string; path: string }
  | { ok: false; error: string };

const expiryOptions: Array<{ label: string; value: ExpiryValue; hint: string }> = [
  { label: "5 分钟", value: "300", hint: "快速销毁" },
  { label: "自定义", value: "custom", hint: "按分钟" },
  { label: "无限期", value: "never", hint: "待读取" },
];

const fallbackQuotes = [
  { text: "黑色世界唯有东方的曙光。", author: "佚名" },
  { text: "我该如何顺利地到达山顶？放弃思考，专注攀登！", author: "尼采" },
  { text: "保持热爱，奔赴下一场山海。", author: "佚名" },
  { text: "答案在风里，也在你继续写下去的手里。", author: "佚名" },
  { text: "把秘密交给火，把明天交给自己。", author: "佚名" },
  { text: "慢慢来，比较快。", author: "佚名" },
  { text: "愿你穿过夜色，仍有轻盈的心。", author: "佚名" },
  { text: "要么庸俗，要么孤独。", author: "叔本华" },
  { text: "凡是过往，皆为序章。", author: "莎士比亚" },
  { text: "凌晨四点钟，看到海棠花未眠。", author: "川端康成" },
  { text: "世界以痛吻我，要我报之以歌。", author: "泰戈尔" },
  { text: "吹灭读书灯，一身都是月。", author: "孙玉石" },
  { text: "人生天地间，忽如远行客。", author: "古诗十九首" },
  { text: "山中何事？松花酿酒，春水煎茶。", author: "张可久" },
  { text: "款款独行，才不致倾溢。", author: "木心" },
  { text: "迷途漫漫，终有一归。", author: "米兰·昆德拉" },
  { text: "人间枝头，各自乘流。", author: "佚名" },
  { text: "万物皆有裂痕，那是光进来的地方。", author: "莱昂纳德·科恩" },
];

function formatQuote(text: string, author?: string | null) {
  const cleanText = text.trim();
  const cleanAuthor = author?.trim();

  return cleanAuthor ? `「${cleanText}」 —— ${cleanAuthor}` : `「${cleanText}」`;
}

function getFallbackQuote() {
  const recent = getRecentQuotes();
  const candidates = fallbackQuotes.filter((quote) => !recent.includes(quote.text));
  const pool = candidates.length > 0 ? candidates : fallbackQuotes;
  const quote = pool[Math.floor(Math.random() * pool.length)];

  return formatQuote(quote.text, quote.author);
}

function getQuoteText(quote: string) {
  return quote.replace(/^「/, "").split("」")[0]?.trim() || quote;
}

function getRecentQuotes() {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(localStorage.getItem("recent-quotes") || "[]") as string[];
  } catch {
    return [];
  }
}

function rememberQuote(quote: string) {
  const text = getQuoteText(quote);
  const nextRecent = [text, ...getRecentQuotes().filter((item) => item !== text)].slice(0, 8);

  localStorage.setItem("recent-quotes", JSON.stringify(nextRecent));
}

export default function HomePage() {
  const [secret, setSecret] = useState("");
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState<ExpiryValue>("300");
  const [customMinutes, setCustomMinutes] = useState("30");
  const [resultUrl, setResultUrl] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dailyQuote, setDailyQuote] = useState(() => getFallbackQuote());
  const secretRef = useRef<HTMLTextAreaElement>(null);

  const expiresIn = useMemo(() => {
    if (expiry === "never") return null;
    if (expiry === "custom") {
      const minutes = Number(customMinutes);
      return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0;
    }
    return Number(expiry);
  }, [customMinutes, expiry]);
  const completion = {
    content: secret.trim().length > 0,
    time: expiry !== "custom" || (expiresIn ?? 0) > 0,
    password: password.trim().length > 0,
  };

  useEffect(() => {
    const focusSecret = () => secretRef.current?.focus({ preventScroll: true });
    const frame = window.requestAnimationFrame(focusSecret);
    const timer = window.setTimeout(focusSecret, 180);

    focusSecret();

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fallback = getFallbackQuote();

    setDailyQuote(fallback);
    rememberQuote(fallback);

    fetch(`/api/quote?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { ok?: boolean; quote?: string | null } | null) => {
        const quote = data?.quote?.trim();

        if (quote && !getRecentQuotes().includes(getQuoteText(quote))) {
          setDailyQuote(quote);
          rememberQuote(quote);
        }
      })
      .catch(() => {
        // 本地随机句已兜底，这里静默失败即可。
      });

    return () => controller.abort();
  }, []);

  function insertNewLine() {
    const textarea = secretRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextSecret = `${secret.slice(0, start)}\n${secret.slice(end)}`;

    setSecret(nextSecret);
    window.requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true });
      textarea.selectionStart = start + 1;
      textarea.selectionEnd = start + 1;
    });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setCopied(false);

    if (!secret.trim()) {
      setStatus("先写一点要焚毁的内容。");
      return;
    }

    if (expiresIn === 0) {
      setStatus("自定义销毁时间至少 1 分钟。");
      return;
    }

    setIsLoading(true);

    try {
      const body =
        password.trim().length > 0
          ? {
              mode: "password",
              expiresIn,
              ...(await encryptWithPassword(secret, password)),
            }
          : {
              mode: "plain",
              expiresIn,
              secret,
            };

      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as CreateResponse;

      if (!response.ok || !data.ok) {
        setStatus(data.ok === false ? data.error : "创建失败，请稍后重试。");
        return;
      }

      setResultUrl(data.url);
      setStatus(password ? "已生成密码短链，正确密码读取后才会焚毁。" : "已生成极速短链，第一次读取后立刻焚毁。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "创建失败，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResult() {
    if (!resultUrl) return;

    await navigator.clipboard.writeText(resultUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Shell>
      <section className="hero">
        <div className="hero-icon">
          <LogoMark large />
          <span className="verified-badge">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </div>
        <h1>阅后即焚</h1>
      </section>

      <form className="oauth-panel create-panel" onSubmit={handleCreate}>
        <label className="field">
          <span className="field-head">
            <span>秘密内容</span>
            <button className="newline-button" onClick={insertNewLine} type="button">
              换行
            </button>
          </span>
          <textarea
            autoComplete="off"
            autoFocus
            onChange={(event) => setSecret(event.target.value)}
            placeholder={dailyQuote}
            ref={secretRef}
            value={secret}
          />
        </label>

        <div className="section-title">销毁时间</div>
        <div className="expiry-grid">
          {expiryOptions.map((option) => (
            <button
              className={expiry === option.value ? "choice-card choice-card--active" : "choice-card"}
              key={option.value}
              onClick={() => setExpiry(option.value)}
              type="button"
            >
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </button>
          ))}
        </div>

        {expiry === "custom" ? (
          <label className="field field--inline">
            <span>自定义分钟数</span>
            <input
              inputMode="numeric"
              min="1"
              onChange={(event) => setCustomMinutes(event.target.value)}
              type="number"
              value={customMinutes}
            />
          </label>
        ) : null}

        <label className="field">
          <span>访问密码</span>
          <input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="masked-input"
            name="burn-key"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="可留空；重要内容建议设置"
            spellCheck={false}
            type="text"
            value={password}
          />
        </label>

        <div className="completion-meter" aria-label="填写进度">
          <span className={completion.content ? "active" : ""}>
            <i />
          </span>
          <span className={completion.time ? "active" : ""}>
            <i />
          </span>
          <span className={completion.password ? "active" : ""}>
            <i />
          </span>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        {resultUrl ? (
          <div className="result-box">
            <code>{resultUrl}</code>
            <button className="icon-button" onClick={copyResult} type="button">
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        ) : null}

        <div className="action-stack">
          <button className="btn-pill btn-pill-primary" disabled={isLoading} type="submit">
            {isLoading ? "生成中..." : "生成阅后即焚链接"}
          </button>
          <button
            className="btn-pill btn-pill-secondary"
            disabled={isLoading}
            onClick={() => {
              setSecret("");
              setPassword("");
              setResultUrl("");
              setStatus("");
            }}
            type="button"
          >
            清空
          </button>
        </div>
      </form>
    </Shell>
  );
}
