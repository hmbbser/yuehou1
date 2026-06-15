import { createHash, randomInt, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { CODE_ALPHABET, CODE_LENGTH, CODE_PATTERN } from "./types";

export function isValidCode(code: string) {
  return CODE_PATTERN.test(code);
}

export function generateCode() {
  let code = "";

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }

  return code;
}

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getClientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();

  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    firstForwarded ??
    "unknown"
  );
}

export function getClientIpFromHeaders() {
  const headerList = headers();
  const forwarded = headerList.get("x-vercel-forwarded-for") ?? headerList.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();

  return headerList.get("cf-connecting-ip") ?? headerList.get("x-real-ip") ?? firstForwarded ?? "unknown";
}

export function hashIp(ip: string) {
  return sha256(`ip:${ip}`);
}
