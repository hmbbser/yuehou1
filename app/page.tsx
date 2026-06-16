"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LogoMark } from "@/components/LogoMark";
import { readSettings, settingsChangeEvent } from "@/components/SettingsPanel";
import { Shell } from "@/components/Shell";
import { encryptWithPassword } from "@/lib/client-crypto";
import { siteName } from "@/lib/site";

type ExpiryValue = "300" | "custom" | "never";
type QuoteSource = "default" | "hitokoto";

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

function getFallbackQuote(rememberRecent = true) {
  const recent = getRecentQuotes();
  const candidates = fallbackQuotes.filter((quote) => !recent.includes(quote.text));
  const pool = candidates.length > 0 ? candidates : fallbackQuotes;
  const quote = pool[Math.floor(Math.random() * pool.length)];

  const formatted = formatQuote(quote.text, quote.author);

  if (rememberRecent) {
    rememberQuote(formatted);
  }

  return formatted;
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
  const [showAutoCopyToast, setShowAutoCopyToast] = useState(false);
  const [dailyQuote, setDailyQuote] = useState("");
  const [quoteSource, setQuoteSource] = useState<QuoteSource>(() => readSettings().quoteSource);
  const [settingsReady, setSettingsReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const secretRef = useRef<HTMLTextAreaElement>(null);
  const loadedQuoteSourceRef = useRef<QuoteSource | null>(null);

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
    if (!settingsReady) return;
    if (loadedQuoteSourceRef.current === quoteSource) return;
    loadedQuoteSourceRef.current = quoteSource;

    const controller = new AbortController();

    if (quoteSource === "default") {
      const fallback = getFallbackQuote();

      setDailyQuote(fallback);
      return () => controller.abort();
    }

    const fallback = getFallbackQuote(false);

    fetch(`/api/quote?source=${quoteSource}&t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { ok?: boolean; quote?: string | null } | null) => {
        const quote = data?.quote?.trim();

        if (quote) {
          setDailyQuote(quote);
          rememberQuote(quote);
        } else {
          setDailyQuote(fallback);
          rememberQuote(fallback);
        }
      })
      .catch(() => {
        setDailyQuote(fallback);
        rememberQuote(fallback);
      });

    return () => controller.abort();
  }, [quoteSource, settingsReady]);

  useEffect(() => {
    const syncSettings = () => {
      const nextSource = readSettings().quoteSource;

      setQuoteSource(nextSource);
      setSettingsReady(true);
    };

    syncSettings();
    window.addEventListener(settingsChangeEvent, syncSettings);

    return () => window.removeEventListener(settingsChangeEvent, syncSettings);
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
      setStatus("");
      try {
        await navigator.clipboard.writeText(data.url);
        setCopied(true);
        setShowAutoCopyToast(true);
        window.setTimeout(() => setShowAutoCopyToast(false), 2200);
      } catch {
        setCopied(false);
      }
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

  function resetCreateForm() {
    setSecret("");
    setPassword("");
    setResultUrl("");
    setStatus("");
    setCopied(false);
    setShowAutoCopyToast(false);
    window.requestAnimationFrame(() => secretRef.current?.focus({ preventScroll: true }));
  }

  return (
    <Shell>
      {showAutoCopyToast ? <div className="toast-notice">链接已经自动复制</div> : null}
      <section className="hero">
        <div className="hero-icon">
          <LogoMark large />
          <span className="verified-badge">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </div>
        <h1>{siteName}</h1>
      </section>

      <form
        className={resultUrl ? "oauth-panel create-panel create-panel--result" : "oauth-panel create-panel"}
        onSubmit={handleCreate}
      >
        {resultUrl ? (
          <div className="created-state">
            <div className="created-badge">已生成</div>
            <h2>{siteName}链接</h2>
            <div className="result-box result-box--large">
              <code>{resultUrl}</code>
              <button className="icon-button" onClick={copyResult} type="button">
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <button className="btn-pill btn-pill-primary" onClick={resetCreateForm} type="button">
              创建新{siteName}
            </button>
          </div>
        ) : (
          <>
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
                placeholder={dailyQuote || "正在生成一言..."}
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
          <span className="password-field">
            <input
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className={showPassword ? "" : "masked-input"}
              name="burn-key"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="可留空；重要内容建议设置"
              spellCheck={false}
              type="text"
              value={password}
            />
            <button
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              className="password-eye"
              onClick={() => setShowPassword((value) => !value)}
              title={showPassword ? "隐藏密码" : "显示密码"}
              type="button"
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.7 4.4 10 7a15.8 15.8 0 0 1-2.2 3.2" />
                  <path d="M6.6 6.6C4.4 8 2.8 10.1 2 12c1.3 2.6 5 7 10 7a9.7 9.7 0 0 0 4.3-1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </span>
        </label>

        <div className="completion-meter" aria-label="填写进度">
          <span className={completion.content ? "active" : ""}>
            <i />
          </span>
          <span className={completion.password ? "active" : ""}>
            <i />
          </span>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        <div className="action-stack">
          <button className="btn-pill btn-pill-primary" disabled={isLoading} type="submit">
            {isLoading ? "生成中..." : `生成${siteName}链接`}
          </button>
          <button
            className="btn-pill btn-pill-secondary"
            disabled={isLoading}
            onClick={() => {
              setSecret("");
              setPassword("");
              setResultUrl("");
              setStatus("");
              setCopied(false);
              setShowAutoCopyToast(false);
            }}
            type="button"
          >
            清空
          </button>
        </div>
          </>
        )}
      </form>
    </Shell>
  );
}
