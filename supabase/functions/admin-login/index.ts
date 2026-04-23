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

// Simple hash using Web Crypto API (SHA-256 based)
async function hashPassword(password: string, salt?: string): Promise<string> {
  const s = salt || crypto.randomUUID();
  const encoded = new TextEncoder().encode(s + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${s}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const encoded = new TextEncoder().encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex === hash;
}

function generateToken(): string {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Initialize default admin on first run
async function initializeDefaultAdmin() {
  const existing = await supabaseAdmin(
    "GET",
    "admin_users?username=eq.admin&select=id,username,password_hash"
  );

  if (existing && existing.length > 0) {
    // Check if placeholder password needs updating
    if (existing[0].password_hash === "PLACEHOLDER_CHANGE_IMMEDIATELY") {
      const hash = await hashPassword("VulnScan2024!");
      await supabaseAdmin(
        "PATCH",
        `admin_users?id=eq.${existing[0].id}`,
        { password_hash: hash }
      );
    }
    return;
  }

  // Create default admin
  const hash = await hashPassword("VulnScan2024!");
  await supabaseAdmin("POST", "admin_users", {
    username: "admin",
    password_hash: hash,
    is_active: true,
  });
}

// Run initialization
initializeDefaultAdmin();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // POST ?action=login - Admin login
    if (req.method === "POST" && action === "login") {
      const body = await req.json();
      const { username, password } = body;

      if (!username || !password) {
        return json({ error: "Username and password are required" }, 400);
      }

      // Rate limiting: check for too many recent failed attempts
      // (simplified - in production use a proper rate limiter)

      const admins = await supabaseAdmin(
        "GET",
        `admin_users?username=eq.${encodeURIComponent(username)}&is_active=eq.true&select=*`
      );

      if (!admins || admins.length === 0) {
        return json({ error: "Invalid credentials" }, 401);
      }

      const admin = admins[0];
      const valid = await verifyPassword(password, admin.password_hash);

      if (!valid) {
        return json({ error: "Invalid credentials" }, 401);
      }

      // Create session token
      const token = generateToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      await supabaseAdmin("POST", "admin_sessions", {
        admin_id: admin.id,
        token,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

      // Update last login
      await supabaseAdmin(
        "PATCH",
        `admin_users?id=eq.${admin.id}`,
        { last_login: now.toISOString() }
      );

      return json({
        success: true,
        token,
        expires_at: expiresAt.toISOString(),
        admin: { id: admin.id, username: admin.username },
      });
    }

    // POST ?action=logout - Admin logout
    if (req.method === "POST" && action === "logout") {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      if (token) {
        await supabaseAdmin(
          "PATCH",
          `admin_sessions?token=eq.${token}`,
          { is_active: false }
        );
      }

      return json({ success: true, message: "Logged out" });
    }

    // POST ?action=change-password - Change admin password
    if (req.method === "POST" && action === "change-password") {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      if (!token) {
        return json({ error: "Unauthorized" }, 401);
      }

      // Verify session
      const sessions = await supabaseAdmin(
        "GET",
        `admin_sessions?token=eq.${token}&is_active=eq.true&select=admin_id,expires_at`
      );

      if (!sessions || sessions.length === 0) {
        return json({ error: "Invalid session" }, 401);
      }

      const session = sessions[0];
      if (new Date(session.expires_at) < new Date()) {
        await supabaseAdmin(
          "PATCH",
          `admin_sessions?token=eq.${token}`,
          { is_active: false }
        );
        return json({ error: "Session expired" }, 401);
      }

      const body = await req.json();
      const { current_password, new_password } = body;

      if (!current_password || !new_password) {
        return json({ error: "Current and new password are required" }, 400);
      }

      if (new_password.length < 8) {
        return json({ error: "New password must be at least 8 characters" }, 400);
      }

      // Verify current password
      const admins = await supabaseAdmin(
        "GET",
        `admin_users?id=eq.${session.admin_id}&select=*`
      );

      if (!admins || admins.length === 0) {
        return json({ error: "Admin not found" }, 404);
      }

      const admin = admins[0];
      const valid = await verifyPassword(current_password, admin.password_hash);

      if (!valid) {
        return json({ error: "Current password is incorrect" }, 401);
      }

      const newHash = await hashPassword(new_password);
      await supabaseAdmin(
        "PATCH",
        `admin_users?id=eq.${admin.id}`,
        { password_hash: newHash }
      );

      return json({ success: true, message: "Password changed successfully" });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
