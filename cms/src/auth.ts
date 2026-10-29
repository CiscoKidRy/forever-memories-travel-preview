import { auditStatement, recordAudit } from "./audit";
import {
  HttpError,
  LOGIN_FAIL,
  asString,
  bytesToHex,
  clientIp,
  hexToBytes,
  isRecord,
  json,
  readJson,
  timingSafeEqual,
} from "./http";
import type { Env, StaffUser } from "./types";

export const HASH_ITERATIONS = 100_000;
const FIRST_USERNAME = "ryanhocking@gmail.com";
const SESSION_SECONDS = 43_200;

interface StaffRow {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  hash_params: string;
  disabled: number;
  must_change_password: number;
  deleted_at: string | null;
}

export async function hashPassword(
  password: string,
  pepper: string,
  iterations: number,
  salt?: Uint8Array,
): Promise<{ hash: string; salt: string; params: string }> {
  const saltBytes = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const material = new TextEncoder().encode(`${password}\0${pepper}`);
  const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
    key,
    256,
  );
  return {
    hash: bytesToHex(bits),
    salt: bytesToHex(saltBytes),
    params: `pbkdf2-sha256:${iterations}`,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(digest);
}

function iterationsFrom(params: string): number | null {
  const match = /^pbkdf2-sha256:(\d+)$/.exec(params);
  if (!match) {
    return null;
  }
  const iterations = Number(match[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100_000) {
    return null;
  }
  return iterations;
}

function passwordOk(password: string): boolean {
  const length = [...password].length;
  return length >= 12 && length <= 128;
}

async function pruneAttempts(env: Env): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM login_attempts WHERE created_at < datetime('now', '-2 days')",
  ).run();
}

