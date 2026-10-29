import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const page = fs.readFileSync(new URL("./src/adminPage.ts", import.meta.url), "utf8");
const inquiries = fs.readFileSync(new URL("./src/inquiries.ts", import.meta.url), "utf8");

function sliceBetween(source, startMark, endMark) {
  const start = source.indexOf(startMark);
  const end = source.indexOf(endMark, start + startMark.length);
  if (start < 0 || end < 0) {
    throw new Error(`missing ${startMark}`);
  }
  return source.slice(start, end);
}

const code = [
  sliceBetween(page, "function el(", "function dash("),
  sliceBetween(page, "function noteStamp(", "var TWO_DAYS"),
  "var TWO_DAYS = 2 * 24 * 60 * 60 * 1000;\n",
  sliceBetween(page, "function staffNoteEntry(", "function renderStaffNotes("),
].join("\n");

function createElement(tag) {
  return {
    tag,
    className: "",
    attrs: {},
    children: [],
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    addEventListener() {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(child) {
      this.children.push(child);
    },
  };
}

const context = {
  document: {
    createElement,
    createTextNode(text) {
      return { text };
    },
  },
  setTimeout() {},
  Date,
  Intl,
};
vm.runInNewContext(`${code}\nthis.noteStamp = noteStamp;\nthis.staffNoteEntry = staffNoteEntry;`, context);

const expected = [
  ["2026-10-27T20:00:39.240Z", "10/27/2026 02:00:39 PM MDT"],
  ["2026-11-01T07:59:59Z", "11/01/2026 01:59:59 AM MDT"],
  ["2026-11-01T08:00:00Z", "11/01/2026 01:00:00 AM MST"],
  ["2026-01-15T07:00:00Z", "01/15/2026 12:00:00 AM MST"],
  ["2026-07-15T18:00:00Z", "07/15/2026 12:00:00 PM MDT"],
];
for (const [iso, stamp] of expected) {
  assert.equal(context.noteStamp(iso), stamp, iso);
}
assert.equal(context.noteStamp(""), "");
assert.equal(context.noteStamp("not-a-date"), "");

const saved = context.staffNoteEntry(
  {
    id: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-10-27T20:00:39.240Z",
    deleted_at: null,
    created_by: "jennifer@forevermemoriestravel.com",
    body: "note body stays in the bubble",
  },
  "22222222-2222-4222-8222-222222222222",
  { querySelector() { return null; }, append() {} },
);
assert.equal(saved.children.at(-1).className, "staff-author");
assert.equal(saved.children.at(-1).children[0].text, "jennifer@forevermemoriestravel.com");
assert.equal(saved.children[0].children[0].text, "10/27/2026 02:00:39 PM MDT");
assert.equal(saved.children[1].className, "staff-bubble");
assert.equal(saved.children[1].children[0].text, "note body stays in the bubble");
assert.equal(saved.children[2].tag, "button");

const old = context.staffNoteEntry(
  {
    id: "33333333-3333-4333-8333-333333333333",
    created_at: "2026-10-27T20:00:39.240Z",
    deleted_at: null,
    created_by: null,
    body: "older note",
  },
  "22222222-2222-4222-8222-222222222222",
  { querySelector() { return null; }, append() {} },
);
assert.equal(old.children.at(-1).children[0].text, "—");

const deleted = context.staffNoteEntry(
  {
    id: "44444444-4444-4444-8444-444444444444",
    created_at: "2026-10-27T20:00:39.240Z",
    deleted_at: "2026-10-28T20:00:39.240Z",
    created_by: "ryanhocking@gmail.com",
    body: "deleted note",
  },
  "22222222-2222-4222-8222-222222222222",
  { querySelector() { return null; }, append() {} },
);
assert.equal(deleted.className, "staff-saved is-deleted");
assert.equal(deleted.children[0].children[0].text, "Deleted · 10/27/2026 02:00:39 PM MDT");
assert.equal(deleted.children.at(-1).children[0].text, "ryanhocking@gmail.com");
assert.equal(deleted.children.some((child) => child.tag === "button"), false);

assert.equal(context.staffNoteEntry({ created_at: "" }, "id", {}), null);
assert.match(page, /Submitted " \+ \(mountainTime\(row\.submitted_at\)/);
assert.match(page, /mountainTime\(row\.submitted_at\)/);
assert.doesNotMatch(sliceBetween(page, "function staffNoteEntry(", "function renderStaffNotes("), /mountainTime\(/);

assert.match(inquiries, /key !== "status" && key !== "staff_notes"/);
assert.match(inquiries, /author: username/);
assert.doesNotMatch(inquiries, /key !== "author"/);

console.log("note-stamp tests passed");
