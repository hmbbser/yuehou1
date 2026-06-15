"use client";

import { FormEvent, useState } from "react";
import { decryptWithPassword, derivePasswordProof } from "@/lib/client-crypto";
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
      setStatus("内容已读取并销毁。刷新或再次打开将无法恢复。");
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
    <form className="oauth-panel reader-panel" onSubmit={consume}>
      <div className="identity-card">
        <div className="avatar">阅</div>
        <div>
          <strong>{destroyed ? "秘密已焚毁" : "准备读取秘密"}</strong>
          <span>{meta.mode === "password" ? "需要密码，正确读取后销毁" : "点击读取后立即销毁"}</span>
        </div>
      </div>

      <div className="info-card">
        <div className="info-line">
          <span>短码</span>
          <strong>/{meta.code}</strong>
        </div>
        <div className="info-line">
          <span>保护方式</span>
          <strong>{meta.mode === "password" ? "密码保护" : "极速短链"}</strong>
        </div>
        <div className="info-line">
          <span>有效期</span>
          <strong>{meta.expiresAt ? new Date(meta.expiresAt).toLocaleString("zh-CN") : "无限期，直到读取"}</strong>
        </div>
      </div>

      {meta.mode === "password" && !destroyed ? (
        <label className="field">
          <span>访问密码</span>
          <input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="masked-input"
            name="burn-read-key"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入创建者设置的密码"
            spellCheck={false}
            type="text"
            value={password}
          />
        </label>
      ) : null}

      {secret ? (
        <div className="secret-output">
          <pre>{secret}</pre>
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
            创建新的秘密
          </a>
        </div>
      ) : (
        <div className="action-stack">
          <a className="btn-pill btn-pill-primary" href="/">
            创建新的秘密
          </a>
        </div>
      )}
    </form>
  );
}