async function lockedOut(env: Env, username: string, ip: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT count(*) FROM login_attempts
         WHERE username = ?1 AND succeeded = 0
           AND created_at > datetime('now', '-15 minutes')) AS user_fails,
       (SELECT count(*) FROM login_attempts
         WHERE ip = ?2 AND succeeded = 0
           AND created_at > datetime('now', '-15 minutes')) AS ip_fails`,
  ).bind(username, ip).first<{ user_fails: number; ip_fails: number }>();
  return (row?.user_fails ?? 0) >= 5 || (row?.ip_fails ?? 0) >= 20;
}

async function recordAttempt(env: Env, username: string, ip: string, succeeded: boolean): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO login_attempts (username, ip, succeeded, created_at) VALUES (?1, ?2, ?3, datetime('now'))",
  ).bind(username, ip, succeeded ? 1 : 0).run();
}

function cookie(token: string, maxAge: number): string {
  return `fmt_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function bearer(request: Request): string {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function sessionUser(request: Request, env: Env): Promise<StaffUser | null> {
  const header = request.headers.get("Cookie") || "";
  const match = /(?:^|;\s*)fmt_session=([0-9a-f]+)(?:;|$)/i.exec(header);
  if (!match) {
    return null;
  }
  const tokenHash = await sha256Hex(match[1]);
  const row = await env.DB.prepare(
    `SELECT s.expires_at, u.id, u.username, u.disabled, u.must_change_password, u.deleted_at
     FROM sessions s JOIN staff u ON u.id = s.staff_id
     WHERE s.token_hash = ?1`,
  ).bind(tokenHash).first<{
    expires_at: string;
    id: string;
    username: string;
    disabled: number;
    must_change_password: number;
    deleted_at: string | null;
  }>();
  if (!row || row.disabled || row.deleted_at) {
    return null;
  }
  if (Date.parse(row.expires_at) <= Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    mustChangePassword: row.must_change_password === 1,
  };
}

export async function requireUser(request: Request, env: Env): Promise<StaffUser> {
  const user = await sessionUser(request, env);
  if (!user) {
    throw new HttpError(401, "Sign in required.");
  }
  return user;
}

export async function handleSetup(request: Request, env: Env): Promise<Response> {
  if (!env.SETUP_TOKEN || !env.PASSWORD_PEPPER) {
    return json({ error: "Sign-in is not configured." }, 503);
  }
  if (!timingSafeEqual(bearer(request), env.SETUP_TOKEN)) {
    return json({ error: LOGIN_FAIL }, 401);
  }
  const body = await readJson(request);
  if (!isRecord(body)) {
    throw new HttpError(400, "That request was not valid.");
  }
  const existing = await env.DB.prepare("SELECT id FROM staff LIMIT 1").first();
  const marker = await env.DB.prepare(
    "SELECT id FROM documents WHERE kind = 'agency' AND slug = 'setup'",
  ).first();
  if (existing || marker) {
    return json({ error: "not_found" }, 404);
  }
  const username = body.username;
  const password = body.password;
  if (username !== FIRST_USERNAME || typeof password !== "string" || !passwordOk(password)) {
    throw new HttpError(400, "The first username is ryanhocking@gmail.com and the password must be 12 to 128 characters.");
  }
  const hashed = await hashPassword(password, env.PASSWORD_PEPPER, HASH_ITERATIONS);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO staff
         (id, username, password_hash, password_salt, hash_params, disabled, must_change_password, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6)`,
      ).bind(id, FIRST_USERNAME, hashed.hash, hashed.salt, hashed.params, now),
      env.DB.prepare(
        `INSERT INTO documents (id, kind, slug, status, body_json, updated_at, updated_by)
         VALUES ('doc-setup', 'agency', 'setup', 'published', '{}', ?1, ?2)`,
      ).bind(now, FIRST_USERNAME),
    ]);
  } catch {
    return json({ error: "not_found" }, 404);
  }
  return json({ username: FIRST_USERNAME }, 201);
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!env.PASSWORD_PEPPER) {
    return json({ error: "Sign-in is not configured." }, 503);
  }
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.username !== "string" || typeof body.password !== "string") {
    return json({ error: LOGIN_FAIL }, 401);
  }
  const username = body.username.trim().toLowerCase();
  const password = body.password;
  const ip = clientIp(request);
  await pruneAttempts(env);
  if (await lockedOut(env, username, ip)) {
    return json({ error: LOGIN_FAIL }, 429);
  }
  const row = await env.DB.prepare(
    `SELECT id, username, password_hash, password_salt, hash_params, disabled, must_change_password, deleted_at
     FROM staff WHERE username = ?1`,
  ).bind(username).first<StaffRow>();
  const iterations = row ? iterationsFrom(row.hash_params) : HASH_ITERATIONS;
  const salt = row ? hexToBytes(row.password_salt) : crypto.getRandomValues(new Uint8Array(16));
  const hashed = await hashPassword(password, env.PASSWORD_PEPPER, iterations || HASH_ITERATIONS, salt);
  const matches = row
    && !row.disabled
    && !row.deleted_at
    && iterations !== null
    && timingSafeEqual(hashed.hash, row.password_hash);
  if (!matches || !row) {
    await recordAttempt(env, username, ip, false);
    const actor = username && username !== password ? username : "unknown";
    await recordAudit(env, actor, "Sign-in failed", "");
    return json({ error: LOGIN_FAIL }, 401);
  }
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO login_attempts (username, ip, succeeded, created_at) VALUES (?1, ?2, 1, datetime('now'))",
    ).bind(username, ip),
    env.DB.prepare(
      "UPDATE staff SET last_login_at = ?1 WHERE id = ?2 AND disabled = 0 AND deleted_at IS NULL",
    ).bind(now.toISOString(), row.id),
    env.DB.prepare(
      "INSERT INTO sessions (id, staff_id, token_hash, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    ).bind(crypto.randomUUID(), row.id, tokenHash, expires, now.toISOString()),
    auditStatement(env, row.username, "Signed in", ""),
  ]);
  return json({ username: row.username }, 200, { "Set-Cookie": cookie(token, SESSION_SECONDS) });
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const header = request.headers.get("Cookie") || "";
  const match = /(?:^|;\s*)fmt_session=([0-9a-f]+)(?:;|$)/i.exec(header);
  if (match) {
    const tokenHash = await sha256Hex(match[1]);
    const row = await env.DB.prepare(
      `SELECT u.username FROM sessions s JOIN staff u ON u.id = s.staff_id
       WHERE s.token_hash = ?1`,
    ).bind(tokenHash).first<{ username: string }>();
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
    if (row?.username) {
      await recordAudit(env, row.username, "Signed out", "");
    }
  }
  return json({ ok: true }, 200, { "Set-Cookie": cookie("expired", 0) });
}

export async function handlePassword(request: Request, env: Env, user: StaffUser): Promise<Response> {
  if (!env.PASSWORD_PEPPER) {
    return json({ error: "Sign-in is not configured." }, 503);
  }
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.current_password !== "string" || typeof body.new_password !== "string") {
    throw new HttpError(400, "Enter the current password and a new password.");
  }
  if (!passwordOk(body.new_password)) {
    throw new HttpError(400, "The new password must be 12 to 128 characters.");
  }
  const row = await env.DB.prepare(
    "SELECT password_hash, password_salt, hash_params, disabled, deleted_at FROM staff WHERE id = ?1",
  ).bind(user.id).first<Pick<StaffRow, "password_hash" | "password_salt" | "hash_params" | "disabled" | "deleted_at">>();
  if (!row || row.disabled || row.deleted_at) {
    throw new HttpError(401, LOGIN_FAIL);
  }
  const iterations = iterationsFrom(row.hash_params);
  if (!iterations) {
    throw new HttpError(401, LOGIN_FAIL);
  }
  const current = await hashPassword(
    body.current_password,
    env.PASSWORD_PEPPER,
    iterations,
    hexToBytes(row.password_salt),
  );
  if (!timingSafeEqual(current.hash, row.password_hash)) {
    throw new HttpError(401, LOGIN_FAIL);
  }
  const next = await hashPassword(body.new_password, env.PASSWORD_PEPPER, HASH_ITERATIONS);
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString();
  const stamp = now.toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE staff
       SET password_hash = ?1, password_salt = ?2, hash_params = ?3, must_change_password = 0
       WHERE id = ?4 AND password_hash = ?5 AND disabled = 0 AND deleted_at IS NULL`,
    ).bind(next.hash, next.salt, next.params, user.id, row.password_hash),
    env.DB.prepare(
      `DELETE FROM sessions WHERE staff_id = ?1 AND EXISTS (
         SELECT 1 FROM staff WHERE id = ?1 AND password_hash = ?2
       )`,
    ).bind(user.id, next.hash),
    env.DB.prepare(
      `INSERT INTO sessions (id, staff_id, token_hash, expires_at, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5
       WHERE EXISTS (SELECT 1 FROM staff WHERE id = ?2 AND password_hash = ?6)`,
    ).bind(crypto.randomUUID(), user.id, tokenHash, expires, stamp, next.hash),
    env.DB.prepare(
      `INSERT INTO staff_audit (id, at, actor, action, detail)
       SELECT ?1, ?2, ?3, 'Changed own password', ''
       WHERE EXISTS (SELECT 1 FROM staff WHERE id = ?4 AND password_hash = ?5)`,
    ).bind(crypto.randomUUID(), stamp, user.username, user.id, next.hash),
  ]);
  const changed = Array.isArray(results) ? results[0] : null;
  if (!changed || Number((changed as { meta?: { changes?: number } }).meta?.changes) !== 1) {
    throw new HttpError(401, LOGIN_FAIL);
  }
  return json({ ok: true }, 200, { "Set-Cookie": cookie(token, SESSION_SECONDS) });
}

