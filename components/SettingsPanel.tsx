"use client";

import { useEffect, useRef, useState } from "react";

type QuoteSource = "default" | "hitokoto";
type BackgroundMode = "default" | "api";

type SiteSettings = {
  backgroundApiUrl: string;
  backgroundMode: BackgroundMode;
  backgroundOpacity: number;
  fontScale: number;
  pageScale: number;
  quoteSource: QuoteSource;
};

type DockerUpdateResponse =
  | {
      ok: true;
      currentVersion: string;
      deployment: DeploymentKind;
      enabled: true;
      latestVersion: string | null;
      started?: boolean;
      updateAvailable: boolean;
    }
  | { ok: false; deployment?: DeploymentKind; enabled?: boolean; error: string };

type DeploymentKind = "docker" | "vercel" | "other";

type DockerUpdateMetaResponse =
  | {
      ok: true;
      currentVersion: string;
      deployment: DeploymentKind;
      enabled: boolean;
    }
  | { ok: false; error: string };

const settingsStorageKey = "yuehou-settings";
const settingsChangeEvent = "yuehou-settings-change";
const dockerUpdateTokenStorageKey = "yuehou-docker-update-token";

const defaultSettings: SiteSettings = {
  backgroundApiUrl: "",
  backgroundMode: "default",
  backgroundOpacity: 28,
  fontScale: 100,
  pageScale: 100,
  quoteSource: "default",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readSettings(): SiteSettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const saved = JSON.parse(localStorage.getItem(settingsStorageKey) || "{}") as Partial<SiteSettings>;

    return {
      backgroundApiUrl: typeof saved.backgroundApiUrl === "string" ? saved.backgroundApiUrl : "",
      backgroundMode: saved.backgroundMode === "api" ? "api" : "default",
      backgroundOpacity: clamp(Number(saved.backgroundOpacity ?? defaultSettings.backgroundOpacity), 1, 100),
      fontScale: clamp(Number(saved.fontScale ?? defaultSettings.fontScale), 85, 125),
      pageScale: clamp(Number(saved.pageScale ?? defaultSettings.pageScale), 85, 115),
      quoteSource: saved.quoteSource === "hitokoto" ? "hitokoto" : "default",
    };
  } catch {
    return defaultSettings;
  }
}

function applySettings(settings: SiteSettings) {
  const root = document.documentElement;

  root.dataset.background = settings.backgroundMode;
  root.style.setProperty("--font-scale", String(settings.fontScale / 100));
  root.style.setProperty("--page-scale", String(settings.pageScale / 100));
  root.style.setProperty("--bg-mask-opacity", String(settings.backgroundOpacity / 100));

  if (settings.backgroundMode === "default") {
    root.style.removeProperty("--api-bg-image");
  }
}

function saveSettings(settings: SiteSettings) {
  localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  applySettings(settings);
  window.dispatchEvent(new CustomEvent(settingsChangeEvent, { detail: settings }));
}

