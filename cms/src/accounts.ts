import { auditStatement, listAudit } from "./audit";
import { HASH_ITERATIONS, hashPassword } from "./auth";
import { HttpError, json } from "./http";
import type { Env, StaffUser } from "./types";

export const ACCOUNT_HOLD_MS = 5 * 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

interface AccountRow {
  id: string;
  username: string;
  disabled: number;
  must_change_password: number;
  created_at: string;
  last_login_at: string | null;
  deleted_at: string | null;
}

function wrote(result: unknown): boolean {
  if (!result || typeof result !== "object" || !("meta" in result)) {
    return false;
  }
  const meta = (result as { meta?: { changes?: number | string } }).meta;
  return Number(meta?.changes) === 1;
}

export function temporaryPassword(): string {
  const limit = 256 - (256 % TEMP_ALPHABET.length);
  const chars: string[] = [];
  while (chars.length < 16) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    for (const byte of bytes) {
      if (byte < limit) {
        chars.push(TEMP_ALPHABET[byte % TEMP_ALPHABET.length]);
        if (chars.length === 16) {
          break;
        }
      }
    }
  }
  return chars.join("");
}

export async function purgeDeletedStaff(env: Env): Promise<void> {
  const cutoff = new Date(Date.now() - ACCOUNT_HOLD_MS).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM sessions WHERE staff_id IN (
         SELECT id FROM staff WHERE deleted_at IS NOT NULL AND deleted_at <= ?1
       )`,
    ).bind(cutoff),
    env.DB.prepare(
      "DELETE FROM staff WHERE deleted_at IS NOT NULL AND deleted_at <= ?1",
    ).bind(cutoff),
  ]);
}

function publicAccount(row: AccountRow) {
  return {
    id: row.id,
    username: row.username,
    disabled: row.disabled === 1,
    deleted_at: row.deleted_at,
    must_change_password: row.must_change_password === 1,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
  };
}

async function loadAccount(env: Env, id: string): Promise<AccountRow | null> {
  return env.DB.prepare(
    `SELECT id, username, disabled, must_change_password, created_at, last_login_at, deleted_at
     FROM staff WHERE id = ?1`,
  ).bind(id).first<AccountRow>();
}

export async function handleListStaff(env: Env, actor: StaffUser): Promise<Response> {
  await purgeDeletedStaff(env);
  const listed = await env.DB.prepare(
    `SELECT id, username, disabled, must_change_password, created_at, last_login_at, deleted_at
     FROM staff ORDER BY username`,
  ).all<AccountRow>();
  return json({
    you: actor.username,
    hold_ms: ACCOUNT_HOLD_MS,
    accounts: (listed.results ?? []).map(publicAccount),
  });
}

export async function handleListActivity(env: Env): Promise<Response> {
  await purgeDeletedStaff(env);
  return json({ events: await listAudit(env) });
}

function rejectOwnAccount(row: AccountRow, actor: StaffUser): void {
  if (row.id === actor.id) {
    throw new HttpError(400, "Use Change password on this page for your own account.");
  }
}

export async function handleStaffAction(
  env: Env,
  actor: StaffUser,
  id: string,
  action: string,
): Promise<Response> {
  if (!UUID.test(id)) {
    throw new HttpError(404, "That account was not found.");
  }
  if (action === "reset" && !env.PASSWORD_PEPPER) {
    return json({ error: "Sign-in is not configured." }, 503);
  }
  await purgeDeletedStaff(env);
  const row = await loadAccount(env, id);
  if (!row) {
    throw new HttpError(404, "That account was not found.");
  }
  if (action === "reset" || action === "disable" || action === "delete") {
    rejectOwnAccount(row, actor);
  }
  if ((action === "disable" || action === "enable") && row.deleted_at) {
    throw new HttpError(400, "Restore this account first.");
  }
  if (action === "delete" && row.deleted_at) {
    throw new HttpError(400, "This account is already deleted.");
  }
  if (action === "restore" && !row.deleted_at) {
    throw new HttpError(400, "This account is not deleted.");
  }
  if (action === "enable" && row.disabled !== 1) {
    throw new HttpError(400, "This account is already enabled.");
  }
  if (action === "disable" && row.disabled === 1) {
    throw new HttpError(400, "This account is already disabled.");
  }

  if (action === "reset") {
    const temporary = temporaryPassword();
    const hashed = await hashPassword(temporary, env.PASSWORD_PEPPER || "", HASH_ITERATIONS);
    const stamp = new Date().toISOString();
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE staff
         SET password_hash = ?1, password_salt = ?2, hash_params = ?3, must_change_password = 1
         WHERE id = ?4 AND id != ?5`,
      ).bind(hashed.hash, hashed.salt, hashed.params, row.id, actor.id),
      env.DB.prepare(
        `DELETE FROM sessions WHERE staff_id = ?1 AND EXISTS (
           SELECT 1 FROM staff WHERE id = ?1 AND password_hash = ?2
         )`,
      ).bind(row.id, hashed.hash),
      env.DB.prepare(
        `INSERT INTO staff_audit (id, at, actor, action, detail)
         SELECT ?1, ?2, ?3, 'Reset a password', ?4
         WHERE EXISTS (SELECT 1 FROM staff WHERE id = ?5 AND password_hash = ?6)`,
      ).bind(crypto.randomUUID(), stamp, actor.username, row.username, row.id, hashed.hash),
    ]);
    if (!wrote(Array.isArray(results) ? results[0] : null)) {
      throw new HttpError(400, "The password was not reset.");
    }
    return json({
      username: row.username,
      temporary_password: temporary,
      must_change_password: true,
    });
  }

  if (action === "disable") {
    const stamp = new Date().toISOString();
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE staff SET disabled = 1
         WHERE id = ?1 AND id != ?2 AND deleted_at IS NULL AND disabled = 0
           AND (SELECT count(*) FROM staff WHERE disabled = 0 AND deleted_at IS NULL) > 1`,
      ).bind(row.id, actor.id),
      env.DB.prepare(
        `INSERT INTO staff_audit (id, at, actor, action, detail)
         SELECT ?1, ?2, ?3, 'Disabled an account', ?4
         WHERE changes() = 1`,
      ).bind(crypto.randomUUID(), stamp, actor.username, row.username),
      env.DB.prepare(
        `DELETE FROM sessions WHERE staff_id = ?1 AND changes() = 1`,
      ).bind(row.id),
    ]);
    if (!wrote(Array.isArray(results) ? results[0] : null)) {
      throw new HttpError(400, "Keep at least one account that can sign in.");
    }
    return json({ username: row.username, disabled: true });
  }

  if (action === "enable") {
    const updated = await env.DB.prepare(
      "UPDATE staff SET disabled = 0 WHERE id = ?1 AND deleted_at IS NULL AND disabled = 1",
    ).bind(row.id).run();
    if (!wrote(updated)) {
      throw new HttpError(400, "Restore this account first.");
    }
    await auditStatement(env, actor.username, "Enabled an account", row.username).run();
    return json({ username: row.username, disabled: false });
  }

  if (action === "delete") {
    const stamp = new Date().toISOString();
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE staff SET deleted_at = ?1
         WHERE id = ?2 AND id != ?3 AND deleted_at IS NULL
           AND (
             disabled = 1
             OR (SELECT count(*) FROM staff WHERE disabled = 0 AND deleted_at IS NULL) > 1
           )`,
      ).bind(stamp, row.id, actor.id),
      env.DB.prepare(
        `DELETE FROM sessions WHERE staff_id = ?1 AND EXISTS (
           SELECT 1 FROM staff WHERE id = ?1 AND deleted_at = ?2
         )`,
      ).bind(row.id, stamp),
      env.DB.prepare(
        `INSERT INTO staff_audit (id, at, actor, action, detail)
         SELECT ?1, ?2, ?3, 'Deleted an account', ?4
         WHERE EXISTS (SELECT 1 FROM staff WHERE id = ?5 AND deleted_at = ?6)`,
      ).bind(crypto.randomUUID(), stamp, actor.username, row.username, row.id, stamp),
    ]);
    if (!wrote(Array.isArray(results) ? results[0] : null)) {
      throw new HttpError(400, "Keep at least one account that can sign in.");
    }
    return json({ username: row.username, deleted_at: stamp });
  }

  if (action === "restore") {
    const updated = await env.DB.prepare(
      "UPDATE staff SET deleted_at = NULL WHERE id = ?1 AND deleted_at IS NOT NULL",
    ).bind(row.id).run();
    if (!wrote(updated)) {
      throw new HttpError(404, "That account was not found.");
    }
    await auditStatement(env, actor.username, "Restored an account", row.username).run();
    return json({ username: row.username, deleted_at: null });
  }

  throw new HttpError(404, "not_found");
}
