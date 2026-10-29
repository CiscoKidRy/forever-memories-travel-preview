import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FAIL = "That username and password did not match.";
const HOLD_MS = 5 * 24 * 60 * 60 * 1000;

execFileSync("npx wrangler deploy --dry-run --outdir dist", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

const bundle = fs.readFileSync(path.join(root, "dist", "index.js"), "utf8");
assert.match(bundle, /\/api\/staff/);
assert.match(bundle, /staff_audit/);
assert.doesNotMatch(bundle, /scheduled\s*\(/);
assert.doesNotMatch(bundle, /crons/);

const mf = new Miniflare({
  modules: true,
  scriptPath: path.join(root, "dist", "index.js"),
  compatibilityDate: "2026-10-14",
  d1Databases: ["DB"],
  bindings: {
    PASSWORD_PEPPER: "pepper-for-the-account-test",
    SETUP_TOKEN: "setup-token-for-the-account-test",
    GITHUB_OWNER: "CiscoKidRy",
    GITHUB_REPO: "forever-memories-travel",
    GITHUB_BRANCH: "main",
    INQUIRY_API_ORIGIN: "https://inquiries.example",
  },
});

const db = await mf.getD1Database("DB");
const schema = fs.readFileSync(path.join(root, "schema.sql"), "utf8")
  .split(";")
  .map((statement) => statement.replace(/--[^\n]*/g, "").trim())
  .filter(Boolean);
for (const statement of schema) {
  await db.prepare(statement).run();
}

async function send(pathname, { method = "GET", cookie = "", body, token, ip } = {}) {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (ip) headers.set("CF-Connecting-IP", ip);
  const response = await mf.dispatchFetch(`https://fmt-admin.test${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) data = JSON.parse(text);
  const setCookie = response.headers.get("Set-Cookie") || "";
  const session = /fmt_session=([0-9a-f]+)/i.exec(setCookie);
  return {
    status: response.status,
    data,
    cookie: session ? `fmt_session=${session[1]}` : cookie,
  };
}

function accountNamed(list, username) {
  return (list.data.accounts || []).find((row) => row.username === username);
}

const setup = await send("/setup", {
  method: "POST",
  token: "setup-token-for-the-account-test",
  body: { username: "ryanhocking@gmail.com", password: "first-password-ok" },
});
assert.equal(setup.status, 201, JSON.stringify(setup.data));

const first = await send("/login", {
  method: "POST",
  body: { username: "ryanhocking@gmail.com", password: "first-password-ok" },
});
assert.equal(first.status, 200, JSON.stringify(first.data));
assert.match(first.cookie, /^fmt_session=[0-9a-f]+$/);

const unsigned = await send("/api/staff");
assert.equal(unsigned.status, 401);
const unsignedLog = await send("/api/staff/activity");
assert.equal(unsignedLog.status, 401);

const listed = await send("/api/staff", { cookie: first.cookie });
assert.equal(listed.status, 200, JSON.stringify(listed.data));
assert.equal(listed.data.hold_ms, HOLD_MS);
assert.equal(listed.data.accounts.length, 1);
assert.equal(listed.data.you, "ryanhocking@gmail.com");
assert.equal(typeof accountNamed(listed, "ryanhocking@gmail.com").last_login_at, "string");
const listedText = JSON.stringify(listed.data);
assert.equal(listedText.includes("password_hash"), false);
assert.equal(listedText.includes("password_salt"), false);
assert.equal(listedText.includes("temporary_password"), false);

const created = await send("/api/staff", {
  method: "POST",
  cookie: first.cookie,
  body: { username: "Staff.Two@example.com", password: "second-password-ok" },
});
assert.equal(created.status, 201, JSON.stringify(created.data));

const secondLogin = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: "second-password-ok" },
});
assert.equal(secondLogin.status, 200, JSON.stringify(secondLogin.data));
const blocked = await send("/api/staff", { cookie: secondLogin.cookie });
assert.equal(blocked.status, 403);

const both = await send("/api/staff", { cookie: first.cookie });
const second = accountNamed(both, "staff.two@example.com");
assert.ok(second);
assert.equal(second.must_change_password, true);
assert.equal(typeof second.last_login_at, "string");
assert.equal(second.disabled, false);
assert.equal(second.deleted_at, null);

const selfDelete = await send(`/api/staff/${accountNamed(both, "ryanhocking@gmail.com").id}/delete`, {
  method: "POST",
  cookie: first.cookie,
});
assert.equal(selfDelete.status, 400);

const reset = await send(`/api/staff/${second.id}/reset`, { method: "POST", cookie: first.cookie });
assert.equal(reset.status, 200, JSON.stringify(reset.data));
assert.equal(reset.data.temporary_password.length, 16);
const oldSession = await send("/api/me", { cookie: secondLogin.cookie });
assert.equal(oldSession.status, 401);
const oldPassword = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: "second-password-ok" },
});
assert.equal(oldPassword.status, 401);
assert.equal(oldPassword.data.error, FAIL);
const tempLogin = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: reset.data.temporary_password },
});
assert.equal(tempLogin.status, 200, JSON.stringify(tempLogin.data));
const sibling = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: reset.data.temporary_password },
});
assert.equal(sibling.status, 200, JSON.stringify(sibling.data));
assert.notEqual(sibling.cookie, tempLogin.cookie);
const stillLocked = await send("/api/staff", { cookie: tempLogin.cookie });
assert.equal(stillLocked.status, 403);

const changed = await send("/api/password", {
  method: "POST",
  cookie: tempLogin.cookie,
  body: { current_password: reset.data.temporary_password, new_password: "third-password-ok" },
});
assert.equal(changed.status, 200, JSON.stringify(changed.data));
assert.match(changed.cookie, /^fmt_session=[0-9a-f]+$/);
assert.notEqual(changed.cookie, tempLogin.cookie);
assert.notEqual(changed.cookie, sibling.cookie);
assert.equal((await send("/api/me", { cookie: tempLogin.cookie })).status, 401);
assert.equal((await send("/api/me", { cookie: sibling.cookie })).status, 401);
const rotated = await send("/api/me", { cookie: changed.cookie });
assert.equal(rotated.status, 200, JSON.stringify(rotated.data));
assert.equal(rotated.data.must_change_password, false);
const secondReady = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: "third-password-ok" },
});
assert.equal(secondReady.status, 200);

const disable = await send(`/api/staff/${second.id}/disable`, { method: "POST", cookie: first.cookie });
assert.equal(disable.status, 200, JSON.stringify(disable.data));
const disabledSession = await send("/api/me", { cookie: secondReady.cookie });
assert.equal(disabledSession.status, 401);
const disabledLogin = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: "third-password-ok" },
});
assert.equal(disabledLogin.status, 401);
assert.equal(disabledLogin.data.error, FAIL);

const enable = await send(`/api/staff/${second.id}/enable`, { method: "POST", cookie: first.cookie });
assert.equal(enable.status, 200, JSON.stringify(enable.data));
assert.equal((await send("/api/me", { cookie: secondReady.cookie })).status, 401);
const enabledLogin = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: "third-password-ok" },
});
assert.equal(enabledLogin.status, 200);

const removed = await send(`/api/staff/${second.id}/delete`, { method: "POST", cookie: first.cookie });
assert.equal(removed.status, 200, JSON.stringify(removed.data));
const afterDelete = await send("/api/staff", { cookie: first.cookie });
const deletedRow = accountNamed(afterDelete, "staff.two@example.com");
assert.ok(deletedRow.deleted_at);
const deletedLogin = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: "third-password-ok" },
});
assert.equal(deletedLogin.status, 401);
assert.equal(deletedLogin.data.error, FAIL);
const deletedSession = await send("/api/me", { cookie: enabledLogin.cookie });
assert.equal(deletedSession.status, 401);

const deletedReset = await send(`/api/staff/${second.id}/reset`, { method: "POST", cookie: first.cookie });
assert.equal(deletedReset.status, 200, JSON.stringify(deletedReset.data));
const stillDeleted = accountNamed(await send("/api/staff", { cookie: first.cookie }), "staff.two@example.com");
assert.equal(stillDeleted.deleted_at, deletedRow.deleted_at);
const deletedResetLogin = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: deletedReset.data.temporary_password },
});
assert.equal(deletedResetLogin.status, 401);
assert.equal(deletedResetLogin.data.error, FAIL);
const again = await send(`/api/staff/${second.id}/delete`, { method: "POST", cookie: first.cookie });
assert.equal(again.status, 400);
const stillThere = accountNamed(await send("/api/staff", { cookie: first.cookie }), "staff.two@example.com");
assert.equal(stillThere.deleted_at, deletedRow.deleted_at);

const restored = await send(`/api/staff/${second.id}/restore`, { method: "POST", cookie: first.cookie });
assert.equal(restored.status, 200, JSON.stringify(restored.data));
assert.equal((await send("/api/me", { cookie: enabledLogin.cookie })).status, 401);
const afterRestore = accountNamed(await send("/api/staff", { cookie: first.cookie }), "staff.two@example.com");
assert.equal(afterRestore.deleted_at, null);
assert.equal(afterRestore.disabled, false);
const currentPassword = deletedReset.data.temporary_password;
const restoredLogin = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: currentPassword },
});
assert.equal(restoredLogin.status, 200, JSON.stringify(restoredLogin.data));
const restoredMe = await send("/api/me", { cookie: restoredLogin.cookie });
assert.equal(restoredMe.status, 200, JSON.stringify(restoredMe.data));
assert.equal(restoredMe.data.must_change_password, true);

await send(`/api/staff/${second.id}/disable`, { method: "POST", cookie: first.cookie });
await send(`/api/staff/${second.id}/delete`, { method: "POST", cookie: first.cookie });
const restoredDisabled = await send(`/api/staff/${second.id}/restore`, { method: "POST", cookie: first.cookie });
assert.equal(restoredDisabled.status, 200);
const backDisabled = accountNamed(await send("/api/staff", { cookie: first.cookie }), "staff.two@example.com");
assert.equal(backDisabled.disabled, true);
assert.equal(backDisabled.deleted_at, null);
const disabledStill = await send("/login", {
  method: "POST",
  body: { username: "staff.two@example.com", password: currentPassword },
});
assert.equal(disabledStill.status, 401);
assert.equal(disabledStill.data.error, FAIL);
assert.equal((await send("/api/me", { cookie: restoredLogin.cookie })).status, 401);

const duplicate = await send("/api/staff", {
  method: "POST",
  cookie: first.cookie,
  body: { username: "staff.two@example.com", password: "second-password-ok" },
});
assert.equal(duplicate.status, 400);

const stale = new Date(Date.now() - HOLD_MS - 1000).toISOString();
await db.prepare("UPDATE staff SET deleted_at = ?1 WHERE username = ?2").bind(stale, "staff.two@example.com").run();
const purged = await send("/api/staff", { cookie: first.cookie });
assert.equal(accountNamed(purged, "staff.two@example.com"), undefined);
assert.equal(purged.data.accounts.length, 1);

const recent = new Date(Date.now() - HOLD_MS + 60_000).toISOString();
const recreated = await send("/api/staff", {
  method: "POST",
  cookie: first.cookie,
  body: { username: "staff.two@example.com", password: "second-password-ok" },
});
assert.equal(recreated.status, 201, JSON.stringify(recreated.data));
const reloaded = accountNamed(await send("/api/staff", { cookie: first.cookie }), "staff.two@example.com");
await db.prepare("UPDATE staff SET deleted_at = ?1 WHERE id = ?2").bind(recent, reloaded.id).run();
const kept = accountNamed(await send("/api/staff", { cookie: first.cookie }), "staff.two@example.com");
assert.equal(kept.deleted_at, recent);

const echoed = "echo-user-secret-value";
const echoFail = await send("/login", {
  method: "POST",
  ip: "203.0.113.10",
  body: { username: echoed, password: echoed },
});
assert.equal(echoFail.status, 401);
assert.equal(echoFail.data.error, FAIL);
const auditRows = await db.prepare("SELECT actor, action, detail FROM staff_audit").all();
const auditDump = JSON.stringify(auditRows.results);
assert.equal(auditDump.includes(echoed), false);
assert.ok(auditRows.results.some((row) => row.action === "Sign-in failed" && row.actor === "unknown"));

const ghost = "ghost-lockout@example.com";
for (let attempt = 0; attempt < 5; attempt += 1) {
  const fail = await send("/login", {
    method: "POST",
    ip: "203.0.113.20",
    body: { username: ghost, password: "wrong-password-1" },
  });
  assert.equal(fail.status, 401, JSON.stringify(fail.data));
  assert.equal(fail.data.error, FAIL);
}
const locked = await send("/login", {
  method: "POST",
  ip: "203.0.113.20",
  body: { username: ghost, password: "wrong-password-1" },
});
assert.equal(locked.status, 429, JSON.stringify(locked.data));
assert.equal(locked.data.error, FAIL);
const ghostAudits = await db.prepare(
  "SELECT count(*) AS n FROM staff_audit WHERE action = 'Sign-in failed' AND actor = ?1",
).bind(ghost).first();
assert.equal(Number(ghostAudits.n), 5);
const ghostAttempts = await db.prepare(
  "SELECT count(*) AS n FROM login_attempts WHERE username = ?1",
).bind(ghost).first();
assert.equal(Number(ghostAttempts.n), 5);
const lockedAudits = await db.prepare(
  "SELECT count(*) AS n FROM staff_audit WHERE action = 'Sign-in locked'",
).first();
assert.equal(Number(lockedAudits.n), 0);

const activity = await send("/api/staff/activity", { cookie: first.cookie });
assert.equal(activity.status, 200);
const actions = activity.data.events.map((event) => event.action);
for (const name of ["Signed in", "Added a staff user", "Reset a password", "Disabled an account", "Enabled an account", "Deleted an account", "Restored an account", "Changed own password", "Sign-in failed"]) {
  assert.ok(actions.includes(name), name);
}
const dumped = JSON.stringify(activity.data);
assert.equal(dumped.includes(reset.data.temporary_password), false);
assert.equal(dumped.includes(deletedReset.data.temporary_password), false);
assert.equal(dumped.includes("third-password-ok"), false);
assert.equal(dumped.includes("password_hash"), false);
assert.equal(dumped.includes(echoed), false);

const signedOut = await send("/logout", { method: "POST", cookie: first.cookie });
assert.equal(signedOut.status, 200);
const afterOut = await send("/api/me", { cookie: first.cookie });
assert.equal(afterOut.status, 401);
const signedOutRows = await db.prepare(
  "SELECT action FROM staff_audit WHERE action = 'Signed out'",
).all();
assert.ok(signedOutRows.results.length >= 1);

await mf.dispose();
console.log("account flow tests passed");
