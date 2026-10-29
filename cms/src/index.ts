import { handleListActivity, handleListStaff, handleStaffAction, purgeDeletedStaff } from "./accounts";
import { handleCreateStaff, handleLogin, handleLogout, handlePassword, handleSetup, measureHash, requireUser } from "./auth";
import { cormorantGaramond, nunitoSans400, nunitoSans700, nunitoSansItalic } from "./fontData";
import { adminCss, adminHtml, adminJs } from "./adminPage";
import { createDocument, deleteDocument, listDocuments, publicDocument, updateDocument } from "./documents";
import { handleMedia, handlePublish } from "./github";
import { HttpError, json, readJson, text, withHeaders } from "./http";
import { deleteStaffNote, getInquiry, listInquiries, patchInquiry } from "./inquiries";
import { handleStatistics } from "./statistics";
import type { Env } from "./types";

function usedSession(pathname: string): boolean {
  return pathname !== "/health";
}

const FONTS: Record<string, ArrayBuffer> = {
  "cormorant-garamond-500.woff2": cormorantGaramond,
  "nunito-sans-400.woff2": nunitoSans400,
  "nunito-sans-700.woff2": nunitoSans700,
  "nunito-sans-400-italic.woff2": nunitoSansItalic,
};

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/health") {
    return json({ ok: true });
  }
  if (method === "GET" && (path === "/admin" || path === "/admin/")) {
    return text(adminHtml, 200, "text/html; charset=utf-8");
  }
  if (method === "GET" && path === "/admin.css") {
    return text(adminCss, 200, "text/css; charset=utf-8");
  }
  if (method === "GET" && path === "/admin.js") {
    return text(adminJs, 200, "text/javascript; charset=utf-8");
  }
  if (method === "GET" && path.startsWith("/admin/fonts/")) {
    const font = FONTS[path.slice("/admin/fonts/".length)];
    if (!font) {
      throw new HttpError(404, "not_found");
    }
    return new Response(font, {
      headers: {
        "Content-Type": "font/woff2",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
  if (method === "POST" && path === "/dev/hash-measure") {
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      throw new HttpError(404, "not_found");
    }
    if (!env.PASSWORD_PEPPER) {
      throw new HttpError(503, "Sign-in is not configured.");
    }
    return json(await measureHash(env.PASSWORD_PEPPER));
  }
  if (method === "POST" && path === "/setup") {
    return handleSetup(request, env);
  }
  if (method === "POST" && path === "/login") {
    await purgeDeletedStaff(env);
    return handleLogin(request, env);
  }
  if (method === "POST" && path === "/logout") {
    return handleLogout(request, env);
  }

  const user = await requireUser(request, env);
  if (method === "GET" && path === "/api/me") {
    return json({ username: user.username, must_change_password: user.mustChangePassword });
  }
  if (user.mustChangePassword && !(method === "POST" && path === "/api/password")) {
    throw new HttpError(403, "Change your password before continuing.");
  }
  if (method === "POST" && path === "/api/password") {
    return handlePassword(request, env, user);
  }
  if (method === "GET" && path === "/api/staff") {
    return handleListStaff(env, user);
  }
  if (method === "GET" && path === "/api/staff/activity") {
    return handleListActivity(env);
  }
  if (method === "POST" && path === "/api/staff") {
    return handleCreateStaff(request, env, user);
  }
  const staffAction = /^\/api\/staff\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(reset|disable|enable|delete|restore)$/i.exec(path);
  if (staffAction && method === "POST") {
    return handleStaffAction(env, user, staffAction[1], staffAction[2].toLowerCase());
  }
  if (method === "GET" && path === "/api/documents") {
    const rows = await listDocuments(env);
    return json({ documents: rows.map(publicDocument) });
  }
  if (method === "POST" && path === "/api/documents") {
    return json(await createDocument(env, user, await readJson(request)), 201);
  }
  if (path.startsWith("/api/documents/")) {
    const id = decodeURIComponent(path.slice("/api/documents/".length));
    if (method === "PUT") {
      return json(await updateDocument(env, user, id, await readJson(request)));
    }
    if (method === "DELETE") {
      return deleteDocument(env, user, id);
    }
  }
  if (method === "POST" && path === "/api/media") {
    return handleMedia(request, env, user);
  }
  if (method === "POST" && path === "/api/publish") {
    return handlePublish(env, user);
  }
  if (method === "GET" && path === "/api/statistics") {
    return handleStatistics(env);
  }
  if (method === "GET" && path === "/api/inquiries") {
    return listInquiries(env);
  }
  const noteMatch = path.match(/^\/api\/inquiries\/([^/]+)\/notes\/([^/]+)$/);
  if (noteMatch && method === "DELETE") {
    return deleteStaffNote(env, decodeURIComponent(noteMatch[1]), decodeURIComponent(noteMatch[2]), user.username);
  }
  if (path.startsWith("/api/inquiries/")) {
    const id = decodeURIComponent(path.slice("/api/inquiries/".length));
    if (method === "GET") {
      return getInquiry(env, id);
    }
    if (method === "PATCH") {
      return patchInquiry(request, env, id, user.username);
    }
  }
  throw new HttpError(404, "not_found");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const session = url.pathname !== "/health"
      && url.pathname !== "/dev/hash-measure"
      && !url.pathname.startsWith("/admin/fonts/");
    try {
      const response = await route(request, env, url);
      const html = (response.headers.get("Content-Type") || "").includes("text/html");
      return withHeaders(response, usedSession(url.pathname) && session, html);
    } catch (error) {
      if (error instanceof HttpError) {
        return withHeaders(json({ error: error.message }, error.status), true, false);
      }
      return withHeaders(json({ error: "The admin hit an error." }, 500), true, false);
    }
  },
};
