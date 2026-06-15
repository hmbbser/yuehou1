export const CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const CODE_LENGTH = 4;
export const CODE_PATTERN = /^[0-9a-zA-Z]{4}$/;
export const DEFAULT_MISS_WINDOW_SECONDS = 60;
export const MISS_THRESHOLD = 18;
export const BLACKLIST_SECONDS = 60 * 60 * 24;

export type ExpiryPreset = "5m" | "1h" | "24h" | "7d" | "custom" | "never";

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  salt: string;
  iterations: number;
};

export type SecretRecord =
  | {
      version: 1;
      mode: "plain";
      secret: string;
      createdAt: number;
      expiresAt: number | null;
    }
  | {
      version: 1;
      mode: "password";
      encrypted: EncryptedPayload;
      proofHash: string;
      createdAt: number;
      expiresAt: number | null;
    };

export type PublicSecretMeta =
  | {
      exists: true;
      code: string;
      mode: "plain";
      createdAt: number;
      expiresAt: number | null;
    }
  | {
      exists: true;
      code: string;
      mode: "password";
      createdAt: number;
      expiresAt: number | null;
      salt: string;
      iterations: number;
    };
