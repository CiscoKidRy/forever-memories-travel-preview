import { recordAudit } from "./audit";
import { HttpError, asString, isRecord } from "./http";
import type { Env, StaffUser } from "./types";

export interface DocumentRow {
  id: string;
  kind: string;
  slug: string | null;
  status: string;
  body_json: string;
  updated_at: string;
  updated_by: string;
}

const SECTION_ORDER = ["vacations", "parks", "cruises", "international"];
const FORBIDDEN = ["price", "sku", "availability", "bookUrl"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MEDIA_PATH = /^assets\/media\/[0-9a-f-]+\.(?:jpg|jpeg|png|webp)$/;

export function parseBody(raw: string): Record<string, unknown> {
  const value = JSON.parse(raw) as unknown;
  if (!isRecord(value)) {
    throw new HttpError(400, "That document was not valid.");
  }
  return value;
}

function rejectForbidden(body: Record<string, unknown>): void {
  for (const key of FORBIDDEN) {
    if (key in body) {
      throw new HttpError(400, "That field is not part of this site.");
    }
  }
}

function requireText(body: Record<string, unknown>, key: string, min: number, max: number): string {
  const value = asString(body[key], min, max);
  if (!value) {
    throw new HttpError(400, `Check the ${key} field.`);
  }
  return value;
}

export function validateDocument(kind: string, body: Record<string, unknown>): Record<string, unknown> {
  rejectForbidden(body);
  if (kind === "agency") {
    return {
      name: requireText(body, "name", 1, 120),
      eyebrow: requireText(body, "eyebrow", 1, 120),
      footerLine: requireText(body, "footerLine", 1, 300),
    };
  }
  if (kind === "section" || kind === "plan") {
    const next: Record<string, unknown> = {
      kicker: requireText(body, "kicker", 1, 80),
      heading: requireText(body, "heading", 1, 200),
      body: requireText(body, "body", 1, 4000),
    };
    return next;
  }
  if (kind === "step") {
    const order = body.order;
    return {
      title: requireText(body, "title", 1, 140),
      body: requireText(body, "body", 1, 4000),
      order: typeof order === "number" && order >= 1 && order <= 20 ? order : 1,
    };
  }
  if (kind === "story" || kind === "listing") {
    const image = body.image == null || body.image === "" ? null : asString(body.image, 1, 200);
    if (image && !MEDIA_PATH.test(image)) {
      throw new HttpError(400, "Image path must be a JPEG, PNG, or WebP under assets/media.");
    }
    const next: Record<string, unknown> = {
      title: requireText(body, "title", 1, 140),
      summary: requireText(body, "summary", 1, 300),
      body: requireText(body, "body", 1, 20_000),
      image,
      imageAlt: image ? requireText(body, "imageAlt", 1, 200) : null,
    };
    if (typeof body.slug === "string" && body.slug.trim()) {
      const slug = body.slug.trim();
      if (!SLUG.test(slug) || slug.length > 80) {
        throw new HttpError(400, "Slug uses lowercase letters, numbers, and hyphens.");
      }
      next.slug = slug;
    }
    if (kind === "listing") {
      const category = body.category;
      if (category !== "family" && category !== "park" && category !== "cruise" && category !== "international" && category !== "all-inclusive" && category !== "celebration") {
        throw new HttpError(400, "Pick a listing category.");
      }
      next.category = category;
    }
    if (typeof body.publishedAt === "string") {
      next.publishedAt = body.publishedAt;
    }
    return next;
  }
  throw new HttpError(400, "That document type is not editable.");
}

export async function listDocuments(env: Env): Promise<DocumentRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, kind, slug, status, body_json, updated_at, updated_by
     FROM documents
     WHERE NOT (kind = 'agency' AND slug = 'setup')
     ORDER BY kind, slug
     LIMIT 200`,
  ).all<DocumentRow>();
  return result.results;
}

export function publicDocument(row: DocumentRow): Record<string, unknown> {
  return {
    id: row.id,
    kind: row.kind,
    slug: row.slug,
    status: row.status,
    body: parseBody(row.body_json),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return slug || "item";
}

export async function createDocument(env: Env, user: StaffUser, input: unknown): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    throw new HttpError(400, "That request was not valid.");
  }
  const kind = input.kind;
  if (kind !== "story" && kind !== "listing") {
    throw new HttpError(400, "Create a story or a listing.");
  }
  const body = validateDocument(kind, input);
  let slug = typeof body.slug === "string" ? body.slug : slugify(String(body.title));
  delete body.slug;
  const taken = await env.DB.prepare(
    "SELECT id FROM documents WHERE kind = ?1 AND slug = ?2",
  ).bind(kind, slug).first();
  if (taken) {
    slug = `${slug.slice(0, 60)}-${crypto.randomUUID().slice(0, 8)}`;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO documents (id, kind, slug, status, body_json, updated_at, updated_by)
     VALUES (?1, ?2, ?3, 'draft', ?4, ?5, ?6)`,
  ).bind(id, kind, slug, JSON.stringify(body), now, user.username).run();
  const row = await env.DB.prepare(
    "SELECT id, kind, slug, status, body_json, updated_at, updated_by FROM documents WHERE id = ?1",
  ).bind(id).first<DocumentRow>();
  if (!row) {
    throw new HttpError(500, "The admin hit an error.");
  }
  await recordAudit(env, user.username, "Saved a document", `${kind} ${slug}`);
  return publicDocument(row);
}

