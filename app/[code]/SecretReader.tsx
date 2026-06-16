"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { decryptWithPassword, derivePasswordProof } from "@/lib/client-crypto";
import { siteName } from "@/lib/site";
import { EncryptedPayload, PublicSecretMeta } from "@/lib/types";

type ConsumeResponse =
  | {
      ok: true;
      record: { mode: "plain"; secret: string } | { mode: "password"; encrypted: EncryptedPayload };
    }
  | { ok: false; error: string };

export function SecretReader({ meta }: { meta: PublicSecretMeta }) {
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [destroyed, setDestroyed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const secretTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = secretTextareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [secret]);

  async function consume(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setStatus("");
    setCopied(false);

    if (meta.mode === "password" && !password) {
      setStatus("请输入访问密码。");
      return;
    }

    setIsLoading(true);

    try {
      const proofHash =
        meta.mode === "password" ? await derivePasswordProof(password, meta.salt, meta.iterations) : undefined;
      const response = await fetch(`/api/secrets/${meta.code}/consume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofHash }),
      });
      const data = (await response.json()) as ConsumeResponse;

      if (!response.ok || !data.ok) {
        setStatus(data.ok === false ? data.error : "读取失败，请稍后再试。");
        return;
      }

      let text = "";

      try {
        text =
          data.record.mode === "plain" ? data.record.secret : await decryptWithPassword(data.record.encrypted, password);
      } catch {
        text = "内容已销毁，但本机解密失败。请确认密码是否完整，或浏览器是否支持 Web Crypto。";
      }

      setSecret(text);
      setDestroyed(true);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "读取失败，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  async function copySecret() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <form
      className={destroyed ? "oauth-panel reader-panel reader-panel--revealed" : "oauth-panel reader-panel"}
      onSubmit={consume}
    >
      {!destroyed ? (
        <div className="identity-card reader-intro">
          <div className="avatar">阅</div>
          <div>
            <strong>准备读取秘密</strong>
            <span>{meta.mode === "password" ? "需要密码，正确读取后销毁" : "点击读取后立即销毁"}</span>
          </div>
        </div>
      ) : null}

      {meta.mode === "password" && !destroyed ? (
        <label className="field">
          <span>访问密码</span>
          <span className="password-field">
            <input
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className={showPassword ? "" : "masked-input"}
              name="burn-read-key"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入创建者设置的密码"
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
      ) : null}

      {secret ? (
        <div className="secret-output">
          <label className="field">
            <span>秘密内容</span>
            <textarea
              autoComplete="off"
              className="secret-output-textarea"
              onChange={(event) => setSecret(event.target.value)}
              ref={secretTextareaRef}
              spellCheck={false}
              value={secret}
            />
          </label>
          <button className="icon-button" onClick={copySecret} type="button">
            {copied ? "已复制" : "复制内容"}
          </button>
        </div>
      ) : null}

      {status ? <p className="status-text">{status}</p> : null}

      {!destroyed ? (
        <div className="action-stack">
          <button className="btn-pill btn-pill-primary" disabled={isLoading} type="submit">
            {isLoading ? "读取中..." : "读取并销毁"}
          </button>
          <a className="btn-pill btn-pill-secondary" href="/">
            创建新{siteName}
          </a>
        </div>
      ) : (
        <div className="action-stack">
          <a className="btn-pill btn-pill-primary" href="/">
            创建新{siteName}
          </a>
        </div>
      )}
    </form>
  );
}
