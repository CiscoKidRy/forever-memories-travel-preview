import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const outfile = path.join(os.tmpdir(), "fmt-patch-author-test.mjs");
const esbuild = path.join(root, "node_modules", "esbuild", "bin", "esbuild");
execFileSync(process.execPath, [
  esbuild,
  path.join(root, "src", "inquiries.ts"),
  "--bundle",
  "--format=esm",
  "--platform=neutral",
  `--outfile=${outfile}`,
], { cwd: root, stdio: "pipe" });

const { patchInquiry } = await import(pathToFileURL(outfile).href);
const sessionUser = "staff.check@example.com";
const audits = [];
const env = {
  INQUIRY_STAFF_TOKEN: "test-token",
  INQUIRY_API_ORIGIN: "https://inquiries.example",
  DB: {
    prepare() {
      return {
        bind(...values) {
          return {
            run() {
              audits.push(values);
              return Promise.resolve({ meta: { changes: 1 } });
            },
          };
        },
      };
    },
  },
};

function request(body) {
  return new Request("https://fmt-admin.example/api/inquiries/11111111-1111-4111-8111-111111111111", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

let calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: init && init.body });
  return new Response(JSON.stringify({ staff_note_entries: [], status: "contacted" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const rejected = await patchInquiry(
  request({ status: "contacted", staff_notes: "note-check", author: "other@example.com" }),
  env,
  "11111111-1111-4111-8111-111111111111",
  sessionUser,
).catch((error) => error);
assert.equal(rejected.status, 400);
assert.equal(rejected.message, "Only status and staff notes can be saved.");
assert.equal(calls.length, 0);

calls = [];
const saved = await patchInquiry(
  request({ status: "contacted", staff_notes: "note-check" }),
  env,
  "11111111-1111-4111-8111-111111111111",
  sessionUser,
);
assert.equal(saved.status, 200);
assert.equal(calls.length, 1);
assert.equal(JSON.parse(calls[0].body).author, sessionUser);
assert.deepEqual(Object.keys(JSON.parse(calls[0].body)).sort(), ["author", "staff_notes", "status"]);
assert.equal(audits.length, 1);
assert.equal(audits[0][2], sessionUser);
assert.equal(audits[0][3], "Saved an inquiry");
assert.equal(audits[0][4].includes("note-check"), false);
assert.match(audits[0][4], /contacted$/);

calls = [];
const blank = await patchInquiry(
  request({ status: "booked", staff_notes: "   " }),
  env,
  "11111111-1111-4111-8111-111111111111",
  sessionUser,
);
assert.equal(blank.status, 200);
assert.equal(JSON.parse(calls[0].body).author, sessionUser);
assert.equal(JSON.parse(calls[0].body).staff_notes, "   ");
assert.equal(audits[1][4].includes("   "), false);
assert.match(audits[1][4], /booked$/);

fs.rmSync(outfile, { force: true });
console.log("patch-author tests passed");

function pathToFileURL(file) {
  const href = "file:///" + file.replaceAll("\\", "/");
  return new URL(href);
}
