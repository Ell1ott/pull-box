import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return false;
  return expiry <= Date.now() + 30_000;
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tokenRow, error: tokenError } = await adminClient
    .from("user_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userData.user.id)
    .eq("provider", "google")
    .single();

  if (tokenError || (!tokenRow?.access_token && !tokenRow?.refresh_token)) {
    return new Response("Owner not connected", { status: 403, headers: corsHeaders });
  }

  let accessToken = (tokenRow.access_token as string) ?? "";
  const needsRefresh = !accessToken || isExpired(tokenRow.expires_at ?? null);

  if (tokenRow.refresh_token && needsRefresh) {
    try {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token as string);
      accessToken = refreshed.accessToken;
      await adminClient
        .from("user_oauth_tokens")
        .update({
          access_token: accessToken,
          refresh_token: refreshed.refreshToken ?? tokenRow.refresh_token,
          expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userData.user.id)
        .eq("provider", "google");

      return Response.json(
        { accessToken, expiresAt: refreshed.expiresAt },
        { headers: corsHeaders },
      );
    } catch (err) {
      return new Response(
        `Token refresh failed: ${err instanceof Error ? err.message : "unknown"}`,
        { status: 502, headers: corsHeaders },
      );
    }
  }

  if (!accessToken) {
    return new Response("Owner not connected", { status: 403, headers: corsHeaders });
  }

  return Response.json(
    { accessToken, expiresAt: tokenRow.expires_at ?? null },
    { headers: corsHeaders },
  );
});
