import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveDomain(hostname: string): Promise<string | null> {
  try {
    const records = await Deno.resolveDns(hostname, "A");
    return records.length > 0 ? records[0] : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { domain } = body;

    if (!domain) {
      return json({ error: "Domain is required" }, 400);
    }

    const cleanDomain = domain.trim().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanDomain);
    if (isIP) {
      return json({ domain: cleanDomain, ip: cleanDomain });
    }

    const ip = await resolveDomain(cleanDomain);

    if (ip) {
      return json({ domain: cleanDomain, ip });
    } else {
      return json({ error: "Could not resolve domain" }, 404);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