async function applyApiBackground() {
  try {
    const settings = readSettings();
    const query = settings.backgroundApiUrl ? `&url=${encodeURIComponent(settings.backgroundApiUrl)}` : "";
    const response = await fetch(`/api/background?t=${Date.now()}${query}`, { cache: "no-store" });
    const data = (await response.json()) as { ok?: boolean; url?: string };

    if (data.ok && data.url) {
      document.documentElement.style.setProperty("--api-bg-image", `url("${data.url}")`);
    }
  } catch {
    document.documentElement.style.removeProperty("--api-bg-image");
  }
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [open, setOpen] = useState(false);
  const [dockerToken, setDockerToken] = useState("");
  const [dockerStatus, setDockerStatus] = useState("");
  const [dockerVersion, setDockerVersion] = useState("");
  const [dockerDeployment, setDockerDeployment] = useState<DeploymentKind>("other");
  const [dockerUpdateEnabled, setDockerUpdateEnabled] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initial = readSettings();

    setSettings(initial);
    applySettings(initial);

    if (initial.backgroundMode === "api") {
      void applyApiBackground();
    }

    setDockerToken(localStorage.getItem(dockerUpdateTokenStorageKey) || "");
    void loadDockerUpdateMeta();
  }, []);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeOnOutsideClick);

    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function updateSettings(next: SiteSettings) {
    setSettings(next);
    saveSettings(next);

    if (next.backgroundMode === "api") {
      void applyApiBackground();
    }
  }

  function updateBackgroundOpacity(value: string) {
    updateSettings({ ...settings, backgroundOpacity: Number(value) });
  }

  function updateFontScale(value: string) {
    updateSettings({ ...settings, fontScale: Number(value) });
  }

  function updatePageScale(value: string) {
    updateSettings({ ...settings, pageScale: Number(value) });
  }

  async function loadDockerUpdateMeta() {
    try {
      const response = await fetch(`/api/docker-update?t=${Date.now()}`, { cache: "no-store" });
      const data = (await response.json()) as DockerUpdateMetaResponse;

      if (!response.ok || !data.ok) {
        setDockerStatus(data.ok === false ? data.error : "Docker 更新状态读取失败。");
        return;
      }

      setDockerDeployment(data.deployment);
      setDockerUpdateEnabled(data.enabled);
      setDockerVersion(`当前 ${data.currentVersion}`);

      if (data.deployment === "vercel") {
        setDockerStatus("Vercel 部署会自动更新。");
      } else if (!data.enabled) {
        setDockerStatus("Docker 更新未启用。");
      }
    } catch {
      setDockerStatus("Docker 更新状态读取失败。");
    }
  }

  async function requestDockerUpdate(action: "check" | "update") {
    if (dockerDeployment === "vercel") {
      setDockerStatus("Vercel 部署会自动更新。");
      return null;
    }

    if (!dockerUpdateEnabled) {
      setDockerStatus("Docker 更新未启用。");
      return null;
    }

    const token = dockerToken.trim();

    if (!token) {
      setDockerStatus("请输入更新密钥。");
      return null;
    }

    localStorage.setItem(dockerUpdateTokenStorageKey, token);

    const response = await fetch("/api/docker-update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, force: forceUpdate }),
    });
    const data = (await response.json()) as DockerUpdateResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.ok === false ? data.error : "Docker 更新请求失败。");
    }

    setDockerDeployment(data.deployment);
    setDockerUpdateEnabled(data.enabled);

    setDockerVersion(
      data.latestVersion
        ? `当前 ${data.currentVersion} / 最新 ${data.latestVersion}`
        : `当前 ${data.currentVersion}`,
    );

    return data;
  }

  async function checkDockerUpdate() {
    setIsCheckingUpdate(true);
    setDockerStatus("");

    try {
      const data = await requestDockerUpdate("check");

      if (!data) return;

      setDockerStatus(data.updateAvailable ? "发现新版本。" : "已经是最新版本。");
    } catch (error) {
      setDockerStatus(error instanceof Error ? error.message : "检测失败。");
    } finally {
      setIsCheckingUpdate(false);
    }
  }

  function pollDockerUpdate(expectedVersion: string | null) {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;

      requestDockerUpdate("check")
        .then((data) => {
          if (!data) return;
          if ((expectedVersion && data.currentVersion === expectedVersion) || (!expectedVersion && attempts >= 6)) {
            window.clearInterval(timer);
            window.location.reload();
          }
        })
        .catch(() => {
          if (attempts >= 18) {
            window.clearInterval(timer);
            window.location.reload();
          }
        });

      if (attempts >= 24) {
        window.clearInterval(timer);
        window.location.reload();
      }
    }, 5000);
  }

  async function runDockerUpdate() {
    setIsUpdating(true);
    setDockerStatus("");

    try {
      const data = await requestDockerUpdate("update");

      if (!data) return;

      if (data.started === false) {
        setDockerStatus("已经是最新版本。");
        setIsUpdating(false);
        return;
      }

      setDockerStatus("更新已开始，完成后会刷新。");
      pollDockerUpdate(forceUpdate ? null : data.latestVersion);
    } catch (error) {
      setDockerStatus(error instanceof Error ? error.message : "更新失败。");
      setIsUpdating(false);
    }
  }

  const canUseDockerUpdater = dockerDeployment === "docker" && dockerUpdateEnabled && !isUpdating;
  const dockerControlsDisabled = !canUseDockerUpdater;

  return (
    <div className="settings-wrap" ref={wrapRef}>
      <button
        aria-expanded={open}
        aria-label="打开设置"
        className="theme-toggle settings-button"
        onClick={() => setOpen((value) => !value)}
        title="设置"
        type="button"
      >
        <span className="theme-toggle__halo" />
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.6v.2a2 2 0 0 1-4 0V21a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.2a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.4-2l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.2a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1h.2a2 2 0 0 1 0 4h-.2a1.8 1.8 0 0 0-1.6 1Z" />
        </svg>
      </button>

        <section className={open ? "settings-popover settings-popover--open" : "settings-popover"} aria-label="设置">
          <div className="settings-row">
            <span>一言来源</span>
            <div className="segmented-control">
              <button
                className={settings.quoteSource === "default" ? "active" : ""}
                onClick={() => updateSettings({ ...settings, quoteSource: "default" })}
                type="button"
              >
                默认
              </button>
              <button
                className={settings.quoteSource === "hitokoto" ? "active" : ""}
                onClick={() => updateSettings({ ...settings, quoteSource: "hitokoto" })}
                type="button"
              >
                一言
              </button>
            </div>
          </div>

          <div className="settings-row">
            <span>背景</span>
            <div className="segmented-control">
              <button
                className={settings.backgroundMode === "default" ? "active" : ""}
                onClick={() => updateSettings({ ...settings, backgroundMode: "default" })}
                type="button"
              >
                默认
              </button>
              <button
                className={settings.backgroundMode === "api" ? "active" : ""}
                onClick={() => updateSettings({ ...settings, backgroundMode: "api" })}
                type="button"
              >
                图片
              </button>
            </div>
          </div>

          {settings.backgroundMode === "api" ? (
            <label className="settings-input">
              <span>图片 API</span>
              <input
                onChange={(event) => updateSettings({ ...settings, backgroundApiUrl: event.target.value })}
                onInput={(event) =>
                  updateSettings({ ...settings, backgroundApiUrl: event.currentTarget.value })
                }
                placeholder="留空使用默认图片 API"
                type="url"
                value={settings.backgroundApiUrl}
              />
            </label>
          ) : null}

          <label className="settings-slider">
            <span>黑色蒙版 {settings.backgroundOpacity}%</span>
            <input
              max="100"
              min="1"
              onChange={(event) => updateBackgroundOpacity(event.target.value)}
              onInput={(event) => updateBackgroundOpacity(event.currentTarget.value)}
              type="range"
              value={settings.backgroundOpacity}
            />
          </label>

          <label className="settings-slider">
            <span>字体大小 {settings.fontScale}%</span>
            <input
              max="125"
              min="85"
              onChange={(event) => updateFontScale(event.target.value)}
              onInput={(event) => updateFontScale(event.currentTarget.value)}
              step="5"
              type="range"
              value={settings.fontScale}
            />
          </label>

          <label className="settings-slider">
            <span>页面缩放 {settings.pageScale}%</span>
            <input
              max="115"
              min="85"
              onChange={(event) => updatePageScale(event.target.value)}
              onInput={(event) => updatePageScale(event.currentTarget.value)}
              step="5"
              type="range"
              value={settings.pageScale}
            />
          </label>

          <div className="settings-row docker-update-panel">
            <span>Docker 更新</span>
            <label className="settings-input">
              <input
                autoComplete="off"
                disabled={dockerControlsDisabled}
                onChange={(event) => setDockerToken(event.target.value)}
                placeholder="更新密钥"
                type="password"
                value={dockerToken}
              />
            </label>
            <label className="settings-check">
              <input
                checked={forceUpdate}
                disabled={dockerControlsDisabled}
                onChange={(event) => setForceUpdate(event.target.checked)}
                type="checkbox"
              />
              <span>强制更新</span>
            </label>
            <div className="docker-update-actions">
              <button
                disabled={dockerControlsDisabled || isCheckingUpdate || isUpdating}
                onClick={checkDockerUpdate}
                type="button"
              >
                {isCheckingUpdate ? "检测中" : "检测"}
              </button>
              <button disabled={dockerControlsDisabled || isUpdating} onClick={runDockerUpdate} type="button">
                {isUpdating ? "更新中" : "一键更新"}
              </button>
            </div>
            {dockerVersion ? <small>{dockerVersion}</small> : null}
            {dockerStatus ? <small>{dockerStatus}</small> : null}
          </div>
        </section>
    </div>
  );
}

export { defaultSettings, readSettings, settingsChangeEvent, settingsStorageKey };
