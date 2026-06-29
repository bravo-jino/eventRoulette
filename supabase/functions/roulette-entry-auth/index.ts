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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const entryCode = Deno.env.get("ROULETTE_ENTRY_CODE") || "";
  const tokenSecret = Deno.env.get("ROULETTE_ENTRY_TOKEN_SECRET") || "";

  if (!entryCode || !tokenSecret) {
    return jsonResponse({ error: "Entry auth is not configured" }, 500);
  }

  const body = await request.json().catch(() => ({}));
  if (String(body.code || "") !== entryCode) {
    return jsonResponse({ error: "Invalid entry code" }, 401);
  }

  const expiresIn = 12 * 60 * 60;
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    role: "participant",
    exp: Math.floor(Date.now() / 1000) + expiresIn
  })));
  const signature = await sign(payload, tokenSecret);

  return jsonResponse({
    token: `${payload}.${signature}`,
    expiresIn
  });
});