export async function updateDocument(
  env: Env,
  user: StaffUser,
  id: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    throw new HttpError(400, "That request was not valid.");
  }
  const current = await env.DB.prepare(
    "SELECT id, kind, slug, status, body_json, updated_at, updated_by FROM documents WHERE id = ?1",
  ).bind(id).first<DocumentRow>();
  if (!current || (current.kind === "agency" && current.slug === "setup")) {
    throw new HttpError(404, "That document was not found.");
  }
  if (current.kind === "agency" && (current.slug === "publish" || current.slug === "intro")) {
    if (current.slug === "publish") {
      throw new HttpError(400, "Publish time is set by the publish button.");
    }
  }
  const merged = { ...parseBody(current.body_json), ...(isRecord(input.body) ? input.body : input) };
  delete merged.id;
  delete merged.kind;
  delete merged.status;
  const body = validatedBody(current, merged);
  const status = input.status === "draft" || input.status === "published" ? input.status : current.status;
  if (current.kind !== "story" && current.kind !== "listing" && status !== "published") {
    throw new HttpError(400, "Page copy stays available to publish.");
  }
  let slug = current.slug;
  if ((current.kind === "story" || current.kind === "listing") && typeof merged.slug === "string" && merged.slug.trim()) {
    if (!SLUG.test(merged.slug)) {
      throw new HttpError(400, "Slug uses lowercase letters, numbers, and hyphens.");
    }
    slug = merged.slug;
  }
  if (status === "published" && (current.kind === "story" || current.kind === "listing") && !body.publishedAt) {
    body.publishedAt = new Date().toISOString();
  }
  delete body.slug;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE documents SET slug = ?1, status = ?2, body_json = ?3, updated_at = ?4, updated_by = ?5 WHERE id = ?6",
  ).bind(slug, status, JSON.stringify(body), now, user.username, id).run();
  const row = await env.DB.prepare(
    "SELECT id, kind, slug, status, body_json, updated_at, updated_by FROM documents WHERE id = ?1",
  ).bind(id).first<DocumentRow>();
  if (!row) {
    throw new HttpError(404, "That document was not found.");
  }
  await recordAudit(env, user.username, "Saved a document", `${row.kind} ${row.slug || row.id}`);
  return publicDocument(row);
}

function validatedBody(current: DocumentRow, merged: Record<string, unknown>): Record<string, unknown> {
  if (current.kind === "agency" && current.slug === "intro") {
    const heading = asString(merged.heading, 1, 200);
    const lede = asString(merged.lede, 1, 1000);
    if (!heading || !lede) {
      throw new HttpError(400, "Check the intro heading and lede.");
    }
    return { heading, lede };
  }
  if (current.kind === "agency" && current.slug === "agency") {
    return validateDocument("agency", merged);
  }
  return validateDocument(current.kind, merged);
}

