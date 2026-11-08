import { UploadLimits } from "./upload-limits";

export function getUploadLimits(): UploadLimits {
  const configured = Number(process.env.MAX_SECRET_REQUEST_BYTES);
  const platformLimit = process.env.VERCEL ? 4 * 1024 * 1024 : 16 * 1024 * 1024;
  return {
    maxSecretRequestBytes: Number.isSafeInteger(configured) && configured > 0 ? Math.min(configured, platformLimit) : platformLimit,
    maxVideoBytes: 30 * 1024 * 1024 * 1024,
  };
}
