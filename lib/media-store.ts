import { createHash, randomBytes } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readdir, readFile, rename, rm, stat, statfs, writeFile, appendFile } from "fs/promises";
import os from "os";
import path from "path";
import { StorageFullError } from "./storage-errors";
import { formatFileSize, MediaStorage } from "./upload-limits";

export const maxVideoBytes = 30 * 1024 * 1024 * 1024;
export const mediaChunkBytes = 3 * 1024 * 1024;

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
  if (process.env.MEDIA_STORAGE_DIR) {
    return process.env.MEDIA_STORAGE_DIR;
  }

  if (process.env.VERCEL || process.cwd().startsWith("/var/task")) {
    return path.join(os.tmpdir(), ".yuehou-media");
  }

  return path.join(process.cwd(), ".yuehou-media");
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
  const temporary = `${manifestPath(manifest.id)}.tmp`;
  await writeFile(temporary, JSON.stringify(manifest), "utf8");
  await rename(temporary, manifestPath(manifest.id));
}

async function removeMediaFiles(id: string) {
  await Promise.all([
    rm(manifestPath(id), { force: true }),
    rm(tempPath(id), { force: true }),
    rm(filePath(id), { force: true }),
    rm(`${manifestPath(id)}.tmp`, { force: true }),
  ]);
}

async function cleanupExpiredMedia() {
  await ensureMediaRoot();

  const names = await readdir(mediaRoot()).catch(() => []);
  const now = Date.now();

  await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const id = name.slice(0, -5);
        if (!/^[a-f0-9]{32}$/.test(id)) return;

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

// Serialize reservations and writes across processes sharing this directory.
async function withStorageLock<T>(action: () => Promise<T>): Promise<T> {
  await ensureMediaRoot();
  const lockPath = path.join(mediaRoot(), ".upload-lock");
  const started = Date.now();
  while (true) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const lock = await stat(lockPath).catch(() => null);
      if (lock && Date.now() - lock.mtimeMs > 5 * 60 * 1000) {
        await rm(lockPath, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - started > 30_000) throw new Error("存储正在忙，请稍后重试。");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  try {
    return await action();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

async function readStorage(): Promise<MediaStorage> {
  const names = await readdir(mediaRoot());
  let usedBytes = 0;
  let reservedBytes = 0;
  for (const name of names) {
    if (!/^[a-f0-9]{32}\.(json|part|bin)$/.test(name)) continue;
    const file = await stat(path.join(mediaRoot(), name)).catch(() => null);
    usedBytes += file?.size ?? 0;
    if (name.endsWith(".json")) {
      const manifest = await readManifest(name.slice(0, -5));
      if (manifest.status === "pending") reservedBytes += Math.max(0, manifest.size - manifest.uploaded);
    }
  }
  const filesystem = await statfs(mediaRoot(), { bigint: true });
  const freeBytes = Number(filesystem.bavail * filesystem.bsize);
  const configuredLimit = Number(process.env.MEDIA_STORAGE_MAX_BYTES);
  const limitBytes = Number.isSafeInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : null;
  const reserve = diskReserveBytes();
  const availableBytes = Math.max(0, Math.min(freeBytes - reservedBytes - reserve, limitBytes === null ? Infinity : limitBytes - usedBytes - reservedBytes));
  return { availableBytes, usedBytes: usedBytes + reservedBytes, limitBytes };
}

function diskReserveBytes() {
  const configured = Number(process.env.MEDIA_STORAGE_RESERVE_BYTES);
  return Number.isSafeInteger(configured) && configured >= 0 ? configured : 64 * 1024 * 1024;
}

export async function getMediaStorage() {
  return withStorageLock(async () => {
    await cleanupExpiredMedia();
    return readStorage();
  });
}

export async function deleteMediaUpload(id: string, token: string) {
  return withStorageLock(async () => {
    const manifest = await readManifest(id);
    if (manifest.tokenHash !== hashToken(token)) throw new Error("上传凭证无效。");
    await removeMediaFiles(id);
  });
}

export async function createMediaUpload(input: {
  expiresIn: number | null;
  name: string;
  size: number;
  type: string;
}) {
  return withStorageLock(async () => {
    await cleanupExpiredMedia();

    if (!input.type.startsWith("video/")) {
      throw new Error("请选择视频文件。");
    }

    if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > maxVideoBytes) {
      throw new Error("视频最大不能超过 30 GB。");
    }

    const storage = await readStorage();
    if (input.size + 4096 > storage.availableBytes) {
      throw new StorageFullError(`存储空间不足，当前可用 ${formatFileSize(storage.availableBytes)}，此视频需要 ${formatFileSize(input.size)}。请移除未使用的视频或等待内容过期后重试。`);
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

    try {
      await writeManifest(manifest);
      await writeFile(tempPath(id), "");
    } catch (error) {
      await removeMediaFiles(id);
      throw error;
    }

    return { chunkSize: mediaChunkBytes, id, manifest, token };
  });
}

export async function appendMediaChunk(id: string, token: string, offset: number, bytes: ArrayBuffer) {
  return withStorageLock(async () => {
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

    const filesystem = await statfs(mediaRoot(), { bigint: true });
    if (Number(filesystem.bavail * filesystem.bsize) < bytes.byteLength + diskReserveBytes() + 64 * 1024) {
      throw new StorageFullError("存储空间不足，上传已停止。请释放空间后重试。");
    }

    await appendFile(tempPath(id), Buffer.from(bytes));

    manifest.uploaded += bytes.byteLength;
    await writeManifest(manifest);

    return manifest;
  });
}

export async function completeMediaUpload(id: string, token: string) {
  return withStorageLock(async () => {
    const manifest = await readManifest(id);

    if (manifest.tokenHash !== hashToken(token)) {
      throw new Error("上传凭证无效。");
    }

    if (manifest.status === "ready") return manifest;
    if (manifest.expiresAt && manifest.expiresAt <= Date.now()) {
      await removeMediaFiles(id);
      throw new Error("上传已过期。");
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
  });
}

export async function openMedia(id: string, token: string) {
  return withStorageLock(async () => {
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
  });
}
