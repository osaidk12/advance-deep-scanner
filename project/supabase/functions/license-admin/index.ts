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

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return segments.join("-");
}

async function supabaseAdmin(method: string, path: string, body?: unknown) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: method === "POST" ? "return=representation" : "return=representation",
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

    // GET ?action=list - List all keys
    if (req.method === "GET" && action === "list") {
      const keys = await supabaseAdmin("GET", "license_keys?order=created_at.desc&select=*");
      return json({ keys });
    }

    // POST - Generate new key(s)
    if (req.method === "POST") {
      const body = await req.json();
      const { count = 1, duration_days = 30, notes = "" } = body;

      if (duration_days < 1 || duration_days > 3650) {
        return json({ error: "Duration must be between 1 and 3650 days" }, 400);
      }

      if (count < 1 || count > 100) {
        return json({ error: "Count must be between 1 and 100" }, 400);
      }

      const newKeys: string[] = [];
      const records: Record<string, unknown>[] = [];

      for (let i = 0; i < count; i++) {
        const key = generateKey();
        newKeys.push(key);
        records.push({
          key,
          duration_days,
          notes,
          status: "inactive",
          created_by: "admin",
        });
      }

      const result = await supabaseAdmin("POST", "license_keys", records);

      if (result.error) {
        return json({ error: result.error.message || "Failed to create keys" }, 500);
      }

      return json({
        message: `Generated ${count} key(s)`,
        keys: newKeys,
        duration_days,
        created: result,
      });
    }

    // PUT - Revoke or update a key
    if (req.method === "PUT") {
      const body = await req.json();
      const { key_id, status: newStatus, notes } = body;

      if (!key_id) {
        return json({ error: "key_id is required" }, 400);
      }

      const updates: Record<string, unknown> = {};
      if (newStatus && ["revoked", "inactive"].includes(newStatus)) {
        updates.status = newStatus;
      }
      if (notes !== undefined) {
        updates.notes = notes;
      }

      const result = await supabaseAdmin(
        "PATCH",
        `license_keys?id=eq.${key_id}`,
        updates
      );

      return json({ message: "Key updated", result });
    }

    // DELETE - Delete a key
    if (req.method === "DELETE") {
      const key_id = url.searchParams.get("key_id");
      if (!key_id) {
        return json({ error: "key_id is required" }, 400);
      }
      const result = await supabaseAdmin("DELETE", `license_keys?id=eq.${key_id}`);
      return json({ message: "Key deleted", result });
    }

    return json({ error: "Invalid request" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
