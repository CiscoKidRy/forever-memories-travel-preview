import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const page = fs.readFileSync(new URL("../src/adminPage.ts", import.meta.url), "utf8");
const accounts = fs.readFileSync(new URL("../src/accounts.ts", import.meta.url), "utf8");
const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;

function sliceBetween(source, startMark, endMark) {
  const start = source.indexOf(startMark);
  const end = source.indexOf(endMark, start + startMark.length);
  if (start < 0 || end < 0) throw new Error(`missing ${startMark}`);
  return source.slice(start, end);
}

const code = [
  sliceBetween(page, "function el(", "function dash("),
  sliceBetween(page, "function noteStamp(", "var TWO_DAYS"),
  sliceBetween(page, "var FIVE_DAYS = ", "function loadAccounts("),
].join("\n");

function createElement(tag) {
  const node = {
    tag,
    className: "",
    attrs: {},
    children: [],
    setAttribute(key, value) { this.attrs[key] = value; },
    addEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
    append(child) { this.children.push(child); },
    remove() { this.removed = true; },
  };
  return node;
}

const context = {
  document: {
    createElement,
    createTextNode(text) { return { text }; },
  },
  setTimeout() {},
  Date,
  Intl,
};
vm.runInNewContext(
  `${code}\nthis.accountStatus = accountStatus;\nthis.accountClass = accountClass;\nthis.accountButtons = accountButtons;\nthis.accountRow = accountRow;\nthis.FIVE_DAYS = FIVE_DAYS;\nthis.noteStamp = noteStamp;`,
  context,
);

assert.equal(context.FIVE_DAYS, FIVE_DAYS);
assert.match(accounts, /export const ACCOUNT_HOLD_MS = 5 \* 24 \* 60 \* 60 \* 1000/);
assert.match(page, /tr\.account-disabled td[\s\S]*#5b656c[\s\S]*#eceae4/);
assert.match(page, /tr\.account-deleted td[\s\S]*#1a1e22[\s\S]*#a39e96/);
assert.match(page, /max-height: 18rem/);
assert.match(page, /overflow: auto/);

const me = "ryan@example.com";
const active = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "other@example.com",
  disabled: false,
  deleted_at: null,
  must_change_password: false,
  last_login_at: "2026-10-27T20:00:39.240Z",
};
assert.equal(context.accountStatus(active), "Active");
assert.equal(context.accountClass(active), "");
assert.equal(JSON.stringify(context.accountButtons(active, me)), JSON.stringify(["Reset password", "Disable", "Delete"]));

const mine = { ...active, username: me };
assert.equal(JSON.stringify(context.accountButtons(mine, me)), "[]");
const mineRow = context.accountRow(mine, me, () => {});
assert.equal(mineRow.children[3].children[0].children[0].text, "This account is you.");
assert.equal(mineRow.children[2].children[0].children[0].text, "10/27/2026 02:00:39 PM MDT");

const disabled = { ...active, disabled: true, last_login_at: null };
assert.equal(context.accountStatus(disabled), "Disabled");
assert.equal(context.accountClass(disabled), "account-disabled");
assert.equal(JSON.stringify(context.accountButtons(disabled, me)), JSON.stringify(["Reset password", "Enable", "Delete"]));
const disabledRow = context.accountRow(disabled, me, () => {});
assert.equal(disabledRow.className, "account-disabled");
assert.equal(disabledRow.children[2].children[0].children[0].text, "—");

const mustChange = { ...active, must_change_password: true };
assert.equal(context.accountStatus(mustChange), "Active, must change password");

const deletedAt = "2026-10-27T18:00:00.000Z";
const deleted = { ...active, disabled: true, deleted_at: deletedAt };
assert.equal(context.accountStatus(deleted), "Deleted");
assert.equal(context.accountClass(deleted), "account-deleted");
assert.equal(JSON.stringify(context.accountButtons(deleted, me)), JSON.stringify(["Reset password", "Restore"]));
const deletedRow = context.accountRow(deleted, me, () => {});
assert.equal(deletedRow.className, "account-deleted");
assert.match(deletedRow.children[1].children[0].text, /^Deleted\. Gone after 11\/01\/2026 11:00:00 AM MST\.$/);

const expired = { ...deleted, deleted_at: new Date(Date.now() - FIVE_DAYS).toISOString() };
assert.equal(context.accountRow(expired, me, () => {}), null);
const staying = { ...deleted, deleted_at: new Date(Date.now() - FIVE_DAYS + 60_000).toISOString() };
assert.equal(context.accountRow(staying, me, () => {}).className, "account-deleted");

console.log("account page tests passed");
