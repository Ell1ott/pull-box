import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
const UPLOAD_TOKEN = Deno.env.get("UPLOAD_TOKEN") ?? "";

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: string | null; refreshToken?: string }> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth client credentials");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;
  const returnedRefresh = data.refresh_token ? (data.refresh_token as string) : undefined;
  return { accessToken: data.access_token as string, expiresAt, refreshToken: returnedRefresh };
}

function extractLinkCode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const directMatch = trimmed.match(/^[A-Za-z0-9]{4,12}$/);
  if (directMatch) return trimmed;
  const hashMatch = trimmed.match(/#\/jar\/([^/?#]+)/);
  if (hashMatch?.[1]) return hashMatch[1];
  const pathMatch = trimmed.match(/\/jar\/([^/?#]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  return null;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return false;
  return expiry <= Date.now() + 30_000;
}

async function uploadToDrive(accessToken: string, folderId: string, file: File): Promise<{ id: string; name: string }> {
  const boundary = `----driveupload${crypto.randomUUID()}`;
  const metadata = {
    name: file.name || `upload-${Date.now()}`,
    parents: [folderId],
    mimeType: file.type,
  };

  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = new Blob([pre, file, post]);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!uploadRes.ok) throw new Error(await uploadRes.text());
  return await uploadRes.json();
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const debug = (message: string, extra?: Record<string, unknown>) => {
    const payload = extra ? JSON.stringify(extra) : "";
    console.log(`[drive-upload][${requestId}] ${message}${payload ? " " + payload : ""}`);
  };

  debug("request:start", { method: req.method, url: req.url });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    debug("config:missing", { hasUrl: !!SUPABASE_URL, hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY });
    return new Response("Server misconfigured", { status: 500 });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-upload-token") ?? "";
  if (UPLOAD_TOKEN && token !== UPLOAD_TOKEN) {
    debug("auth:invalid-token");
    return new Response("Unauthorized", { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    debug("request:bad-content-type", { contentType });
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  const form = await req.formData();
  const rawCode = (form.get("code") || form.get("linkCode") || form.get("link"))?.toString() ?? "";
  const linkCode = extractLinkCode(rawCode);
  if (!linkCode) {
    debug("request:missing-link-code", { rawCode });
    return new Response("Missing link code", { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const single = form.get("file");
  if (single instanceof File) files.push(single);

  if (files.length === 0) {
    debug("request:no-files");
    return new Response("Missing file", { status: 400 });
  }
  if (files.some((f) => !f.type.startsWith("image/"))) {
    debug("request:non-image", { types: files.map((f) => f.type) });
    return new Response("Only images allowed", { status: 400 });
  }
  debug("request:files", { count: files.length, types: files.map((f) => f.type) });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: box, error: boxError } = await supabase
    .from("pull_boxes")
    .select("id, owner_id, drive_folder_id, expires_at, photo_count")
    .eq("link_code", linkCode)
    .single();

  if (boxError || !box) {
    debug("db:pull_box_not_found", { error: boxError?.message });
    return new Response("Invalid link", { status: 404 });
  }
  if (box.expires_at && Date.parse(box.expires_at) <= Date.now()) {
    debug("db:link_expired", { expiresAt: box.expires_at });
    return new Response("Link expired", { status: 410 });
  }
  debug("db:pull_box", { id: box.id, owner: box.owner_id, folder: box.drive_folder_id });

  const { data: tokenRow, error: tokenError } = await supabase
    .from("user_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", box.owner_id)
    .eq("provider", "google")
    .single();

  if (tokenError || (!tokenRow?.access_token && !tokenRow?.refresh_token)) {
    debug("db:token_missing", { error: tokenError?.message });
    return new Response("Owner not connected", { status: 403 });
  }
  debug("db:token", { hasRefresh: !!tokenRow.refresh_token, expiresAt: tokenRow.expires_at });

  let accessToken = (tokenRow.access_token as string) ?? "";
  const needsRefresh = !accessToken || isExpired(tokenRow.expires_at);
  if (tokenRow.refresh_token && needsRefresh) {
    try {
      debug("oauth:refresh_start");
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      accessToken = refreshed.accessToken;
      await supabase
        .from("user_oauth_tokens")
        .update({
          access_token: accessToken,
          refresh_token: refreshed.refreshToken ?? tokenRow.refresh_token,
          expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", box.owner_id)
        .eq("provider", "google");
      debug("oauth:refresh_success", { expiresAt: refreshed.expiresAt });
    } catch (err) {
      console.error("Token refresh failed", err);
      debug("oauth:refresh_failed", { message: err instanceof Error ? err.message : "unknown" });
      return new Response("Owner token refresh failed", { status: 502 });
    }
  }

  if (!accessToken) {
    debug("oauth:missing-access-token");
    return new Response("Owner not connected", { status: 403 });
  }

  try {
    const results = [] as Array<{ id: string; name: string }>; 
    for (const file of files) {
      debug("drive:upload_start", { name: file.name, type: file.type, size: file.size });
      const uploaded = await uploadToDrive(accessToken, box.drive_folder_id, file);
      debug("drive:upload_success", { id: uploaded.id, name: uploaded.name });
      results.push(uploaded);
    }
    if (results.length > 0) {
      const nextCount = (box.photo_count ?? 0) + results.length;
      const { error: countError } = await supabase
        .from("pull_boxes")
        .update({ photo_count: nextCount })
        .eq("id", box.id);
      if (countError) {
        debug("db:photo_count_update_failed", { message: countError.message });
      } else {
        debug("db:photo_count_updated", { photoCount: nextCount });
      }
    }
    return Response.json({ files: results });
  } catch (err) {
    console.error("Upload failed", err);
    return new Response(`Upload failed: ${err instanceof Error ? err.message : "unknown"}`, { status: 502 });
  }
});