export async function handleCreateStaff(request: Request, env: Env, actor: StaffUser): Promise<Response> {
  if (actor.mustChangePassword) {
    throw new HttpError(403, "Change your password before continuing.");
  }
  if (!env.PASSWORD_PEPPER) {
    return json({ error: "Sign-in is not configured." }, 503);
  }
  const body = await readJson(request);
  if (!isRecord(body)) {
    throw new HttpError(400, "That request was not valid.");
  }
  const username = asString(typeof body.username === "string" ? body.username.toLowerCase() : "", 3, 254);
  const password = body.password;
  if (!username || username.includes(" ") || typeof password !== "string" || !passwordOk(password)) {
    throw new HttpError(400, "Username must be 3 to 254 characters and the password 12 to 128 characters.");
  }
  const hashed = await hashPassword(password, env.PASSWORD_PEPPER, HASH_ITERATIONS);
  try {
    await env.DB.prepare(
      `INSERT INTO staff
       (id, username, password_hash, password_salt, hash_params, disabled, must_change_password, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 0, 1, ?6)`,
    ).bind(crypto.randomUUID(), username, hashed.hash, hashed.salt, hashed.params, new Date().toISOString()).run();
  } catch {
    throw new HttpError(400, "That username is already in use.");
  }
  await recordAudit(env, actor.username, "Added a staff user", username);
  return json({ username }, 201);
}

export async function measureHash(pepper: string): Promise<{ iterations: number; ms: number }[]> {
  const trials = [100_000, 210_000, 600_000];
  const results: { iterations: number; ms: number }[] = [];
  for (const iterations of trials) {
    const started = Date.now();
    await hashPassword("measure-only", pepper, iterations);
    results.push({ iterations, ms: Date.now() - started });
  }
  return results;
}
