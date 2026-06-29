import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const defaultConfig = {
  eventTitle: "룰렛 이벤트",
  spinButtonText: "룰렛 돌리기",
  titleImage: "",
  loggingEnabled: true,
  items: [
    { label: "커피 기프티콘", weight: 2, probability: null, color: "#fff3a3" },
    { label: "햄버거 세트", weight: 1, probability: null, color: "#ffffff" },
    { label: "과자 세트", weight: 2, probability: null, color: "#6ee7f9" },
    { label: "꽝", weight: 1, probability: null, color: "#ffe0f0" },
    { label: "음료 기프티콘", weight: 1, probability: null, color: "#b7f7c4" },
    { label: "꽝", weight: 1, probability: null, color: "#ffd59e" },
    { label: "리유저블 컵", weight: 1, probability: null, color: "#bfdbfe" },
    { label: "쿠폰", weight: 1, probability: null, color: "#fecaca" }
  ]
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

async function verifyAdminToken(token: string) {
  const tokenSecret = Deno.env.get("ROULETTE_ADMIN_TOKEN_SECRET") || "";
  if (!tokenSecret) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = await sign(payload, tokenSecret);
  if (signature !== expectedSignature) return false;

  const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  return data.role === "admin" && Number(data.exp) > Math.floor(Date.now() / 1000);
}

function getClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role is not configured");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

async function saveConfig(config: unknown) {
  const { data, error } = await getClient()
    .from("roulette_config")
    .upsert({
      id: "active",
      data: config || defaultConfig,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" })
    .select("data")
    .single();

  if (error) throw error;
  return data.data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const isAdmin = await verifyAdminToken(request.headers.get("x-admin-token") || "");
  if (!isAdmin) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { action, payload = {} } = await request.json();
    const client = getClient();

    if (action === "saveConfig") {
      return jsonResponse(await saveConfig(payload.config));
    }

    if (action === "getLogs") {
      const { data, error } = await client
        .from("roulette_logs")
        .select("id,timestamp,label")
        .order("id", { ascending: true });
      if (error) throw error;
      return jsonResponse(data || []);
    }

    if (action === "exportData") {
      const configResult = await client
        .from("roulette_config")
        .select("data")
        .eq("id", "active")
        .maybeSingle();
      if (configResult.error) throw configResult.error;

      const logsResult = await client
        .from("roulette_logs")
        .select("id,timestamp,label")
        .order("id", { ascending: true });
      if (logsResult.error) throw logsResult.error;

      return jsonResponse({
        version: 1,
        exportedAt: new Date().toISOString(),
        config: configResult.data?.data || defaultConfig,
        logs: logsResult.data || []
      });
    }

    if (action === "resetConfig") {
      return jsonResponse(await saveConfig(defaultConfig));
    }

    if (action === "clearLogs") {
      const { error } = await client.from("roulette_logs").delete().not("id", "is", null);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "deleteLog") {
      const { error } = await client.from("roulette_logs").delete().eq("id", Number(payload.id));
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "importData") {
      const data = payload.data || {};
      await saveConfig(data.config || defaultConfig);

      const clearResult = await client.from("roulette_logs").delete().not("id", "is", null);
      if (clearResult.error) throw clearResult.error;

      const logs = Array.isArray(data.logs) ? data.logs : [];
      if (logs.length > 0) {
        const insertResult = await client.from("roulette_logs").insert(logs
          .filter((entry) => entry && entry.label)
          .map((entry) => ({
            timestamp: entry.timestamp || new Date().toISOString(),
            label: entry.label
          })));
        if (insertResult.error) throw insertResult.error;
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Admin API failed" }, 500);
  }
});
