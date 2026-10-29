import { STATS_DOWN, json } from "./http";
import type { Env } from "./types";

const PROPERTY = "properties/558909334";
const SECTION_ORDER = ["intro", "vacations", "parks", "cruises", "international", "steps", "plan"];

function b64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function accessToken(secret: string): Promise<string | null> {
  let account: { client_email?: string; private_key?: string };
  try {
    account = JSON.parse(secret) as { client_email?: string; private_key?: string };
  } catch {
    return null;
  }
  if (!account.client_email || !account.private_key) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  ));
  const assertion = `${unsigned}.${b64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json() as { access_token?: string };
  return payload.access_token || null;
}

async function runReport(token: string, body: unknown): Promise<Record<string, unknown> | null> {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/${PROPERTY}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return null;
  }
  return await response.json() as Record<string, unknown>;
}

function metric(report: Record<string, unknown> | null, index: number): number | null {
  const rows = report?.rows;
  if (!Array.isArray(rows) || !rows.length) {
    return null;
  }
  const first = rows[0] as { metricValues?: { value?: string }[] };
  const value = first.metricValues?.[index]?.value;
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function handleStatistics(env: Env): Promise<Response> {
  if (!env.GA_SERVICE_ACCOUNT_JSON) {
    return json({ error: "Statistics are not collected on the preview." }, 503);
  }
  const token = await accessToken(env.GA_SERVICE_ACCOUNT_JSON);
  if (!token) {
    return json({ error: STATS_DOWN }, 503);
  }
  const range = { startDate: "28daysAgo", endDate: "today" };
  const totals = await runReport(token, {
    dateRanges: [range],
    metrics: [{ name: "activeUsers" }, { name: "userEngagementDuration" }],
  });
  const sectionsReport = await runReport(token, {
    dateRanges: [range],
    dimensions: [{ name: "customEvent:section_name" }],
    metrics: [{ name: "activeUsers" }, { name: "customEvent:visible_msec" }],
  });
  if (!totals || !sectionsReport) {
    return json({ error: STATS_DOWN }, 503);
  }
  const byName = new Map<string, { users: number | null; visibleMsec: number | null }>();
  const rows = Array.isArray(sectionsReport.rows) ? sectionsReport.rows : [];
  for (const row of rows) {
    const item = row as {
      dimensionValues?: { value?: string }[];
      metricValues?: { value?: string }[];
    };
    const name = item.dimensionValues?.[0]?.value || "";
    if (!SECTION_ORDER.includes(name)) {
      continue;
    }
    const users = Number(item.metricValues?.[0]?.value);
    const visible = Number(item.metricValues?.[1]?.value);
    byName.set(name, {
      users: Number.isFinite(users) ? users : null,
      visibleMsec: Number.isFinite(visible) ? visible : null,
    });
  }
  let longest: string | null = null;
  let longestMs = -1;
  for (const name of SECTION_ORDER) {
    const visible = byName.get(name)?.visibleMsec;
    if (visible != null && visible > longestMs) {
      longest = name;
      longestMs = visible;
    }
  }
  return json({
    range: "Last 28 days",
    activeUsers: metric(totals, 0),
    engagementSeconds: metric(totals, 1),
    longestSection: longest,
    sections: SECTION_ORDER.map((name) => ({
      name,
      users: byName.get(name)?.users ?? null,
      visibleMsec: byName.get(name)?.visibleMsec ?? null,
    })),
  });
}
