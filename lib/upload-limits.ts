export type UploadLimits = {
  maxSecretRequestBytes: number;
  maxVideoBytes: number;
};

export type MediaStorage = {
  availableBytes: number;
  usedBytes: number;
  limitBytes: number | null;
};

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes === 0) return "0 KB";
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

// Include JSON escaping and the larger password-encrypted representation.
export function estimateSecretRequestBytes(content: string, passwordProtected: boolean) {
  const bytes = new TextEncoder().encode(content).byteLength;
  return passwordProtected
    ? Math.ceil((bytes + 16) * 4 / 3) + 1024
    : new TextEncoder().encode(JSON.stringify({ secret: content })).byteLength + 512;
}
