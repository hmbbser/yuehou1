import { createHash, randomBytes } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile, appendFile } from "fs/promises";
import path from "path";

export const maxVideoBytes = 30 * 1024 * 1024 * 1024;
export const mediaChunkBytes = 8 * 1024 * 1024;

type MediaStatus = "pending" | "ready";

export type MediaManifest = {
  createdAt: number;
  expiresAt: number | null;
  firstReadAt?: number;
  id: string;
  name: string;
  size: number;
  status: MediaStatus;
  tokenHash: string;
  type: string;
  uploaded: number;
};

export type MediaRange = {
  end: number;
  start: number;
};

const revealWindowMs = 6 * 60 * 60 * 1000;

function mediaRoot() {
  return process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), ".yuehou-media");
}

function assertMediaId(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) {
    throw new Error("媒体不存在。");
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cleanName(name: string) {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();

  return cleaned.slice(0, 180) || "video";
}

function manifestPath(id: string) {
  return path.join(mediaRoot(), `${id}.json`);
}

function tempPath(id: string) {
  return path.join(mediaRoot(), `${id}.part`);
}

function filePath(id: string) {
  return path.join(mediaRoot(), `${id}.bin`);
}

async function ensureMediaRoot() {
  await mkdir(mediaRoot(), { recursive: true });
}

async function readManifest(id: string) {
  assertMediaId(id);

  const raw = await readFile(manifestPath(id), "utf8");

  return JSON.parse(raw) as MediaManifest;
}

async function writeManifest(manifest: MediaManifest) {
  await ensureMediaRoot();
  await writeFile(manifestPath(manifest.id), JSON.stringify(manifest), "utf8");
}

async function removeMediaFiles(id: string) {
  await Promise.all([
    rm(manifestPath(id), { force: true }),
    rm(tempPath(id), { force: true }),
    rm(filePath(id), { force: true }),
  ]);
}

export async function cleanupExpiredMedia() {
  await ensureMediaRoot();

  const names = await readdir(mediaRoot()).catch(() => []);
  const now = Date.now();

  await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const id = name.slice(0, -5);

        try {
          const manifest = await readManifest(id);
          const stalePending = manifest.status === "pending" && now - manifest.createdAt > 24 * 60 * 60 * 1000;
          const expired = Boolean(manifest.expiresAt && manifest.expiresAt <= now);

          if (stalePending || expired) {
            await removeMediaFiles(id);
          }
        } catch {
          await removeMediaFiles(id);
        }
      }),
  );
}

export async function createMediaUpload(input: {
  expiresIn: number | null;
  name: string;
  size: number;
  type: string;
}) {
  await cleanupExpiredMedia();

  if (!input.type.startsWith("video/")) {
    throw new Error("请选择视频文件。");
  }

  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > maxVideoBytes) {
    throw new Error("视频最大不能超过 30 GB。");
  }

  const id = randomBytes(16).toString("hex");
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const manifest: MediaManifest = {
    createdAt: now,
    expiresAt: input.expiresIn ? now + input.expiresIn * 1000 : null,
    id,
    name: cleanName(input.name),
    size: Math.round(input.size),
    status: "pending",
    tokenHash: hashToken(token),
    type: input.type,
    uploaded: 0,
  };

  await writeManifest(manifest);
  await writeFile(tempPath(id), "");

  return { chunkSize: mediaChunkBytes, id, manifest, token };
}

export async function appendMediaChunk(id: string, token: string, offset: number, bytes: ArrayBuffer) {
  const manifest = await readManifest(id);

  if (manifest.tokenHash !== hashToken(token)) {
    throw new Error("上传凭证无效。");
  }

  if (manifest.status !== "pending") {
    throw new Error("上传已完成。");
  }

  if (manifest.expiresAt && manifest.expiresAt <= Date.now()) {
    await removeMediaFiles(id);
    throw new Error("上传已过期。");
  }

  if (offset !== manifest.uploaded) {
    throw new Error("上传进度不一致，请重新选择视频。");
  }

  if (bytes.byteLength === 0 || bytes.byteLength > mediaChunkBytes) {
    throw new Error("视频分片大小不合法。");
  }

  if (manifest.uploaded + bytes.byteLength > manifest.size) {
    throw new Error("视频大小超过限制。");
  }

  await appendFile(tempPath(id), Buffer.from(bytes));

  manifest.uploaded += bytes.byteLength;
  await writeManifest(manifest);

  return manifest;
}

export async function completeMediaUpload(id: string, token: string) {
  const manifest = await readManifest(id);

  if (manifest.tokenHash !== hashToken(token)) {
    throw new Error("上传凭证无效。");
  }

  if (manifest.uploaded !== manifest.size) {
    throw new Error("视频尚未上传完成。");
  }

  const current = await stat(tempPath(id));

  if (current.size !== manifest.size) {
    throw new Error("视频文件校验失败。");
  }

  await rename(tempPath(id), filePath(id));
  manifest.status = "ready";
  await writeManifest(manifest);

  return manifest;
}

export async function openMedia(id: string, token: string) {
  const manifest = await readManifest(id);
  const now = Date.now();

  if (manifest.tokenHash !== hashToken(token) || manifest.status !== "ready") {
    throw new Error("媒体不存在。");
  }

  if (manifest.expiresAt && manifest.expiresAt <= now) {
    await removeMediaFiles(id);
    throw new Error("媒体已过期。");
  }

  if (!manifest.firstReadAt) {
    manifest.firstReadAt = now;
    manifest.expiresAt = manifest.expiresAt ?? now + revealWindowMs;
    await writeManifest(manifest);
  }

  return {
    createStream: (range?: MediaRange) => createReadStream(filePath(id), range),
    manifest,
  };
}
