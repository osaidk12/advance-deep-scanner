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

async function verifyToken(token: string): Promise<{ valid: boolean; admin_id?: string; username?: string }> {
  if (!token) return { valid: false };

  const sessions = await supabaseAdmin(
    "GET",
    `admin_sessions?token=eq.${token}&is_active=eq.true&select=admin_id,expires_at`
  );

  if (!sessions || sessions.length === 0) {
    return { valid: false };
  }

  const session = sessions[0];

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    await supabaseAdmin(
      "PATCH",
      `admin_sessions?token=eq.${token}`,
      { is_active: false }
    );
    return { valid: false };
  }

  // Get admin info
  const admins = await supabaseAdmin(
    "GET",
    `admin_users?id=eq.${session.admin_id}&is_active=eq.true&select=id,username`
  );

  if (!admins || admins.length === 0) {
    return { valid: false };
  }

  return { valid: true, admin_id: admins[0].id, username: admins[0].username };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return json({ error: "Authorization required" }, 401);
    }

    const verification = await verifyToken(token);

    if (!verification.valid) {
      return json({ error: "Invalid or expired session" }, 401);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET ?action=verify - Just verify the token
    if (req.method === "GET" && action === "verify") {
      return json({
        valid: true,
        admin: { id: verification.admin_id, username: verification.username },
      });
    }

    // GET ?action=stats - Get dashboard stats
    if (req.method === "GET" && action === "stats") {
      const keys = await supabaseAdmin("GET", "license_keys?select=status");
      const stats = {
        total: keys.length,
        inactive: keys.filter((k: { status: string }) => k.status === "inactive").length,
        active: keys.filter((k: { status: string }) => k.status === "active").length,
        expired: keys.filter((k: { status: string }) => k.status === "expired").length,
        revoked: keys.filter((k: { status: string }) => k.status === "revoked").length,
      };
      return json({ stats });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