export async function deleteDocument(env: Env, user: StaffUser, id: string): Promise<Response> {
  const current = await env.DB.prepare(
    "SELECT id, kind, slug, status FROM documents WHERE id = ?1",
  ).bind(id).first<{ id: string; kind: string; slug: string | null; status: string }>();
  if (!current) {
    throw new HttpError(404, "That document was not found.");
  }
  if (current.kind !== "story" && current.kind !== "listing") {
    throw new HttpError(400, "Page copy cannot be deleted.");
  }
  const detail = `${current.kind} ${current.slug || current.id}`;
  if (current.status === "published") {
    await env.DB.prepare(
      "UPDATE documents SET status = 'draft', updated_at = ?1 WHERE id = ?2",
    ).bind(new Date().toISOString(), id).run();
    await recordAudit(env, user.username, "Unpublished a document", detail);
    return new Response(null, { status: 204 });
  }
  await env.DB.prepare("DELETE FROM documents WHERE id = ?1").bind(id).run();
  await recordAudit(env, user.username, "Deleted a document", detail);
  return new Response(null, { status: 204 });
}

export async function buildSiteJson(env: Env): Promise<string> {
  const rows = await listDocuments(env);
  const published = rows.filter((row) => row.status === "published");
  const agency = published.find((row) => row.kind === "agency" && row.slug === "agency");
  const intro = published.find((row) => row.kind === "agency" && row.slug === "intro");
  const plan = published.find((row) => row.kind === "plan" && row.slug === "plan");
  const sections = SECTION_ORDER.map((slug) => published.find((row) => row.kind === "section" && row.slug === slug));
  const steps = published
    .filter((row) => row.kind === "step")
    .sort((a, b) => Number(parseBody(a.body_json).order || 0) - Number(parseBody(b.body_json).order || 0));
  if (!agency || !intro || !plan || sections.some((row) => !row) || steps.length < 3) {
    throw new HttpError(400, "Page copy is incomplete.");
  }
  const introBody = parseBody(intro.body_json);
  const site = {
    version: 1,
    publishedAt: new Date().toISOString(),
    agency: parseBody(agency.body_json),
    intro: {
      heading: introBody.heading,
      lede: introBody.lede,
    },
    sections: sections.map((row) => {
      const body = parseBody(row!.body_json);
      return { id: row!.slug, kicker: body.kicker, heading: body.heading, body: body.body };
    }),
    steps: steps.slice(0, 3).map((row) => {
      const body = parseBody(row.body_json);
      return { title: body.title, body: body.body };
    }),
    plan: (() => {
      const body = parseBody(plan.body_json);
      return { kicker: body.kicker, heading: body.heading, body: body.body };
    })(),
    stories: published.filter((row) => row.kind === "story").map(storyJson),
    listings: published.filter((row) => row.kind === "listing").map(storyJson),
  };
  return JSON.stringify(site, null, 2) + "\n";
}

function storyJson(row: DocumentRow): Record<string, unknown> {
  const body = parseBody(row.body_json);
  const item: Record<string, unknown> = {
    id: row.id,
    slug: row.slug,
    title: body.title,
    summary: body.summary,
    body: body.body,
    image: body.image ?? null,
    imageAlt: body.image ? body.imageAlt : null,
    publishedAt: body.publishedAt ?? null,
  };
  if (row.kind === "listing") {
    item.category = body.category;
  }
  return item;
}

export async function rememberPublish(env: Env, user: StaffUser, commit: string, publishedAt: string): Promise<void> {
  const body = JSON.stringify({ publishedAt, commit });
  const existing = await env.DB.prepare(
    "SELECT id FROM documents WHERE kind = 'agency' AND slug = 'publish'",
  ).first<{ id: string }>();
  if (existing) {
    await env.DB.prepare(
      "UPDATE documents SET body_json = ?1, status = 'published', updated_at = ?2, updated_by = ?3 WHERE id = ?4",
    ).bind(body, publishedAt, user.username, existing.id).run();
    return;
  }
  await env.DB.prepare(
    `INSERT INTO documents (id, kind, slug, status, body_json, updated_at, updated_by)
     VALUES ('doc-publish', 'agency', 'publish', 'published', ?1, ?2, ?3)`,
  ).bind(body, publishedAt, user.username).run();
}
