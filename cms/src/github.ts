import { recordAudit } from "./audit";
import { GITHUB_DOWN, HttpError, bytesToBase64, json } from "./http";
import { buildSiteJson, rememberPublish } from "./documents";
import type { Env, StaffUser } from "./types";

const MEDIA_LIMIT = 900 * 1024;

function configured(env: Env): boolean {
  return Boolean(env.GITHUB_TOKEN && env.GITHUB_OWNER && env.GITHUB_REPO && env.GITHUB_BRANCH);
}

async function github(env: Env, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "forever-memories-travel-admin",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function fileSha(env: Env, path: string): Promise<string | null> {
  const response = await github(
    env,
    "GET",
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new HttpError(response.status === 413 || response.status === 422 ? response.status : 502, "GitHub did not return the current file.");
  }
  const payload = await response.json() as { sha?: string };
  return payload.sha || null;
}

function imageKind(bytes: Uint8Array): { ext: string; type: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", type: "image/jpeg" };
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { ext: "png", type: "image/png" };
  }
  if (
    bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ext: "webp", type: "image/webp" };
  }
  return null;
}

export async function handleMedia(request: Request, env: Env, user: StaffUser): Promise<Response> {
  if (!configured(env)) {
    return json({ error: GITHUB_DOWN }, 503);
  }
  const claimed = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(claimed) && claimed > MEDIA_LIMIT + 20_000) {
    throw new HttpError(413, "Images must be 900 KB or less.");
  }
  const form = await request.formData();
  const alt = form.get("alt");
  const file = form.get("file");
  if (typeof alt !== "string" || alt.trim().length < 1 || [...alt.trim()].length > 200) {
    throw new HttpError(400, "Alt text is required.");
  }
  if (!(file instanceof File)) {
    throw new HttpError(400, "Choose an image.");
  }
  if (file.size > MEDIA_LIMIT) {
    throw new HttpError(413, "Images must be 900 KB or less.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) {
    throw new HttpError(400, "Use a JPEG, PNG, or WebP image.");
  }
  let repoPath = "";
  let sha: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    repoPath = `assets/media/${crypto.randomUUID()}.${kind.ext}`;
    sha = await fileSha(env, repoPath);
    if (!sha) {
      break;
    }
  }
  if (sha) {
    throw new HttpError(409, "That image path already exists.");
  }
  const response = await github(
    env,
    "PUT",
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`,
    {
      message: "Add an image for the Forever Memories Travel site.",
      content: bytesToBase64(bytes),
      branch: env.GITHUB_BRANCH,
    },
  );
  if (!response.ok) {
    throw new HttpError(response.status === 413 || response.status === 422 ? response.status : 502, "GitHub did not store the image.");
  }
  const payload = await response.json() as { content?: { sha?: string } };
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO media (id, repo_path, alt, bytes, content_type, git_sha, created_at, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  ).bind(crypto.randomUUID(), repoPath, alt.trim(), bytes.length, kind.type, payload.content?.sha || null, now, user.username).run();
  await recordAudit(env, user.username, "Uploaded an image", repoPath);
  return json({ path: repoPath, alt: alt.trim() }, 201);
}

export async function handlePublish(env: Env, user: StaffUser): Promise<Response> {
  if (!configured(env)) {
    return json({ error: GITHUB_DOWN }, 503);
  }
  const siteJson = await buildSiteJson(env);
  const path = "content/site.json";
  const sha = await fileSha(env, path);
  const response = await github(
    env,
    "PUT",
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`,
    {
      message: "Publish Forever Memories Travel content.",
      content: bytesToBase64(new TextEncoder().encode(siteJson)),
      branch: env.GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    },
  );
  if (!response.ok) {
    throw new HttpError(response.status === 413 || response.status === 422 ? response.status : 502, "GitHub did not publish the page.");
  }
  const payload = await response.json() as { commit?: { sha?: string } };
  const commit = payload.commit?.sha || "";
  const publishedAt = new Date().toISOString();
  await rememberPublish(env, user, commit, publishedAt);
  await recordAudit(env, user.username, "Published the site", commit);
  return json({
    commit,
    files: [path],
    note: "The public page can take a few minutes to show the new copy.",
  });
}
