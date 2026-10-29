export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

export function text(body: string, status: number, contentType: string): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType },
  });
}

const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function withHeaders(response: Response, usedSession: boolean, html = false): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY)) {
    headers.set(key, value);
  }
  if (usedSession) {
    headers.set("Cache-Control", "no-store");
  }
  if (html) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https://forevermemoriestravel.com; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
  }
  return new Response(response.body, { status: response.status, headers });
}

export async function readJson(request: Request, limit = 100_000): Promise<unknown> {
  const claimed = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(claimed) && claimed > limit) {
    throw new HttpError(413, "That request is too large.");
  }
  const raw = await request.text();
  if (raw.length > limit) {
    throw new HttpError(413, "That request is too large.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "That request was not valid JSON.");
  }
}

export function clientIp(request: Request): string {
  const value = request.headers.get("CF-Connecting-IP") || "unknown";
  return value.slice(0, 80);
}

export function timingSafeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const length = [...trimmed].length;
  if (length < min || length > max) {
    return null;
  }
  return trimmed;
}

export const LOGIN_FAIL = "That username and password did not match.";
export const INQUIRY_DOWN = "The inquiry store is not reachable.";
export const STATS_DOWN = "Statistics are not reachable.";
export const GITHUB_DOWN = "GitHub publishing is not configured.";
