import type { D1Prepared, Env } from "./types";

export const AUDIT_LIMIT = 500;

function clean(value: string, max: number): string {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

export function auditStatement(env: Env, actor: string, action: string, detail: string): D1Prepared {
  return env.DB.prepare(
    "INSERT INTO staff_audit (id, at, actor, action, detail) VALUES (?1, ?2, ?3, ?4, ?5)",
  ).bind(
    crypto.randomUUID(),
    new Date().toISOString(),
    clean(actor, 254) || "unknown",
    clean(action, 80),
    clean(detail, 300),
  );
}

export async function recordAudit(env: Env, actor: string, action: string, detail: string): Promise<void> {
  await auditStatement(env, actor, action, detail).run();
}

export async function listAudit(env: Env): Promise<{ at: string; actor: string; action: string; detail: string }[]> {
  const listed = await env.DB.prepare(
    "SELECT at, actor, action, detail FROM staff_audit ORDER BY at DESC LIMIT ?1",
  ).bind(AUDIT_LIMIT).all<{ at: string; actor: string; action: string; detail: string }>();
  return listed.results ?? [];
}
