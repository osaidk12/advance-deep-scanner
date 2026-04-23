import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function supabaseAdmin(method: string, path: string, body?: unknown) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET ?action=check&key=XXXX-XXXX-XXXX-XXXX - Check if a key is valid
    if (req.method === "GET" && action === "check") {
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "Key is required" }, 400);

      const result = await supabaseAdmin(
        "GET",
        `license_keys?key=eq.${key}&select=id,key,status,duration_days,activated_at,expires_at,activated_by`
      );

      if (!result || result.length === 0) {
        return json({ valid: false, error: "Key not found" }, 404);
      }

      const license = result[0];

      // Check if expired
      if (license.status === "active" && license.expires_at) {
        const expiresAt = new Date(license.expires_at);
        if (expiresAt < new Date()) {
          // Mark as expired
          await supabaseAdmin(
            "PATCH",
            `license_keys?id=eq.${license.id}`,
            { status: "expired" }
          );
          return json({ valid: false, error: "Key has expired", status: "expired" });
        }
      }

      if (license.status === "revoked") {
        return json({ valid: false, error: "Key has been revoked", status: "revoked" });
      }

      if (license.status === "inactive") {
        return json({
          valid: false,
          error: "Key has not been activated yet",
          status: "inactive",
          key_id: license.id,
          duration_days: license.duration_days,
        });
      }

      if (license.status === "active") {
        const expiresAt = new Date(license.expires_at);
        const now = new Date();
        const remainingMs = expiresAt.getTime() - now.getTime();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

        return json({
          valid: true,
          status: "active",
          key_id: license.id,
          expires_at: license.expires_at,
          remaining_days: remainingDays,
        });
      }

      return json({ valid: false, error: "Unknown key status", status: license.status });
    }

    // POST - Activate a key
    if (req.method === "POST") {
      const body = await req.json();
      const { key, user_id, device_fingerprint = "" } = body;

      if (!key) return json({ error: "Key is required" }, 400);
      if (!user_id) return json({ error: "user_id is required" }, 400);

      // Look up the key
      const result = await supabaseAdmin(
        "GET",
        `license_keys?key=eq.${key}&select=*`
      );

      if (!result || result.length === 0) {
        return json({ error: "Invalid license key" }, 404);
      }

      const license = result[0];

      if (license.status === "revoked") {
        return json({ error: "This key has been revoked" }, 403);
      }

      if (license.status === "expired") {
        return json({ error: "This key has expired" }, 403);
      }

      if (license.status === "active") {
        // Check if this user already activated it
        if (license.activated_by === user_id) {
          const expiresAt = new Date(license.expires_at);
          const now = new Date();
          if (expiresAt > now) {
            const remainingDays = Math.ceil(
              (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            return json({
              message: "Key already activated by you",
              valid: true,
              expires_at: license.expires_at,
              remaining_days: remainingDays,
            });
          }
        }
        return json({ error: "Key already activated by another user" }, 403);
      }

      // Activate the key
      const now = new Date();
      const expiresAt = new Date(now.getTime() + license.duration_days * 24 * 60 * 60 * 1000);

      await supabaseAdmin(
        "PATCH",
        `license_keys?id=eq.${license.id}`,
        {
          status: "active",
          activated_by: user_id,
          activated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        }
      );

      // Create activation record
      await supabaseAdmin("POST", "license_activations", [
        {
          license_key_id: license.id,
          user_id,
          device_fingerprint,
          activated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true,
        },
      ]);

      return json({
        message: "License key activated successfully",
        valid: true,
        expires_at: expiresAt.toISOString(),
        remaining_days: license.duration_days,
      });
    }

    return json({ error: "Invalid request" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
