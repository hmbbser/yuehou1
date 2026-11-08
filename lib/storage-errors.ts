export class StorageFullError extends Error {}

export function isStorageFullError(error: unknown) {
  if (error instanceof StorageFullError) return true;
  const message = error instanceof Error ? error.message : "";
  const code = (error as { code?: string } | null)?.code;
  return code === "ENOSPC" || code === "EDQUOT" || /OOM|out of memory|storage.*limit|quota.*exceed|max.*(size|storage)|request.*too large/i.test(message);
}
