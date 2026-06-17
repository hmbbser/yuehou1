"use client";

import { EncryptedPayload } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const PROOF_LABEL = "yuehou-password-proof-v1";
const proofLabelBytes = textEncoder.encode(PROOF_LABEL);

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function asArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function sha256Base64Url(input: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", asArrayBuffer(input));
  return toBase64Url(new Uint8Array(digest));
}

async function deriveMaterial(password: string, salt: Uint8Array, iterations: number) {
  const passwordKey = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: asArrayBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    512,
  );
  const material = new Uint8Array(bits);
  const aesBytes = material.slice(0, 32);
  const proofBytes = material.slice(32);
  const aesKey = await crypto.subtle.importKey("raw", asArrayBuffer(aesBytes), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  const proofInput = new Uint8Array(proofLabelBytes.length + proofBytes.length);

  proofInput.set(proofLabelBytes, 0);
  proofInput.set(proofBytes, proofLabelBytes.length);

  return {
    aesKey,
    proofHash: await sha256Base64Url(proofInput),
  };
}

export async function encryptWithPassword(secret: string, password: string): Promise<{
  encrypted: EncryptedPayload;
  proofHash: string;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 160000;
  const { aesKey, proofHash } = await deriveMaterial(password, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    aesKey,
    textEncoder.encode(secret),
  );

  return {
    encrypted: {
      ciphertext: toBase64Url(new Uint8Array(ciphertext)),
      iv: toBase64Url(iv),
      salt: toBase64Url(salt),
      iterations,
    },
    proofHash,
  };
}

export async function derivePasswordProof(password: string, saltValue: string, iterations: number) {
  const { proofHash } = await deriveMaterial(password, fromBase64Url(saltValue), iterations);

  return proofHash;
}

export async function decryptWithPassword(encrypted: EncryptedPayload, password: string) {
  const { aesKey } = await deriveMaterial(password, fromBase64Url(encrypted.salt), encrypted.iterations);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(fromBase64Url(encrypted.iv)),
    },
    aesKey,
    asArrayBuffer(fromBase64Url(encrypted.ciphertext)),
  );

  return textDecoder.decode(plaintext);
}
