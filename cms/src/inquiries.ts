import { recordAudit } from "./audit";
import { HttpError, INQUIRY_DOWN, isRecord, json, readJson } from "./http";
import type { Env } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["new", "contacted", "planning", "booked", "closed", "spam"];

function ready(env: Env): boolean {
  return Boolean(env.INQUIRY_STAFF_TOKEN && env.INQUIRY_API_ORIGIN);
}

async function callLaptop(env: Env, path: string, init?: RequestInit): Promise<Response> {
  if (!ready(env)) {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  const origin = env.INQUIRY_API_ORIGIN!.replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${env.INQUIRY_STAFF_TOKEN}`,
        Accept: "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  if (response.status >= 300 && response.status < 400) {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  if (response.status === 401 || response.status === 403) {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  return response;
}

export async function listInquiries(env: Env): Promise<Response> {
  const response = await callLaptop(env, "/staff/inquiries");
  if (response.status === 503) {
    return response;
  }
  if (!response.ok) {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  return response;
}

export async function getInquiry(env: Env, id: string): Promise<Response> {
  if (!UUID.test(id)) {
    throw new HttpError(404, "That trip request was not found.");
  }
  const response = await callLaptop(env, `/staff/inquiries/${id}`);
  if (response.status === 503) {
    return response;
  }
  if (response.status === 404) {
    return json({ error: "That trip request was not found." }, 404);
  }
  if (!response.ok) {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  return response;
}

export async function patchInquiry(request: Request, env: Env, id: string, username: string): Promise<Response> {
  if (!UUID.test(id)) {
    throw new HttpError(404, "That trip request was not found.");
  }
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.status !== "string" || typeof body.staff_notes !== "string") {
    throw new HttpError(400, "Send a status and staff notes.");
  }
  if (!STATUSES.includes(body.status) || [...body.staff_notes].length > 4000) {
    throw new HttpError(400, "Check the status and the staff notes.");
  }
  const extra = Object.keys(body).filter((key) => key !== "status" && key !== "staff_notes");
  if (extra.length) {
    throw new HttpError(400, "Only status and staff notes can be saved.");
  }
  const response = await callLaptop(env, `/staff/inquiries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: body.status, staff_notes: body.staff_notes, author: username }),
  });
  if (response.status === 503) {
    return response;
  }
  if (response.status === 404) {
    return json({ error: "That trip request was not found." }, 404);
  }
  if (!response.ok) {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  const payload = await response.json() as unknown;
  if (!isRecord(payload)) {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  delete payload.client_ip;
  delete payload.idempotency_key;
  delete payload.payload_fingerprint;
  await recordAudit(env, username, "Saved an inquiry", `${id} ${body.status}`);
  return json(payload);
}

export async function deleteStaffNote(env: Env, inquiryId: string, noteId: string, username: string): Promise<Response> {
  if (!UUID.test(inquiryId) || !UUID.test(noteId)) {
    throw new HttpError(404, "That staff note was not found.");
  }
  const response = await callLaptop(env, `/staff/inquiries/${inquiryId}/notes/${noteId}`, {
    method: "DELETE",
  });
  if (response.status === 503) {
    return response;
  }
  if (response.status === 404) {
    return json({ error: "That staff note was not found." }, 404);
  }
  if (!response.ok) {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  const payload = await response.json() as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.staff_note_entries)) {
    return json({ error: INQUIRY_DOWN }, 503);
  }
  delete payload.client_ip;
  delete payload.idempotency_key;
  delete payload.payload_fingerprint;
  await recordAudit(env, username, "Deleted a staff note", `${inquiryId} ${noteId}`);
  return json(payload);
}
