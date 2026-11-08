const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = require("node:fs").readFileSync(filename, "utf8");
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
};

const media = require("../lib/media-store.ts");
const { StorageFullError } = require("../lib/storage-errors.ts");
const { estimateSecretRequestBytes } = require("../lib/upload-limits.ts");

test("storage reservations, concurrent uploads, cleanup and media integrity", async () => {
  const directory = await fs.mkdtemp(path.join(process.env.TEST_TEMP_ROOT || os.tmpdir(), "yuehou-storage-"));
  process.env.MEDIA_STORAGE_DIR = directory;
  process.env.MEDIA_STORAGE_MAX_BYTES = "10000";
  process.env.MEDIA_STORAGE_RESERVE_BYTES = "0";
  const upload = (size = 4000) => media.createMediaUpload({ name: "test.mp4", type: "video/mp4", size, expiresIn: null });
  try {
    const initial = await media.getMediaStorage();
    assert.equal(initial.availableBytes, 10000);
    const results = await Promise.allSettled([upload(), upload()]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1, "concurrent reservations must not oversubscribe storage");
    assert(results.find((result) => result.status === "rejected").reason instanceof StorageFullError);
    const created = results.find((result) => result.status === "fulfilled").value;
    const reserved = await media.getMediaStorage();
    assert(reserved.usedBytes >= 4000);
    await assert.rejects(media.deleteMediaUpload(created.id, "wrong-token"), /凭证/);
    await assert.rejects(media.appendMediaChunk(created.id, created.token, 1, new ArrayBuffer(4)), /进度/);
    await assert.rejects(media.completeMediaUpload(created.id, created.token), /尚未/);
    const data = new Uint8Array(4000).fill(7);
    const chunks = await Promise.allSettled([
      media.appendMediaChunk(created.id, created.token, 0, data.buffer),
      media.appendMediaChunk(created.id, created.token, 0, data.buffer),
    ]);
    assert.equal(chunks.filter((result) => result.status === "fulfilled").length, 1, "duplicate concurrent chunks must not corrupt file");
    await media.completeMediaUpload(created.id, created.token);
    await media.completeMediaUpload(created.id, created.token);
    assert.deepEqual(await fs.readFile(path.join(directory, `${created.id}.bin`)), Buffer.from(data));
    await media.openMedia(created.id, created.token);
    await media.deleteMediaUpload(created.id, created.token);
    assert.equal((await media.getMediaStorage()).availableBytes, 10000, "removal must release all storage");
    await assert.rejects(upload(1.5), /30 GB/);
    await assert.rejects(upload(10001), StorageFullError);
    process.env.MEDIA_STORAGE_RESERVE_BYTES = String(Number.MAX_SAFE_INTEGER);
    assert.equal((await media.getMediaStorage()).availableBytes, 0, "disk reserve must prevent uploads");
    process.env.MEDIA_STORAGE_RESERVE_BYTES = "0";
    const stale = await upload(100);
    const manifestPath = path.join(directory, `${stale.id}.json`);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest.createdAt = Date.now() - 25 * 60 * 60 * 1000;
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    assert.equal((await media.getMediaStorage()).availableBytes, 10000, "abandoned uploads must expire and release reservations");
    const expired = await upload(100);
    const expiredManifestPath = path.join(directory, `${expired.id}.json`);
    const expiredManifest = JSON.parse(await fs.readFile(expiredManifestPath, "utf8"));
    expiredManifest.expiresAt = Date.now() - 1;
    await fs.writeFile(expiredManifestPath, JSON.stringify(expiredManifest));
    await assert.rejects(media.completeMediaUpload(expired.id, expired.token), /过期/);
    assert.equal((await media.getMediaStorage()).availableBytes, 10000);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("photo capacity includes UTF-8, JSON escaping and password encryption overhead", async () => {
  const { encryptWithPassword } = require("../lib/client-crypto.ts");
  for (const content of ["照片\n\"\\".repeat(500), "a".repeat(10000)]) {
    const plain = JSON.stringify({ mode: "plain", secret: content, expiresIn: 300 });
    const encrypted = JSON.stringify({ mode: "password", expiresIn: 300, ...await encryptWithPassword(content, "password") });
    assert(estimateSecretRequestBytes(content, false) >= Buffer.byteLength(plain));
    assert(estimateSecretRequestBytes(content, true) >= Buffer.byteLength(encrypted));
  }
});
