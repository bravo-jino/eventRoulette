import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-entry-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifyEntryToken(token: string) {
  const tokenSecret = Deno.env.get("ROULETTE_ENTRY_TOKEN_SECRET") || "";
  if (!tokenSecret) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = await sign(payload, tokenSecret);
  if (signature !== expectedSignature) return false;

  const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  return data.role === "participant" && Number(data.exp) > Math.floor(Date.now() / 1000);
}

function getClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("ROULETTE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role is not configured");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const isParticipant = await verifyEntryToken(request.headers.get("x-entry-token") || "");
  if (!isParticipant) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { action, payload = {} } = await request.json();
    if (action !== "addLog") return jsonResponse({ error: "Unknown action" }, 400);

    const label = String(payload.label || "").trim();
    if (!label) return jsonResponse({ error: "Missing label" }, 400);

    const { data, error } = await getClient()
      .from("roulette_logs")
      .insert({
        timestamp: payload.timestamp || new Date().toISOString(),
        label
      })
      .select("id,timestamp,label")
      .single();

    if (error) throw error;
    return jsonResponse(data);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Event API failed" }, 500);
  }
});
