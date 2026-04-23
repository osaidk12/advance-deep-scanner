import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Finding { type: string; severity: string; message?: string; value?: string; location?: string; payload?: string; evidence?: string; recommendation?: string; header?: string; cookie_name?: string; issues?: string[]; file?: string; url?: string; method?: string; status_code?: number; paths?: string[]; port?: number; service?: string; status?: string; [key: string]: unknown; }
interface ScanCategory { key: string; label: string; findings: Finding[]; }
interface CrawlData { urls: string[]; forms: { action: string; method: string; inputs: string[] }[]; params: { url: string; params: string[] }[]; html: string; }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function testPort(host: string, port: number, timeout = 1500): Promise<"open" | "closed" | "filtered"> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("filtered"), timeout);
    Deno.connect({ hostname: host, port, transport: "tcp" })
      .then((conn) => {
        clearTimeout(timer);
        try { conn.close(); } catch { /* ignore */ }
        resolve("open");
      })
      .catch((e) => {
        clearTimeout(timer);
        const msg = String(e).toLowerCase();
        if (msg.includes("refused") || msg.includes("reset") || msg.includes("denied")) {
          resolve("closed");
        } else {
          resolve("filtered");
        }
      });
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
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json();
    const { url, group, crawl_data } = body;
    if (!url) return json({ error: "URL is required" }, 400);

    let targetUrl = url.trim();
    const stripped = targetUrl.replace(/^https?:\/\//, "");
    let resolvedIp: string | null = null;

    if (!/^https?:\/\//i.test(targetUrl)) {
      const isIP = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(stripped);
      if (isIP) {
        const [host] = stripped.split(":");
        targetUrl = `http://${stripped}`;
        const httpsTest = await safeFetch(`https://${stripped}`, {}, 5000);
        if (httpsTest) {
          targetUrl = `https://${stripped}`;
        }
        resolvedIp = host;
      } else {
        targetUrl = `https://${targetUrl}`;
        const [hostname] = stripped.split(/[:/]/);
        resolvedIp = await resolveDomain(hostname);
      }
    } else {
      try {
        const parsedUrl = new URL(targetUrl);
        const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(parsedUrl.hostname);
        if (isIP) {
          resolvedIp = parsedUrl.hostname;
        } else {
          resolvedIp = await resolveDomain(parsedUrl.hostname);
        }
      } catch { /* ignore */ }
    }

    let categories: ScanCategory[] = [];
    let returnCrawlData: CrawlData | undefined;

    switch (group) {
      case "recon": categories = await runRecon(targetUrl); break;
      case "discovery": { const r = await runDiscovery(targetUrl); categories = r.categories; returnCrawlData = r.crawlData; break; }
      case "injection": categories = await runInjection(targetUrl, crawl_data); break;
      case "advanced": categories = await runAdvanced(targetUrl, crawl_data); break;
      case "files": categories = await runFiles(targetUrl, crawl_data); break;
      case "network": categories = await runNetwork(targetUrl); break;
      default: categories = await runRecon(targetUrl); break;
    }

    return json({ target: targetUrl, resolved_ip: resolvedIp, scan_mode: group === "network" ? "network" : (group === "recon" ? "light" : "deep"), timestamp: new Date().toISOString(), categories: categories.filter(c => c.findings.length > 0), crawl_data: returnCrawlData });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

async function safeFetch(url: string, opts: RequestInit = {}, timeout = 6000): Promise<Response | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    const r = await fetch(url, { ...opts, signal: c.signal, redirect: "manual" });
    clearTimeout(t);
    return r;
  } catch { return null; }
}

async function getText(url: string, timeout = 6000): Promise<string> {
  const r = await safeFetch(url, {}, timeout);
  if (!r || r.status !== 200) return "";
  return r.text().catch(() => "");
}

function extractLinks(html: string, base: string): string[] {
  const links: string[] = [];
  const regex = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    try {
      const u = new URL(m[1], base);
      if (u.origin === new URL(base).origin && !u.pathname.match(/\.(css|js|png|jpg|gif|svg|ico|woff|ttf|eot)$/i)) {
        links.push(u.href);
      }
    } catch { /* skip */ }
  }
  return [...new Set(links)].slice(0, 30);
}

function extractForms(html: string, base: string): CrawlData["forms"] {
  const forms: CrawlData["forms"] = [];
  const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let fm;
  while ((fm = formRegex.exec(html)) !== null) {
    const tag = fm[0];
    const actionMatch = tag.match(/action=["']([^"']*)["']/i);
    const methodMatch = tag.match(/method=["']([^"']*)["']/i);
    let action = actionMatch ? actionMatch[1] : "";
    try { action = new URL(action, base).href; } catch { action = base; }
    const method = (methodMatch?.[1] || "GET").toUpperCase();
    const inputs: string[] = [];
    const inputRegex = /name=["']([^"']+)["']/gi;
    let im;
    while ((im = inputRegex.exec(fm[1])) !== null) inputs.push(im[1]);
    if (inputs.length > 0) forms.push({ action, method, inputs });
  }
  return forms;
}

function extractParams(urls: string[]): CrawlData["params"] {
  const result: CrawlData["params"] = [];
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      const params = [...parsed.searchParams.keys()];
      if (params.length > 0) result.push({ url: u, params });
    } catch { /* skip */ }
  }
  return result;
}

// ── RECON GROUP (11 tests) ──

async function runRecon(targetUrl: string): Promise<ScanCategory[]> {
  const mainResp = await safeFetch(targetUrl);
  const categories: ScanCategory[] = [];
  categories.push(testFingerprint(mainResp));
  categories.push(testSecurityHeaders(mainResp));
  categories.push(testCookies(mainResp));
  categories.push(testSsl(targetUrl));
  categories.push(testKnownVulns(mainResp));
  const [robots, clientAccess, dirList, httpMethods, secTxt, cors] = await Promise.all([
    testRobotsTxt(targetUrl), testClientAccessPolicy(targetUrl), testDirectoryListing(targetUrl),
    testHttpMethods(targetUrl), testSecurityTxt(targetUrl), testCorsConfig(targetUrl, mainResp),
  ]);
  categories.push(robots, clientAccess, dirList, httpMethods, secTxt, cors);
  return categories;
}

function testFingerprint(resp: Response | null): ScanCategory {
  const f: Finding[] = [];
  if (!resp) { f.push({ type: "Connection Failed", severity: "HIGH", message: "Could not connect to the target server" }); return { key: "web_server_fingerprint", label: "Web Server Fingerprint", findings: f }; }
  const server = resp.headers.get("server");
  if (server) f.push({ type: "Server Software", severity: "INFO", value: server, message: `Web server identified: ${server}` });
  else f.push({ type: "Server Hidden", severity: "GOOD", message: "Server header is not exposed" });
  const pb = resp.headers.get("x-powered-by");
  if (pb) f.push({ type: "Technology Stack", severity: "LOW", value: pb, message: `Technology disclosed via X-Powered-By: ${pb}`, recommendation: "Remove X-Powered-By header" });
  const asp = resp.headers.get("x-aspnet-version");
  if (asp) f.push({ type: "ASP.NET Version", severity: "LOW", value: asp, message: `ASP.NET version: ${asp}`, recommendation: "Remove X-AspNet-Version header" });
  const gen = resp.headers.get("x-generator");
  if (gen) f.push({ type: "Generator", severity: "LOW", value: gen, message: `Generator: ${gen}` });
  return { key: "web_server_fingerprint", label: "Web Server Fingerprint", findings: f };
}

function testSecurityHeaders(resp: Response | null): ScanCategory {
  const f: Finding[] = [];
  if (!resp) return { key: "http_headers_security", label: "HTTP Security Headers", findings: f };
  const checks: [string, string, string][] = [
    ["Strict-Transport-Security", "HSTS not implemented - browsers won't enforce HTTPS", "Add Strict-Transport-Security header with max-age >= 31536000"],
    ["X-Frame-Options", "Clickjacking protection missing", "Add X-Frame-Options: DENY or SAMEORIGIN"],
    ["X-Content-Type-Options", "MIME-sniffing protection missing", "Add X-Content-Type-Options: nosniff"],
    ["Content-Security-Policy", "Content Security Policy not configured", "Implement a strict Content-Security-Policy"],
    ["X-XSS-Protection", "XSS filter not explicitly enabled", "Add X-XSS-Protection: 1; mode=block"],
    ["Referrer-Policy", "Referrer policy not set", "Add Referrer-Policy: strict-origin-when-cross-origin"],
    ["Permissions-Policy", "Permissions policy missing", "Add Permissions-Policy to restrict browser features"],
  ];
  for (const [h, miss, rec] of checks) {
    const v = resp.headers.get(h);
    if (v) f.push({ type: h, severity: "GOOD", value: v, message: `${h} is configured: ${v.substring(0, 80)}` });
    else f.push({ type: `Missing ${h}`, severity: "MEDIUM", message: miss, recommendation: rec });
  }
  return { key: "http_headers_security", label: "HTTP Security Headers", findings: f };
}

function testCookies(resp: Response | null): ScanCategory {
  const f: Finding[] = [];
  if (!resp) return { key: "cookie_security", label: "Cookie Security", findings: f };
  const cookies = resp.headers.getSetCookie?.() || [];
  if (cookies.length === 0) { f.push({ type: "No Cookies", severity: "INFO", message: "No cookies set on landing page" }); return { key: "cookie_security", label: "Cookie Security", findings: f }; }
  for (const raw of cookies) {
    const name = raw.split("=")[0]?.trim() || "unknown";
    const lc = raw.toLowerCase();
    const issues: string[] = [];
    if (!lc.includes("secure")) issues.push("Missing Secure flag");
    if (!lc.includes("httponly")) issues.push("Missing HttpOnly flag");
    if (!lc.includes("samesite")) issues.push("Missing SameSite attribute");
    if (issues.length > 0) f.push({ type: "Insecure Cookie", severity: "MEDIUM", cookie_name: name, issues, message: `Cookie '${name}': ${issues.join(", ")}`, recommendation: "Set Secure, HttpOnly, and SameSite on all cookies" });
    else f.push({ type: "Secure Cookie", severity: "GOOD", cookie_name: name, message: `Cookie '${name}' is properly secured` });
  }
  return { key: "cookie_security", label: "Cookie Security", findings: f };
}

function testSsl(targetUrl: string): ScanCategory {
  const f: Finding[] = [];
  if (targetUrl.startsWith("https://")) f.push({ type: "HTTPS Enabled", severity: "GOOD", message: "Site uses HTTPS encryption" });
  else f.push({ type: "No HTTPS", severity: "HIGH", message: "Site does not use HTTPS - data transmitted in cleartext", recommendation: "Enable HTTPS with a valid TLS certificate" });
  return { key: "ssl_certificate", label: "SSL/TLS Certificate", findings: f };
}

function testKnownVulns(resp: Response | null): ScanCategory {
  const f: Finding[] = [];
  if (!resp) return { key: "known_vulnerabilities", label: "Known Vulnerabilities", findings: f };
  const server = (resp.headers.get("server") || "").toLowerCase();
  const vulns: [string, string, string][] = [
    ["apache/2.4.49", "CVE-2021-41773", "Path Traversal - upgrade Apache immediately"],
    ["apache/2.4.50", "CVE-2021-42013", "Path Traversal RCE - upgrade Apache immediately"],
    ["apache/2.2", "EOL", "Apache 2.2.x is end of life with multiple CVEs"],
    ["nginx/1.18", "Multiple CVEs", "nginx 1.18 has known vulnerabilities - upgrade"],
    ["nginx/1.16", "Multiple CVEs", "nginx 1.16 has known vulnerabilities - upgrade"],
    ["microsoft-iis/6", "Multiple CVEs", "IIS 6.x is end of life - critical vulnerabilities"],
    ["microsoft-iis/7.0", "Multiple CVEs", "IIS 7.0 has known vulnerabilities"],
    ["microsoft-iis/7.5", "Multiple CVEs", "IIS 7.5 has known vulnerabilities"],
    ["openssl/1.0", "Multiple CVEs", "OpenSSL 1.0.x is end of life"],
    ["php/5.", "EOL", "PHP 5.x is end of life with many security issues"],
    ["php/7.0", "EOL", "PHP 7.0 is end of life"],
    ["php/7.1", "EOL", "PHP 7.1 is end of life"],
  ];
  let found = false;
  const pb = (resp.headers.get("x-powered-by") || "").toLowerCase();
  const combined = server + " " + pb;
  for (const [sig, cve, msg] of vulns) {
    if (combined.includes(sig)) { f.push({ type: "Known Vulnerability", severity: "CRITICAL", value: cve, message: msg, recommendation: "Upgrade to the latest stable version" }); found = true; }
  }
  if (!found) f.push({ type: "Version Check", severity: "INFO", message: "No known vulnerable versions detected from headers" });
  return { key: "known_vulnerabilities", label: "Known Vulnerabilities", findings: f };
}

async function testRobotsTxt(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const text = await getText(`${base}/robots.txt`);
  if (text && text.length > 5) {
    const paths: string[] = [];
    for (const line of text.split("\n")) { const m = line.match(/(?:Dis)?allow:\s*(.+)/i); if (m) { const p = m[1].trim(); if (p && p !== "/") paths.push(p); } }
    if (paths.length > 0) f.push({ type: "robots.txt Found", severity: "INFO", paths: paths.slice(0, 20), message: `${paths.length} paths found in robots.txt` });
    else f.push({ type: "robots.txt", severity: "INFO", message: "robots.txt exists with no interesting paths" });
  } else f.push({ type: "robots.txt", severity: "INFO", message: "robots.txt not found" });
  return { key: "robots_txt", label: "Robots.txt Analysis", findings: f };
}

async function testClientAccessPolicy(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const [cd, cap] = await Promise.all([getText(`${base}/crossdomain.xml`), getText(`${base}/clientaccesspolicy.xml`)]);
  if (cd && cd.includes("<cross-domain-policy")) {
    if (cd.includes('domain="*"')) f.push({ type: "Permissive crossdomain.xml", severity: "MEDIUM", message: "crossdomain.xml allows access from any domain", recommendation: "Restrict allowed domains in crossdomain.xml" });
    else f.push({ type: "crossdomain.xml", severity: "INFO", message: "crossdomain.xml exists with domain restrictions" });
  }
  if (cap && cap.includes("<access-policy")) {
    if (cap.includes('uri="*"') || cap.includes('domain="*"')) f.push({ type: "Permissive clientaccesspolicy.xml", severity: "MEDIUM", message: "clientaccesspolicy.xml allows broad access", recommendation: "Restrict client access policy" });
    else f.push({ type: "clientaccesspolicy.xml", severity: "INFO", message: "clientaccesspolicy.xml exists" });
  }
  return { key: "client_access_policy", label: "Client Access Policy", findings: f };
}

async function testDirectoryListing(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const dirs = ["/images/", "/js/", "/css/", "/uploads/", "/assets/", "/static/", "/files/", "/media/", "/includes/", "/lib/"];
  const indicators = ["Index of", "Directory listing", "Parent Directory", "[DIR]", "<title>Index of"];
  const checks = dirs.map(async d => {
    const t = await getText(`${base}${d}`, 4000);
    if (t && indicators.some(i => t.includes(i))) f.push({ type: "Directory Listing", severity: "MEDIUM", url: `${base}${d}`, message: `Directory listing enabled at ${d}`, recommendation: "Disable directory listing" });
  });
  await Promise.all(checks);
  return { key: "directory_listing", label: "Directory Listing", findings: f };
}

async function testHttpMethods(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const dangerous = ["TRACE", "TRACK", "DELETE", "PUT"];
  const checks = dangerous.map(async method => {
    const r = await safeFetch(targetUrl, { method }, 4000);
    if (r && ![405, 501, 403, 404, 301, 302].includes(r.status)) {
      const sev = (method === "TRACE" || method === "TRACK") ? "MEDIUM" : "LOW";
      f.push({ type: `HTTP ${method} Enabled`, severity: sev, method, status_code: r.status, message: `HTTP ${method} returned status ${r.status}`, recommendation: `Disable ${method} method if not required` });
    }
  });
  await Promise.all(checks);
  return { key: "http_methods", label: "HTTP Methods", findings: f };
}

async function testSecurityTxt(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  for (const p of ["/.well-known/security.txt", "/security.txt"]) {
    const t = await getText(`${base}${p}`);
    if (t && (t.includes("Contact:") || t.includes("contact:"))) { f.push({ type: "security.txt Found", severity: "GOOD", location: p, message: "Security disclosure policy configured" }); return { key: "security_txt", label: "Security.txt", findings: f }; }
  }
  f.push({ type: "security.txt Missing", severity: "LOW", message: "No security.txt found", recommendation: "Add /.well-known/security.txt for responsible disclosure" });
  return { key: "security_txt", label: "Security.txt", findings: f };
}

async function testCorsConfig(targetUrl: string, mainResp: Response | null): Promise<ScanCategory> {
  const f: Finding[] = [];
  const acao = mainResp?.headers.get("access-control-allow-origin") || "";
  const acac = mainResp?.headers.get("access-control-allow-credentials") || "";
  if (acao === "*" && acac.toLowerCase() === "true") f.push({ type: "Critical CORS", severity: "CRITICAL", message: "CORS allows credentials with wildcard origin", recommendation: "Never combine Access-Control-Allow-Credentials with wildcard origin" });
  else if (acao === "*") f.push({ type: "CORS Wildcard", severity: "MEDIUM", message: "Access-Control-Allow-Origin set to *", recommendation: "Restrict to trusted domains" });
  else if (acao) f.push({ type: "CORS Configured", severity: "GOOD", value: acao, message: `CORS restricted to: ${acao}` });
  const r2 = await safeFetch(targetUrl, { headers: { "Origin": "https://evil-attacker.com" } }, 4000);
  if (r2) {
    const reflected = r2.headers.get("access-control-allow-origin");
    if (reflected === "https://evil-attacker.com") f.push({ type: "CORS Origin Reflection", severity: "HIGH", message: "Server reflects arbitrary Origin header in CORS - exploitable", recommendation: "Validate Origin header against a whitelist" });
  }
  if (f.length === 0) f.push({ type: "CORS", severity: "INFO", message: "No CORS headers - same-origin policy applies" });
  return { key: "cors_configuration", label: "CORS Configuration", findings: f };
}

// ── DISCOVERY GROUP (9 tests) ──

async function runDiscovery(targetUrl: string): Promise<{ categories: ScanCategory[]; crawlData: CrawlData }> {
  const mainResp = await safeFetch(targetUrl);
  const mainHtml = mainResp ? await mainResp.text().catch(() => "") : "";
  const base = new URL(targetUrl).origin;
  const links = extractLinks(mainHtml, base);

  const extraHtmls: string[] = [];
  const pagesToCrawl = links.slice(0, 5);
  const crawlResults = await Promise.all(pagesToCrawl.map(u => getText(u, 4000)));
  extraHtmls.push(...crawlResults.filter(Boolean));

  const allHtml = mainHtml + "\n" + extraHtmls.join("\n");
  const allForms = extractForms(allHtml, base);
  const allParams = extractParams(links);

  const crawlData: CrawlData = { urls: links, forms: allForms, params: allParams, html: mainHtml };
  const categories: ScanCategory[] = [];

  categories.push({ key: "website_crawling", label: "Website Crawling", findings: [
    { type: "Crawl Complete", severity: "INFO", message: `Crawled ${1 + extraHtmls.length} pages, found ${links.length} URLs, ${allForms.length} forms, ${allParams.length} parameterized URLs` }
  ]});

  const [techCat, portCat, loginCat, openapiCat, graphqlCat, adminCat, domainCat, sensDataCat] = await Promise.all([
    testTechnology(mainHtml, mainResp),
    testPorts(targetUrl),
    testLoginInterfaces(targetUrl),
    testOpenApiDocs(targetUrl),
    testGraphqlEndpoints(targetUrl),
    testAdminPages(targetUrl),
    testDomainSources(mainHtml, base),
    testSensitiveDataCrawl(allHtml),
  ]);
  categories.push(techCat, portCat, loginCat, openapiCat, graphqlCat, adminCat, domainCat, sensDataCat);
  return { categories, crawlData };
}

function testTechnology(html: string, resp: Response | null): ScanCategory {
  const f: Finding[] = [];
  if (!resp) return { key: "technology_detection", label: "Technology & Language Detection", findings: f };
  const hdrs = resp.headers;
  const lower = html.toLowerCase();
  const server = hdrs.get("server") || "";
  if (server) f.push({ type: "Web Server", severity: "INFO", value: server, message: `Web server: ${server}` });
  const pb = hdrs.get("x-powered-by") || "";
  if (pb) f.push({ type: "Backend Tech", severity: "INFO", value: pb, message: `Server technology: ${pb}` });
  const hdrStr = [...hdrs.entries()].map(([k, v]) => `${k}: ${v}`).join("\n").toLowerCase();
  const langs: [string, string[], string[]][] = [
    ["PHP", ["x-powered-by: php", "set-cookie: phpsessid"], [".php", "phpsessid"]],
    ["ASP.NET", ["x-aspnet-version", "x-powered-by: asp"], ["__viewstate", "__eventvalidation", ".aspx", ".ashx"]],
    ["Java/JSP", ["x-powered-by: servlet", "x-powered-by: jsp"], ["jsessionid", ".jsp", ".do", "struts", "spring"]],
    ["Python", ["x-powered-by: python", "x-powered-by: gunicorn", "x-powered-by: werkzeug"], ["csrfmiddlewaretoken", "django", "flask", "python"]],
    ["Ruby on Rails", ["x-powered-by: phusion", "x-runtime"], ["csrf-token", "rails", "ruby"]],
    ["Node.js/Express", ["x-powered-by: express"], ["express", "node"]],
    ["Go", ["x-powered-by: go"], []],
    ["Perl", [], ["cgi-bin", ".pl", ".cgi"]],
  ];
  for (const [lang, hdrSigs, htmlSigs] of langs) {
    if (hdrSigs.some(s => hdrStr.includes(s)) || htmlSigs.some(s => lower.includes(s))) f.push({ type: "Backend Language", severity: "INFO", value: lang, message: `Server-side language detected: ${lang}` });
  }
  const fws: [string, string[]][] = [
    ["React", ["_reactRootContainer", "__NEXT_DATA__", "data-reactroot", "react-app"]],
    ["Vue.js", ["data-v-", "__vue__", "v-app", "vue.min.js", "vue.js"]],
    ["Angular", ["ng-version", "ng-app", "angular.min.js", "zone.js"]],
    ["jQuery", ["jquery.min.js", "jquery.js", "jquery-"]],
    ["Bootstrap", ["bootstrap.min.css", "bootstrap.min.js"]],
    ["Tailwind CSS", ["tailwindcss"]],
    ["Next.js", ["__NEXT_DATA__", "/_next/"]],
    ["Nuxt.js", ["__NUXT__", "/_nuxt/"]],
    ["Svelte", ["__svelte", "svelte"]],
    ["Ember.js", ["ember.js", "ember.min.js"]],
    ["Backbone.js", ["backbone.js", "backbone.min.js"]],
  ];
  for (const [name, sigs] of fws) {
    if (sigs.some(s => lower.includes(s))) f.push({ type: ["Bootstrap", "Tailwind CSS"].includes(name) ? "CSS Framework" : "Frontend Framework", severity: "INFO", value: name, message: `Frontend framework: ${name}` });
  }
  const cmss: [string, string[]][] = [
    ["WordPress", ["/wp-content/", "/wp-includes/", "wp-json"]],
    ["Joomla", ["/components/com_", "joomla"]],
    ["Drupal", ["/sites/default/", "drupal"]],
    ["Shopify", ["cdn.shopify.com"]],
    ["Wix", ["wix.com", "wixstatic.com"]],
    ["Squarespace", ["squarespace.com"]],
    ["Magento", ["mage/cookies", "magento"]],
    ["PrestaShop", ["prestashop"]],
  ];
  for (const [name, sigs] of cmss) if (sigs.some(s => lower.includes(s))) f.push({ type: "CMS", severity: "INFO", value: name, message: `CMS detected: ${name}` });
  const analytics: [string, string[]][] = [
    ["Google Analytics", ["google-analytics.com", "googletagmanager.com", "gtag("]],
    ["Facebook Pixel", ["connect.facebook.net", "fbq("]],
    ["Hotjar", ["hotjar.com"]],
    ["Matomo/Piwik", ["matomo.js", "piwik.js"]],
    ["Plausible", ["plausible.io"]],
  ];
  for (const [name, sigs] of analytics) if (sigs.some(s => lower.includes(s))) f.push({ type: "Analytics", severity: "LOW", value: name, message: `Tracker: ${name}` });
  const cdns: [string, string[]][] = [["Cloudflare", ["cf-ray", "cloudflare"]], ["AWS CloudFront", ["cloudfront.net", "x-amz-cf"]], ["Akamai", ["akamai"]], ["Fastly", ["fastly"]], ["Google Cloud", ["x-goog-", "googleapis"]]];
  const allH = hdrStr + " " + lower;
  for (const [name, sigs] of cdns) if (sigs.some(s => allH.includes(s))) f.push({ type: "CDN/Hosting", severity: "INFO", value: name, message: `Infrastructure: ${name}` });
  if (f.length === 0) f.push({ type: "Technology Detection", severity: "INFO", message: "Could not identify specific technologies" });
  return { key: "technology_detection", label: "Technology & Language Detection", findings: f };
}

async function testPorts(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const host = new URL(targetUrl).hostname;
  const ports: [number, string, boolean][] = [
    [21, "FTP", true], [22, "SSH", false], [23, "Telnet", true], [25, "SMTP", false],
    [80, "HTTP", false], [443, "HTTPS", false], [3306, "MySQL", true], [5432, "PostgreSQL", true],
    [8080, "HTTP-Alt", false], [8443, "HTTPS-Alt", false], [3389, "RDP", true],
    [6379, "Redis", true], [27017, "MongoDB", true], [9200, "Elasticsearch", true],
    [11211, "Memcached", true], [5900, "VNC", true],
  ];
  let openCount = 0;
  const checks = ports.map(async ([port, svc, dangerous]) => {
    const proto = (port === 443 || port === 8443) ? "https" : "http";
    const r = await safeFetch(`${proto}://${host}:${port}/`, {}, 3000);
    if (r) {
      openCount++;
      f.push({ type: "Open Port", severity: dangerous ? "HIGH" : (port === 80 || port === 443) ? "INFO" : "MEDIUM", port, service: svc, status: "OPEN", message: `Port ${port} (${svc}) is open${dangerous ? " - should not be public" : ""}`, recommendation: dangerous ? `Restrict port ${port} via firewall` : undefined });
    } else if (dangerous) {
      f.push({ type: "Closed Port", severity: "GOOD", port, service: svc, status: "CLOSED", message: `Port ${port} (${svc}) is closed` });
    }
  });
  await Promise.all(checks);
  f.sort((a, b) => { const o: Record<string, number> = { HIGH: 0, MEDIUM: 1, INFO: 2, GOOD: 3 }; return (o[a.severity] ?? 9) - (o[b.severity] ?? 9); });
  f.push({ type: "Port Summary", severity: "INFO", message: `Scanned ${ports.length} ports: ${openCount} open` });
  return { key: "port_scan", label: "Port Scanning", findings: f };
}

async function testLoginInterfaces(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const paths = ["/login", "/signin", "/auth/login", "/user/login", "/account/login", "/wp-login.php", "/admin/login"];
  const checks = paths.map(async p => {
    const t = await getText(`${base}${p}`, 4000);
    if (t && (t.toLowerCase().includes('type="password"') || t.toLowerCase().includes("type='password'"))) f.push({ type: "Login Interface", severity: "INFO", url: `${base}${p}`, message: `Login form found at ${p}` });
  });
  await Promise.all(checks);
  return { key: "login_interfaces", label: "Login Interfaces", findings: f };
}

async function testOpenApiDocs(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const paths = ["/swagger.json", "/swagger-ui.html", "/api-docs", "/v2/api-docs", "/v3/api-docs", "/openapi.json", "/openapi.yaml", "/swagger/", "/docs", "/redoc"];
  const checks = paths.map(async p => {
    const r = await safeFetch(`${base}${p}`, {}, 3000);
    if (r && r.status === 200) {
      const t = await r.text().catch(() => "");
      if (t.includes("swagger") || t.includes("openapi") || t.includes("paths") || t.includes("api-docs")) f.push({ type: "API Documentation Exposed", severity: "MEDIUM", url: `${base}${p}`, message: `API docs found at ${p}`, recommendation: "Restrict API documentation access in production" });
    }
  });
  await Promise.all(checks);
  return { key: "openapi_docs", label: "OpenAPI Documentation", findings: f };
}

async function testGraphqlEndpoints(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const paths = ["/graphql", "/graphiql", "/v1/graphql", "/api/graphql", "/gql"];
  const checks = paths.map(async p => {
    const r = await safeFetch(`${base}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ __typename }" }) }, 4000);
    if (r && r.status === 200) {
      const t = await r.text().catch(() => "");
      if (t.includes("__typename") || t.includes("data") || t.includes("Query")) {
        f.push({ type: "GraphQL Endpoint", severity: "INFO", url: `${base}${p}`, message: `GraphQL endpoint at ${p}` });
        const introR = await safeFetch(`${base}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ __schema { types { name } } }" }) }, 4000);
        if (introR && introR.status === 200) {
          const it = await introR.text().catch(() => "");
          if (it.includes("__schema")) f.push({ type: "GraphQL Introspection", severity: "MEDIUM", url: `${base}${p}`, message: "GraphQL introspection is enabled - exposes full schema", recommendation: "Disable introspection in production" });
        }
      }
    }
  });
  await Promise.all(checks);
  return { key: "graphql_endpoints", label: "GraphQL Endpoints", findings: f };
}

async function testAdminPages(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const paths = ["/admin", "/administrator", "/wp-admin", "/dashboard", "/panel", "/manage", "/console", "/phpmyadmin", "/cpanel", "/webmail", "/controlpanel", "/admin.php", "/manager"];
  const checks = paths.map(async p => {
    const r = await safeFetch(`${base}${p}`, {}, 3000);
    if (r && [200, 301, 302, 403].includes(r.status)) f.push({ type: "Admin Page", severity: r.status === 200 ? "MEDIUM" : "INFO", url: `${base}${p}`, status_code: r.status, message: `Admin path ${p} responded with ${r.status}` });
  });
  await Promise.all(checks);
  return { key: "admin_pages", label: "Admin Pages Discovery", findings: f };
}

function testDomainSources(html: string, base: string): ScanCategory {
  const f: Finding[] = [];
  const srcRegex = /(?:src|href)=["'](https?:\/\/[^"']+)["']/gi;
  let m;
  const domains = new Set<string>();
  const baseHost = new URL(base).hostname;
  while ((m = srcRegex.exec(html)) !== null) {
    try { const h = new URL(m[1]).hostname; if (h !== baseHost && !h.endsWith(`.${baseHost}`)) domains.add(h); } catch { /* skip */ }
  }
  if (domains.size > 0) {
    const list = [...domains].slice(0, 20);
    f.push({ type: "External Domains", severity: "INFO", value: list.join(", "), message: `${list.length} external domain(s) loaded: ${list.slice(0, 5).join(", ")}${list.length > 5 ? "..." : ""}` });
    const suspicious = list.filter(d => d.includes("analytics") || d.includes("track") || d.includes("pixel") || d.includes("ad") || d.includes("beacon"));
    if (suspicious.length > 0) f.push({ type: "Tracking Domains", severity: "LOW", value: suspicious.join(", "), message: `Tracking/advertising domains detected: ${suspicious.join(", ")}` });
  }
  return { key: "domain_sources", label: "Domain Sources Verification", findings: f };
}

function testSensitiveDataCrawl(html: string): ScanCategory {
  const f: Finding[] = [];
  const patterns: [RegExp, string, string][] = [
    [/\b\d{3}-\d{2}-\d{4}\b/g, "SSN Pattern", "Potential Social Security Number pattern found in page content"],
    [/\b(?:\d[ -]*?){13,16}\b/g, "Credit Card Pattern", "Potential credit card number pattern found"],
    [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "Email Addresses", "Email addresses found in page content"],
    [/\b(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"'<>]{3,}/gi, "Password Exposure", "Potential password found in page source"],
    [/\b(?:api[_-]?key|apikey|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_\-.]{10,}/gi, "API Key Exposure", "Potential API key found in page source"],
    [/\b(?:secret|private[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_\-.+/]{10,}/gi, "Secret Key Exposure", "Potential secret key found in page source"],
  ];
  for (const [regex, type, msg] of patterns) {
    const matches = html.match(regex);
    if (matches && matches.length > 0 && type !== "Email Addresses") f.push({ type, severity: "HIGH", message: msg, evidence: matches[0].substring(0, 50) + "...", recommendation: "Remove sensitive data from client-accessible content" });
    else if (matches && type === "Email Addresses") f.push({ type, severity: "LOW", value: [...new Set(matches)].slice(0, 5).join(", "), message: `${matches.length} email(s) found` });
  }
  return { key: "sensitive_data_crawling", label: "Sensitive Data Crawling", findings: f };
}

// ── INJECTION GROUP (12 tests) ──

async function runInjection(targetUrl: string, crawlData?: CrawlData): Promise<ScanCategory[]> {
  const base = new URL(targetUrl).origin;
  const params = crawlData?.params || [];
  const forms = crawlData?.forms || [];
  const html = crawlData?.html || "";

  const testUrls: { url: string; param: string }[] = [];
  for (const p of params) for (const param of p.params.slice(0, 3)) testUrls.push({ url: p.url, param });
  if (testUrls.length === 0) {
    const commonParams = ["id", "search", "q", "page", "query", "s", "keyword", "file", "path", "url", "redirect", "lang", "cat", "category", "item", "product"];
    for (const param of commonParams) testUrls.push({ url: `${base}/?${param}=test`, param });
  }

  const categories = await Promise.all([
    testSqlInjection(testUrls),
    testNosqlInjection(testUrls),
    testXss(testUrls),
    testFileInclusion(testUrls),
    testCommandInjection(testUrls),
    testCodeInjection(testUrls),
    testSsti(testUrls),
    testLog4j(targetUrl),
    testAspCookielessXss(targetUrl),
    testClientTemplateInjection(html, testUrls),
    testPrototypePollution(testUrls, html),
    testUrlOverride(targetUrl),
  ]);
  return categories;
}

async function injectAndCheck(inputs: { url: string; param: string }[], payloads: string[], indicators: (string | RegExp)[], maxInputs = 5, maxPayloads = 3): Promise<{ found: boolean; location: string; payload: string; evidence: string }[]> {
  const results: { found: boolean; location: string; payload: string; evidence: string }[] = [];
  const tasks = inputs.slice(0, maxInputs).flatMap(input =>
    payloads.slice(0, maxPayloads).map(async payload => {
      try {
        const u = new URL(input.url);
        u.searchParams.set(input.param, payload);
        const r = await safeFetch(u.href, {}, 4000);
        if (!r) return;
        const body = await r.text().catch(() => "");
        for (const ind of indicators) {
          const match = typeof ind === "string" ? body.toLowerCase().includes(ind.toLowerCase()) : ind.test(body);
          if (match) { results.push({ found: true, location: u.href, payload, evidence: typeof ind === "string" ? ind : ind.source }); return; }
        }
      } catch { /* skip */ }
    })
  );
  await Promise.all(tasks);
  return results;
}

async function testSqlInjection(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const payloads = ["'", "' OR '1'='1", "1 UNION SELECT NULL--", "' AND SLEEP(5)--", "1; SELECT 1--"];
  const indicators = ["sql syntax", "mysql", "sqlite", "postgresql", "ora-", "sqlstate", "unclosed quotation", "syntax error", "microsoft ole db", "odbc drivers", "you have an error in your sql", "pg_query", "mysql_fetch"];
  const results = await injectAndCheck(inputs, payloads, indicators);
  for (const r of results) f.push({ type: "SQL Injection", severity: "CRITICAL", location: r.location, payload: r.payload, evidence: `SQL error pattern detected: ${r.evidence}`, recommendation: "Use parameterized queries / prepared statements" });
  if (f.length === 0) f.push({ type: "SQL Injection", severity: "GOOD", message: "No SQL injection vulnerabilities detected" });
  return { key: "sql_injection", label: "SQL Injection", findings: f };
}

async function testNosqlInjection(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const payloads = ['{"$gt":""}', '{"$ne":null}', "true, $where: '1 == 1'", '[$ne]=1'];
  const indicators = ["mongoerror", "mongod", "bson", "nosql", "$where"];
  const results = await injectAndCheck(inputs, payloads, indicators);
  for (const r of results) f.push({ type: "NoSQL Injection", severity: "CRITICAL", location: r.location, payload: r.payload, evidence: `NoSQL error: ${r.evidence}`, recommendation: "Sanitize inputs for NoSQL queries" });
  if (f.length === 0) f.push({ type: "NoSQL Injection", severity: "GOOD", message: "No NoSQL injection detected" });
  return { key: "nosql_injection", label: "NoSQL Injection", findings: f };
}

async function testXss(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const payloads = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "'-alert(1)-'", '<svg/onload=alert(1)>'];
  const checks = inputs.slice(0, 6).flatMap(input =>
    payloads.slice(0, 3).map(async payload => {
      try {
        const u = new URL(input.url);
        u.searchParams.set(input.param, payload);
        const r = await safeFetch(u.href, {}, 4000);
        if (!r) return;
        const body = await r.text().catch(() => "");
        if (body.includes(payload)) f.push({ type: "Reflected XSS", severity: "HIGH", location: u.href, payload, evidence: "Payload reflected without encoding", recommendation: "Encode all user input in output context" });
      } catch { /* skip */ }
    })
  );
  await Promise.all(checks);
  if (f.length === 0) f.push({ type: "XSS", severity: "GOOD", message: "No reflected XSS detected" });
  return { key: "xss", label: "Cross-Site Scripting (XSS)", findings: f };
}

async function testFileInclusion(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const payloads = ["../../../../../../etc/passwd", "....//....//....//etc/passwd", "..\\..\\..\\windows\\win.ini", "/etc/passwd%00", "php://filter/convert.base64-encode/resource=index"];
  const indicators = ["root:x:0", "root:*:0", "[boot loader]", "[extensions]", "PD9waHA"];
  const results = await injectAndCheck(inputs, payloads, indicators);
  for (const r of results) f.push({ type: "File Inclusion (LFI)", severity: "CRITICAL", location: r.location, payload: r.payload, evidence: `File content detected: ${r.evidence}`, recommendation: "Never use user input in file paths - use a whitelist" });
  if (f.length === 0) f.push({ type: "File Inclusion", severity: "GOOD", message: "No file inclusion vulnerability detected" });
  return { key: "file_inclusion", label: "File Inclusion (LFI/RFI)", findings: f };
}

async function testCommandInjection(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const marker = "CMD_INJECT_TEST_" + Date.now();
  const payloads = [`; echo ${marker}`, `| echo ${marker}`, `\`echo ${marker}\``];
  const indicators = [marker];
  const results = await injectAndCheck(inputs, payloads, indicators, 4, 2);
  for (const r of results) f.push({ type: "OS Command Injection", severity: "CRITICAL", location: r.location, payload: r.payload, evidence: "Command output detected in response", recommendation: "Never pass user input to system commands - use safe APIs" });
  if (f.length === 0) f.push({ type: "Command Injection", severity: "GOOD", message: "No command injection detected" });
  return { key: "command_injection", label: "OS Command Injection", findings: f };
}

async function testCodeInjection(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const marker = "CODEINJ" + Date.now();
  const payloads = [`phpinfo()`, `${marker}`, `');echo('${marker}`, `\${${marker}}`, `<%=7*7%>`];
  const indicators = ["phpinfo()", "<title>phpinfo()", marker, "49"];
  const results = await injectAndCheck(inputs, payloads, indicators, 4, 2);
  for (const r of results) f.push({ type: "Code Injection", severity: "CRITICAL", location: r.location, payload: r.payload, evidence: `Code execution indicator: ${r.evidence}`, recommendation: "Never evaluate user-supplied code" });
  if (f.length === 0) f.push({ type: "Code Injection", severity: "GOOD", message: "No code injection detected" });
  return { key: "code_injection", label: "Code Injection (PHP/JS/Ruby/Python/Perl)", findings: f };
}

async function testSsti(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const payloads = ["{{7*7}}", "${7*7}", "<%= 7*7 %>", "#{7*7}", "{7*7}", "{{7*'7'}}"];
  const checks = inputs.slice(0, 5).flatMap(input =>
    payloads.slice(0, 4).map(async payload => {
      try {
        const u = new URL(input.url);
        u.searchParams.set(input.param, payload);
        const base = new URL(input.url);
        base.searchParams.set(input.param, "BASELINE_TEST");
        const [r, br] = await Promise.all([safeFetch(u.href, {}, 4000), safeFetch(base.href, {}, 4000)]);
        if (!r) return;
        const body = await r.text().catch(() => "");
        const baseBody = br ? await br.text().catch(() => "") : "";
        if (body.includes("49") && !baseBody.includes("49")) f.push({ type: "Server-Side Template Injection", severity: "CRITICAL", location: u.href, payload, evidence: "Template expression evaluated (49 found)", recommendation: "Never render user input in templates without sandboxing" });
      } catch { /* skip */ }
    })
  );
  await Promise.all(checks);
  if (f.length === 0) f.push({ type: "SSTI", severity: "GOOD", message: "No template injection detected" });
  return { key: "ssti", label: "Server-Side Template Injection", findings: f };
}

async function testLog4j(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const jndiPayload = "${jndi:ldap://127.0.0.1/test}";
  const headerTargets = ["User-Agent", "X-Forwarded-For", "Referer", "X-Api-Version", "Accept-Language"];
  const checks = headerTargets.map(async header => {
    const r = await safeFetch(targetUrl, { headers: { [header]: jndiPayload } }, 4000);
    if (r) {
      const body = await r.text().catch(() => "");
      if (body.includes("jndi") || body.includes("Unrecognized") || r.status === 500) f.push({ type: "Log4j Potential", severity: "HIGH", header, payload: jndiPayload, message: `Server error with JNDI payload in ${header} - may indicate Log4j vulnerability`, recommendation: "Update Log4j to 2.17.1+ or remove JndiLookup class" });
    }
  });
  await Promise.all(checks);
  if (f.length === 0) f.push({ type: "Log4j RCE", severity: "GOOD", message: "No Log4j indicators detected" });
  return { key: "log4j_rce", label: "Log4j RCE (CVE-2021-44228)", findings: f };
}

async function testAspCookielessXss(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const testPath = "/(S(x))/";
  const r = await safeFetch(`${base}${testPath}`, {}, 4000);
  if (r && r.status === 200) {
    const body = await r.text().catch(() => "");
    if (body.includes("(S(x))") || !body.includes("404")) f.push({ type: "ASP Cookieless Session", severity: "MEDIUM", url: `${base}${testPath}`, message: "ASP.NET cookieless session URLs may be enabled", recommendation: "Disable cookieless sessions in web.config" });
  }
  return { key: "asp_cookieless_xss", label: "ASP Cookieless XSS", findings: f };
}

async function testClientTemplateInjection(html: string, inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const lower = html.toLowerCase();
  const hasAngular = lower.includes("ng-app") || lower.includes("ng-version");
  const hasVue = lower.includes("v-app") || lower.includes("data-v-");
  if (hasAngular || hasVue) {
    const payloads = hasAngular ? ["{{constructor.constructor('return this')()}}", "{{$on.constructor('alert(1)')()}}"] : ["{{_c.constructor('alert(1)')()}}"];
    const results = await injectAndCheck(inputs, payloads, ["[object"], 3, 1);
    for (const r of results) f.push({ type: "Client Template Injection", severity: "HIGH", location: r.location, payload: r.payload, evidence: "Template expression evaluated client-side", recommendation: "Sanitize user input before template rendering" });
  }
  return { key: "client_template_injection", label: "Client Template Injection", findings: f };
}

async function testPrototypePollution(inputs: { url: string; param: string }[], html: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const checks = inputs.slice(0, 3).map(async input => {
    try {
      const u = new URL(input.url);
      u.searchParams.set("__proto__[polluted]", "true");
      const r = await safeFetch(u.href, {}, 4000);
      if (r && r.status === 500) f.push({ type: "Prototype Pollution", severity: "HIGH", location: u.href, message: "Server error with __proto__ payload - may be vulnerable", recommendation: "Sanitize object keys and use Object.create(null)" });
    } catch { /* skip */ }
  });
  await Promise.all(checks);
  if (html.includes("Object.assign") || html.includes("_.merge") || html.includes("$.extend")) f.push({ type: "Prototype Pollution Risk", severity: "LOW", message: "Client-side code uses deep merge functions that may be exploitable", recommendation: "Use safe merge utilities that skip __proto__ keys" });
  return { key: "prototype_pollution", label: "Prototype Pollution", findings: f };
}

async function testUrlOverride(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const overrideHeaders: [string, string][] = [
    ["X-Original-URL", "/admin"],
    ["X-Rewrite-URL", "/admin"],
    ["X-Forwarded-Host", "evil.com"],
    ["X-Forwarded-Scheme", "nothttps"],
    ["X-Host", "evil.com"],
  ];
  const baseline = await safeFetch(targetUrl, {}, 4000);
  const baseStatus = baseline?.status;
  const checks = overrideHeaders.map(async ([header, value]) => {
    const r = await safeFetch(targetUrl, { headers: { [header]: value } }, 4000);
    if (r && r.status !== baseStatus && r.status !== 404) f.push({ type: "URL Override", severity: "MEDIUM", header, value, message: `${header}: ${value} changed response (${baseStatus} -> ${r.status})`, recommendation: `Ensure the server ignores ${header} header` });
  });
  await Promise.all(checks);
  return { key: "url_override", label: "URL Override", findings: f };
}

// ── ADVANCED GROUP (9 tests) ──

async function runAdvanced(targetUrl: string, crawlData?: CrawlData): Promise<ScanCategory[]> {
  const html = crawlData?.html || "";
  const params = crawlData?.params || [];
  const forms = crawlData?.forms || [];

  const testUrls: { url: string; param: string }[] = [];
  for (const p of params) for (const param of p.params.slice(0, 3)) testUrls.push({ url: p.url, param });
  if (testUrls.length === 0) testUrls.push({ url: `${new URL(targetUrl).origin}/?url=test`, param: "url" }, { url: `${new URL(targetUrl).origin}/?redirect=test`, param: "redirect" });

  return Promise.all([
    testSsrf(testUrls),
    testOpenRedirect(testUrls),
    testBrokenAuth(targetUrl),
    testViewStateRce(targetUrl, html),
    testHttpSmuggling(targetUrl),
    testCsrf(html, forms),
    testInsecureDeserialization(targetUrl, html),
    testSessionFixation(targetUrl),
    testIdor(testUrls),
  ]);
}

async function testSsrf(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const ssrfPayloads = ["http://127.0.0.1", "http://localhost", "http://169.254.169.254/latest/meta-data/", "http://[::1]"];
  const indicators = ["root:", "meta-data", "ami-id", "instance-id", "localhost", "127.0.0.1"];
  const results = await injectAndCheck(inputs, ssrfPayloads, indicators, 3, 2);
  for (const r of results) f.push({ type: "SSRF", severity: "CRITICAL", location: r.location, payload: r.payload, evidence: `Internal resource accessed: ${r.evidence}`, recommendation: "Validate and whitelist URLs server-side" });
  if (f.length === 0) f.push({ type: "SSRF", severity: "GOOD", message: "No SSRF detected" });
  return { key: "ssrf", label: "Server-Side Request Forgery", findings: f };
}

async function testOpenRedirect(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const payloads = ["https://evil.com", "//evil.com", "/\\evil.com", "https://evil.com%00@target.com"];
  const redirectParams = inputs.filter(i => ["url", "redirect", "next", "return", "returnTo", "goto", "dest", "destination", "redir", "continue", "callback"].includes(i.param));
  if (redirectParams.length === 0) redirectParams.push(...inputs.slice(0, 3));
  const checks = redirectParams.slice(0, 4).flatMap(input =>
    payloads.slice(0, 2).map(async payload => {
      try {
        const u = new URL(input.url);
        u.searchParams.set(input.param, payload);
        const r = await safeFetch(u.href, {}, 4000);
        if (r && [301, 302, 303, 307, 308].includes(r.status)) {
          const loc = r.headers.get("location") || "";
          if (loc.includes("evil.com")) f.push({ type: "Open Redirect", severity: "MEDIUM", location: u.href, payload, evidence: `Redirects to: ${loc}`, recommendation: "Validate redirect URLs against a whitelist" });
        }
      } catch { /* skip */ }
    })
  );
  await Promise.all(checks);
  if (f.length === 0) f.push({ type: "Open Redirect", severity: "GOOD", message: "No open redirect detected" });
  return { key: "open_redirect", label: "Open Redirect", findings: f };
}

async function testBrokenAuth(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const protectedPaths = ["/admin", "/dashboard", "/api/users", "/api/admin", "/account", "/profile", "/settings"];
  const checks = protectedPaths.map(async p => {
    const r = await safeFetch(`${base}${p}`, {}, 3000);
    if (r && r.status === 200) {
      const t = await r.text().catch(() => "");
      if (!t.toLowerCase().includes("login") && !t.toLowerCase().includes("sign in") && t.length > 500) f.push({ type: "Broken Access Control", severity: "HIGH", url: `${base}${p}`, message: `Protected path ${p} accessible without auth`, recommendation: "Implement proper authentication checks" });
    }
  });
  await Promise.all(checks);
  if (f.length === 0) f.push({ type: "Access Control", severity: "GOOD", message: "Protected paths appear to require authentication" });
  return { key: "broken_auth", label: "Broken Authentication", findings: f };
}

async function testViewStateRce(targetUrl: string, html: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const vsMatch = html.match(/name="__VIEWSTATE"[^>]*value="([^"]+)"/i);
  if (vsMatch) {
    f.push({ type: "ViewState Detected", severity: "INFO", message: "ASP.NET ViewState is present" });
    const vs = vsMatch[1];
    if (!html.includes("__VIEWSTATEGENERATOR") && !html.includes("__EVENTVALIDATION")) f.push({ type: "ViewState Unprotected", severity: "HIGH", message: "ViewState appears to lack MAC protection - potential RCE", recommendation: "Enable ViewState MAC validation" });
    try { const decoded = atob(vs); if (decoded.includes("System.") || decoded.includes("Object")) f.push({ type: "ViewState Readable", severity: "MEDIUM", message: "ViewState content is readable (not encrypted)", recommendation: "Enable ViewState encryption" }); } catch { /* not base64 */ }
  }
  return { key: "viewstate_rce", label: "ViewState RCE", findings: f };
}

async function testHttpSmuggling(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  try {
    const r = await safeFetch(targetUrl, { headers: { "Transfer-Encoding": "chunked", "Content-Length": "4" }, method: "POST", body: "0\r\n\r\nG" }, 5000);
    if (r && r.status === 400) f.push({ type: "HTTP Smuggling Potential", severity: "MEDIUM", message: "Server may be vulnerable to CL-TE request smuggling (400 on conflicting headers)", recommendation: "Configure front-end and back-end to handle Transfer-Encoding consistently" });
  } catch { /* skip */ }
  try {
    const r2 = await safeFetch(targetUrl, { headers: { "Transfer-Encoding": " chunked" } }, 4000);
    if (r2 && r2.status !== 400 && r2.status !== 501) f.push({ type: "TE Obfuscation", severity: "LOW", message: "Server accepts obfuscated Transfer-Encoding header", recommendation: "Normalize Transfer-Encoding header processing" });
  } catch { /* skip */ }
  return { key: "http_request_smuggling", label: "HTTP Request Smuggling", findings: f };
}

function testCsrf(html: string, forms: CrawlData["forms"]): ScanCategory {
  const f: Finding[] = [];
  const csrfTokenNames = ["csrf", "token", "_token", "csrf_token", "authenticity_token", "csrfmiddlewaretoken", "__requestverificationtoken", "antiforgery"];
  const postForms = forms.filter(fm => fm.method === "POST");
  let unprotected = 0;
  for (const form of postForms) {
    const hasToken = form.inputs.some(inp => csrfTokenNames.some(t => inp.toLowerCase().includes(t)));
    if (!hasToken) { unprotected++; f.push({ type: "Missing CSRF Token", severity: "MEDIUM", url: form.action, message: `POST form to ${form.action} lacks CSRF token`, recommendation: "Add anti-CSRF tokens to all state-changing forms" }); }
  }
  if (postForms.length > 0 && unprotected === 0) f.push({ type: "CSRF Protection", severity: "GOOD", message: `All ${postForms.length} POST form(s) have CSRF tokens` });
  const formRegex = /<form[^>]*method=["']post["'][^>]*>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = formRegex.exec(html)) !== null) {
    const content = match[1].toLowerCase();
    if (!csrfTokenNames.some(t => content.includes(t))) { f.push({ type: "Missing CSRF (HTML)", severity: "MEDIUM", message: "POST form in HTML lacks visible CSRF token", recommendation: "Implement CSRF protection" }); break; }
  }
  return { key: "csrf", label: "CSRF Protection", findings: f };
}

async function testInsecureDeserialization(targetUrl: string, html: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  if (html.includes("__VIEWSTATE") || html.includes("java.io.") || html.includes("ObjectInputStream") || html.includes("pickle") || html.includes("serialize") || html.includes("unserialize")) f.push({ type: "Deserialization Pattern", severity: "MEDIUM", message: "Serialization/deserialization patterns detected in source", recommendation: "Avoid deserializing untrusted data - use safe formats like JSON" });
  const cookies = (await safeFetch(targetUrl))?.headers.getSetCookie?.() || [];
  for (const c of cookies) {
    const value = c.split("=").slice(1).join("=").split(";")[0];
    if (value.startsWith("rO0AB") || value.startsWith("aced0005")) f.push({ type: "Java Serialized Cookie", severity: "HIGH", message: "Cookie contains Java serialized object", recommendation: "Use JSON/JWT instead of Java serialization for session data" });
    if (value.match(/^[a-zA-Z]:\d+:/)) f.push({ type: "PHP Serialized Cookie", severity: "HIGH", message: "Cookie contains PHP serialized data", recommendation: "Use JSON for session data instead of PHP serialize()" });
  }
  return { key: "insecure_deserialization", label: "Insecure Deserialization", findings: f };
}

async function testSessionFixation(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const r1 = await safeFetch(targetUrl);
  const cookies1 = r1?.headers.getSetCookie?.() || [];
  const r2 = await safeFetch(targetUrl);
  const cookies2 = r2?.headers.getSetCookie?.() || [];
  if (cookies1.length > 0 && cookies2.length > 0) {
    const sessionCookies1 = cookies1.filter(c => { const n = c.split("=")[0].toLowerCase(); return n.includes("sess") || n.includes("sid") || n.includes("token"); });
    const sessionCookies2 = cookies2.filter(c => { const n = c.split("=")[0].toLowerCase(); return n.includes("sess") || n.includes("sid") || n.includes("token"); });
    if (sessionCookies1.length > 0 && sessionCookies2.length > 0) {
      const v1 = sessionCookies1[0].split("=")[1]?.split(";")[0];
      const v2 = sessionCookies2[0].split("=")[1]?.split(";")[0];
      if (v1 && v2 && v1 === v2) f.push({ type: "Static Session ID", severity: "MEDIUM", message: "Session ID is static across requests - potential fixation risk", recommendation: "Regenerate session IDs for each new session" });
    }
  }
  return { key: "session_fixation", label: "Session Fixation", findings: f };
}

async function testIdor(inputs: { url: string; param: string }[]): Promise<ScanCategory> {
  const f: Finding[] = [];
  const idParams = inputs.filter(i => ["id", "user_id", "uid", "account", "order", "doc", "profile", "item"].includes(i.param.toLowerCase()));
  const checks = idParams.slice(0, 4).map(async input => {
    try {
      const u1 = new URL(input.url); u1.searchParams.set(input.param, "1");
      const u2 = new URL(input.url); u2.searchParams.set(input.param, "2");
      const [r1, r2] = await Promise.all([safeFetch(u1.href, {}, 4000), safeFetch(u2.href, {}, 4000)]);
      if (r1 && r2 && r1.status === 200 && r2.status === 200) {
        const [t1, t2] = await Promise.all([r1.text(), r2.text()]);
        if (t1.length > 100 && t2.length > 100 && t1 !== t2) f.push({ type: "Potential IDOR", severity: "MEDIUM", location: input.url, message: `Parameter '${input.param}' returns different data for sequential IDs - potential IDOR`, recommendation: "Implement proper authorization checks for object access" });
      }
    } catch { /* skip */ }
  });
  await Promise.all(checks);
  return { key: "idor", label: "IDOR", findings: f };
}

// ── FILES GROUP (10 tests) ──

async function runFiles(targetUrl: string, crawlData?: CrawlData): Promise<ScanCategory[]> {
  const html = crawlData?.html || "";
  return Promise.all([
    testSensitiveFiles(targetUrl),
    testBackupFiles(targetUrl),
    testOutdatedLibraries(html, targetUrl),
    testInfoDisclosure(html),
    testCommentedCode(html),
    testCleartextCredentials(html, crawlData?.forms || []),
    testWeakPasswordSubmission(targetUrl, crawlData?.forms || []),
    testMisconfigurations(targetUrl),
    testJwtWeaknesses(targetUrl),
    testOpenApiFuzzing(targetUrl),
  ]);
}

async function testSensitiveFiles(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const files: [string, string, string][] = [
    ["/.env", "Environment config", "HIGH"], ["/.git/config", "Git config", "HIGH"], ["/.git/HEAD", "Git HEAD", "HIGH"],
    ["/.svn/entries", "SVN metadata", "HIGH"], ["/wp-config.php", "WordPress config", "CRITICAL"],
    ["/config.php", "PHP config", "HIGH"], ["/web.config", "IIS config", "HIGH"],
    ["/phpinfo.php", "PHP info page", "HIGH"], ["/server-status", "Apache status", "MEDIUM"],
    ["/server-info", "Apache info", "MEDIUM"], ["/composer.json", "Composer deps", "LOW"],
    ["/package.json", "Node.js manifest", "LOW"], ["/.htaccess", "Apache config", "MEDIUM"],
    ["/.DS_Store", "macOS metadata", "LOW"], ["/Thumbs.db", "Windows thumbnails", "LOW"],
    ["/elmah.axd", "ELMAH error log", "HIGH"], ["/trace.axd", "ASP.NET trace", "HIGH"],
    ["/.htpasswd", "Password file", "CRITICAL"], ["/WEB-INF/web.xml", "Java config", "HIGH"],
    ["/sitemap.xml", "Sitemap", "INFO"],
  ];
  const checks = files.map(async ([file, desc, sev]) => {
    const r = await safeFetch(`${base}${file}`, {}, 3000);
    if (r && r.status === 200) {
      const t = await r.text().catch(() => "");
      const isHtmlPage = t.toLowerCase().includes("<!doctype") || (t.toLowerCase().includes("<html") && t.length > 1000);
      if (t.length > 0 && !isHtmlPage) f.push({ type: "Sensitive File", severity: sev, file, url: `${base}${file}`, message: `${desc} accessible: ${file}`, recommendation: "Restrict access to this file" });
    }
  });
  await Promise.all(checks);
  return { key: "sensitive_files", label: "Sensitive Files Detection", findings: f };
}

async function testBackupFiles(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const host = new URL(targetUrl).hostname.replace(/\./g, "_");
  const files = ["/backup.zip", "/backup.tar.gz", "/backup.sql", "/database.sql", "/db.sql", "/dump.sql", "/site.zip", "/www.zip", `/${host}.zip`, `/${host}.sql`, "/data.sql", "/export.sql", "/index.php.bak", "/config.php.bak", "/web.config.bak", "/.bak", "/old/", "/backup/"];
  const checks = files.map(async file => {
    const r = await safeFetch(`${base}${file}`, {}, 3000);
    if (r && r.status === 200) {
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("text/html") || file.endsWith("/")) {
        const t = await r.text().catch(() => "");
        if (file.endsWith("/") && t.includes("Index of")) f.push({ type: "Backup Directory", severity: "HIGH", url: `${base}${file}`, message: `Backup directory listing: ${file}`, recommendation: "Remove backup directories from web root" });
        else if (!ct.includes("text/html")) f.push({ type: "Backup File", severity: "HIGH", file, url: `${base}${file}`, message: `Backup file accessible: ${file}`, recommendation: "Remove backup files from web root" });
      }
    }
  });
  await Promise.all(checks);
  return { key: "backup_files", label: "Exposed Backup Files", findings: f };
}

async function testOutdatedLibraries(html: string, targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const lower = html.toLowerCase();
  const vulns: [string, string, string, string][] = [
    ["jquery-1.", "jQuery 1.x", "MEDIUM", "Known XSS vulnerabilities"],
    ["jquery-2.", "jQuery 2.x", "MEDIUM", "Known vulnerabilities"],
    ["jquery/1.", "jQuery 1.x", "MEDIUM", "Known XSS vulnerabilities"],
    ["angular.js/1.", "AngularJS 1.x", "MEDIUM", "End of life"],
    ["angular.min.js/1.", "AngularJS 1.x", "MEDIUM", "End of life"],
    ["bootstrap/2.", "Bootstrap 2.x", "MEDIUM", "Known vulnerabilities"],
    ["bootstrap/3.", "Bootstrap 3.x", "LOW", "Known XSS vulnerabilities"],
    ["moment.js", "Moment.js", "LOW", "Maintenance mode - consider alternatives"],
    ["lodash/3.", "Lodash 3.x", "MEDIUM", "Prototype pollution vulnerability"],
    ["lodash/4.17.1", "Lodash <4.17.21", "LOW", "Known prototype pollution"],
    ["dompurify/1.", "DOMPurify 1.x", "MEDIUM", "Known XSS bypass"],
  ];
  for (const [sig, lib, sev, desc] of vulns) if (lower.includes(sig)) f.push({ type: "Outdated Library", severity: sev, value: lib, message: `${lib}: ${desc}`, recommendation: `Upgrade ${lib}` });
  const jqMatch = html.match(/jquery[.-](\d+\.\d+\.\d+)/i);
  if (jqMatch) {
    const ver = jqMatch[1].split(".").map(Number);
    if (ver[0] < 3 || (ver[0] === 3 && ver[1] < 5)) f.push({ type: "jQuery Version", severity: "MEDIUM", value: `jQuery ${jqMatch[1]}`, message: `jQuery ${jqMatch[1]} may have known vulnerabilities`, recommendation: "Upgrade to jQuery 3.7+" });
  }
  return { key: "outdated_libraries", label: "Outdated JavaScript Libraries", findings: f };
}

function testInfoDisclosure(html: string): ScanCategory {
  const f: Finding[] = [];
  const patterns: [RegExp, string, string, string][] = [
    [/<!--[\s\S]*?(password|secret|api[_-]?key|token|credentials|TODO|FIXME|HACK|BUG)[\s\S]*?-->/gi, "Sensitive Comment", "HTML comment contains sensitive keywords", "MEDIUM"],
    [/(?:var|let|const)\s+\w*(?:password|secret|apiKey|token|private)\s*=\s*["'][^"']{3,}/gi, "Hardcoded Secret", "Hardcoded sensitive value in JavaScript", "HIGH"],
    [/(?:\/\/|#)\s*(?:TODO|FIXME|HACK|BUG|XXX|TEMP)[:\s]/gi, "Debug Comment", "Development comments found in production code", "LOW"],
    [/console\.(log|debug|warn|error)\s*\(/gi, "Console Output", "console.log statements in production code", "LOW"],
  ];
  for (const [regex, type, msg, sev] of patterns) if (regex.test(html)) f.push({ type, severity: sev, message: msg, recommendation: "Remove sensitive information and debug code from production" });
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = html.match(emailRegex);
  if (emails) { const unique = [...new Set(emails)].slice(0, 5); f.push({ type: "Email Exposure", severity: "LOW", value: unique.join(", "), message: `${unique.length} email(s) found` }); }
  return { key: "information_disclosure", label: "Information Disclosure", findings: f };
}

function testCommentedCode(html: string): ScanCategory {
  const f: Finding[] = [];
  const comments = html.match(/<!--[\s\S]*?-->/g) || [];
  const codeComments = comments.filter(c => c.includes("<script") || c.includes("function") || c.includes("SELECT") || c.includes("INSERT") || c.includes("<?php") || c.includes("password") || c.includes("TODO") || c.includes("FIXME"));
  if (codeComments.length > 0) f.push({ type: "Commented Code", severity: "MEDIUM", message: `${codeComments.length} HTML comment(s) contain code or sensitive patterns`, evidence: codeComments[0].substring(0, 100) + "...", recommendation: "Remove code comments from production HTML" });
  if (comments.length > 10) f.push({ type: "Excessive Comments", severity: "LOW", message: `${comments.length} HTML comments found - potential info leakage` });
  return { key: "commented_code", label: "Commented Code Detection", findings: f };
}

function testCleartextCredentials(html: string, forms: CrawlData["forms"]): ScanCategory {
  const f: Finding[] = [];
  for (const form of forms) {
    const hasPassword = form.inputs.some(i => i.toLowerCase().includes("pass"));
    if (hasPassword && form.action.startsWith("http://")) f.push({ type: "Cleartext Password", severity: "CRITICAL", url: form.action, message: `Password submitted over HTTP (not HTTPS) to ${form.action}`, recommendation: "Always submit credentials over HTTPS" });
  }
  const lower = html.toLowerCase();
  if (lower.includes('autocomplete="off"') && lower.includes('type="password"')) f.push({ type: "Autocomplete Disabled", severity: "INFO", message: "Password field has autocomplete disabled" });
  return { key: "cleartext_credentials", label: "Cleartext Credentials", findings: f };
}

function testWeakPasswordSubmission(targetUrl: string, forms: CrawlData["forms"]): ScanCategory {
  const f: Finding[] = [];
  for (const form of forms) {
    const hasPassword = form.inputs.some(i => i.toLowerCase().includes("pass"));
    if (hasPassword) {
      const isHttp = form.action.startsWith("http://") || (form.action.startsWith("/") && targetUrl.startsWith("http://"));
      if (isHttp) f.push({ type: "Insecure Password Form", severity: "HIGH", url: form.action, message: "Password form submits over unencrypted HTTP", recommendation: "Use HTTPS for all password submissions" });
    }
  }
  return { key: "weak_password_submission", label: "Weak Password Submission", findings: f };
}

async function testMisconfigurations(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const resp = await safeFetch(targetUrl);
  if (resp) {
    if (resp.headers.get("x-debug") || resp.headers.get("x-debug-token")) f.push({ type: "Debug Mode", severity: "HIGH", message: "Debug headers detected - application may be in debug mode", recommendation: "Disable debug mode in production" });
    if (resp.headers.get("x-aspnetmvc-version")) f.push({ type: "Version Exposure", severity: "LOW", value: resp.headers.get("x-aspnetmvc-version") || "", message: "ASP.NET MVC version exposed" });
  }
  const errorR = await safeFetch(`${base}/nonexistent_page_${Date.now()}`, {}, 4000);
  if (errorR) {
    const errBody = await errorR.text().catch(() => "");
    const lower = errBody.toLowerCase();
    if (lower.includes("stack trace") || lower.includes("traceback") || lower.includes("exception") || lower.includes("debug") || lower.includes("at line")) f.push({ type: "Verbose Error Pages", severity: "MEDIUM", message: "Error pages contain stack traces or debug info", recommendation: "Use generic error pages in production" });
  }
  const wellKnown = await safeFetch(`${base}/.well-known/`, {}, 3000);
  if (wellKnown && wellKnown.status === 200) {
    const t = await wellKnown.text().catch(() => "");
    if (t.includes("Index of")) f.push({ type: ".well-known Listing", severity: "LOW", message: ".well-known directory listing is enabled" });
  }
  return { key: "misconfigurations", label: "Misconfigurations", findings: f };
}

async function testJwtWeaknesses(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const resp = await safeFetch(targetUrl);
  if (!resp) return { key: "jwt_weaknesses", label: "JWT Weaknesses", findings: f };
  const cookies = resp.headers.getSetCookie?.() || [];
  const allValues = cookies.map(c => c.split("=").slice(1).join("=").split(";")[0]);
  for (const val of allValues) {
    if (val.match(/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/)) {
      f.push({ type: "JWT in Cookie", severity: "INFO", message: "JWT token found in cookies" });
      const parts = val.split(".");
      try {
        const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
        if (header.alg === "none" || header.alg === "None") f.push({ type: "JWT None Algorithm", severity: "CRITICAL", message: "JWT uses 'none' algorithm - token can be forged", recommendation: "Enforce a strong signing algorithm (RS256/ES256)" });
        if (header.alg === "HS256") f.push({ type: "JWT Symmetric", severity: "LOW", message: "JWT uses HS256 - ensure secret key is strong", recommendation: "Consider using RS256 for better key management" });
      } catch { /* skip */ }
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (payload.exp && payload.exp * 1000 < Date.now()) f.push({ type: "JWT Expired", severity: "LOW", message: "JWT token is expired but still being served" });
        if (payload.exp && (payload.exp - (payload.iat || 0)) > 86400 * 30) f.push({ type: "JWT Long Expiry", severity: "LOW", message: "JWT has very long expiration (>30 days)", recommendation: "Use shorter token lifetimes" });
      } catch { /* skip */ }
    }
  }
  return { key: "jwt_weaknesses", label: "JWT Weaknesses", findings: f };
}

async function testOpenApiFuzzing(targetUrl: string): Promise<ScanCategory> {
  const f: Finding[] = [];
  const base = new URL(targetUrl).origin;
  const specPaths = ["/swagger.json", "/openapi.json", "/v2/api-docs", "/v3/api-docs"];
  for (const sp of specPaths) {
    const t = await getText(`${base}${sp}`, 4000);
    if (!t || !t.includes("paths")) continue;
    try {
      const spec = JSON.parse(t);
      const paths = Object.keys(spec.paths || {}).slice(0, 5);
      for (const p of paths) {
        const methods = Object.keys(spec.paths[p]);
        for (const method of methods) {
          if (method === "get") {
            const r = await safeFetch(`${base}${p}`, {}, 3000);
            if (r && r.status === 200) f.push({ type: "Unprotected API", severity: "MEDIUM", url: `${base}${p}`, method: method.toUpperCase(), message: `API endpoint ${p} accessible without auth`, recommendation: "Add authentication to API endpoints" });
          }
        }
      }
    } catch { /* invalid json */ }
    break;
  }
  return { key: "openapi_fuzzing", label: "OpenAPI Fuzzing", findings: f };
}

async function runNetwork(targetUrl: string): Promise<ScanCategory[]> {
  const categories: ScanCategory[] = [];

  let host = "";
  try {
    const parsed = new URL(targetUrl);
    host = parsed.hostname;
  } catch {
    return categories;
  }

  const f: Finding[] = [];

  const SERVICE_MAP: Record<number, string> = {
    1:"tcpmux",3:"compressnet",5:"rje",7:"echo",9:"discard",11:"systat",13:"daytime",15:"netstat",
    17:"qotd",19:"chargen",20:"ftp-data",21:"ftp",22:"ssh",23:"telnet",24:"priv-mail",25:"smtp",
    26:"rsftp",30:"unknown",32:"unknown",33:"dsp",37:"time",42:"nameserver",43:"whois",49:"tacacs",
    53:"domain",67:"dhcps",68:"dhcpc",69:"tftp",70:"gopher",79:"finger",80:"http",81:"hosts2-ns",
    82:"xfer",83:"mit-ml-dev",84:"ctf",85:"mit-ml-dev",88:"kerberos-sec",89:"su-mit-tg",90:"dnsix",
    99:"metagram",100:"newacct",102:"iso-tsap",104:"acr-nema",106:"pop3pw",109:"pop2",110:"pop3",
    111:"rpcbind",113:"ident",119:"nntp",123:"ntp",125:"locus-map",135:"msrpc",137:"netbios-ns",
    138:"netbios-dgm",139:"netbios-ssn",143:"imap",144:"news",146:"iso-tp0",161:"snmp",162:"snmptrap",
    163:"cmip-man",179:"bgp",194:"irc",199:"smux",211:"914c-g",212:"anet",220:"imap3",222:"rsh-spx",
    254:"unknown",255:"unknown",256:"fw1-secureremote",259:"esro-gen",264:"bgmp",280:"http-mgmt",
    301:"unknown",306:"unknown",311:"asip-webadmin",340:"unknown",366:"odmr",389:"ldap",406:"imsp",
    407:"timbuktu",416:"silverplatter",417:"onmux",425:"icad-el",427:"svrloc",443:"https",444:"snpp",
    445:"microsoft-ds",458:"appleqtc",464:"kpasswd5",465:"smtps",481:"dvs",497:"retrospect",
    500:"isakmp",502:"modbus",512:"exec",513:"login",514:"shell",515:"printer",524:"ncp",
    530:"courier",540:"uucp",541:"uucp-rlogin",543:"klogin",544:"kshell",545:"ekshell",548:"afp",
    554:"rtsp",555:"dsf",563:"snews",587:"submission",591:"filemaker",593:"http-rpc-epmap",
    616:"sco-sysmgr",617:"sco-dtmgr",623:"oob-ws-http",625:"apple-xsrvr-admin",631:"ipp",
    636:"ldapssl",646:"ldp",648:"rrp",666:"doom",667:"disclose",668:"mecomm",683:"corba-iiop",
    687:"asipregistry",691:"resvc",700:"epp",705:"agentx",711:"cisco-tdp",714:"iris-xpcs",
    720:"unknown",722:"unknown",726:"unknown",749:"kerberos-adm",765:"webster",777:"multiling-http",
    783:"spamassassin",787:"qsc",800:"mdbs-daemon",801:"device",808:"ccproxy-http",843:"unknown",
    860:"iscsi",873:"rsync",880:"unknown",888:"accessbuilder",898:"sun-manageconsole",
    900:"omginitialrefs",901:"samba-swat",902:"iss-realsecure",903:"iss-console-mgr",911:"xact-backup",
    912:"apex-mesh",981:"unknown",987:"unknown",990:"ftps",992:"telnets",993:"imaps",995:"pop3s",
    999:"garcon",1000:"cadlock",1001:"webpush",1002:"windows-icfw",1007:"unknown",1009:"unknown",
    1010:"surf",1011:"unknown",1021:"exp1",1022:"exp2",1023:"netvenuechat",1024:"kdm",
    1025:"NFS-or-IIS",1026:"LSA-or-nterm",1027:"IIS",1028:"unknown",1029:"ms-lsa",1030:"iad1",
    1031:"iad2",1032:"iad3",1033:"netinfo",1034:"zincite-a",1035:"multidropper",1036:"nsstp",
    1037:"ams",1038:"mtqp",1039:"sbl",1040:"netsaint",1041:"danf-ak2",1042:"afrog",1043:"boinc",
    1044:"dcutility",1045:"fpitp",1046:"wfremotertm",1047:"neod1",1048:"neod2",1049:"td-postman",
    1050:"java-or-OTGfileshare",1051:"optima-vnet",1052:"ddt",1053:"remote-as",1054:"brvread",
    1055:"ansyslmd",1056:"vfo",1057:"startron",1058:"nim",1059:"nimreg",1060:"polestar",
    1061:"kiosk",1062:"veracity",1063:"kyoceranetdev",1064:"jstel",1065:"syscomlan",1066:"fpo-fns",
    1067:"instl_boots",1068:"instl_bootc",1069:"cognex-insight",1070:"gmrupdateserv",
    1071:"bsquare-voip",1072:"cardax",1073:"bridgecontrol",1074:"warmspotMgmt",1075:"rdrmshc",
    1076:"sns_credit",1077:"imgames",1078:"avocent-proxy",1079:"asprovatalk",1080:"socks",
    1081:"pvuniwien",1082:"amt-esd-prot",1083:"ansoft-lm-1",1084:"ansoft-lm-2",1085:"webobjects",
    1086:"cplscrambler-lg",1087:"cplscrambler-in",1088:"cplscrambler-al",1089:"ff-annunc",
    1090:"ff-fms",1091:"ff-sm",1092:"obrpd",1093:"proofd",1094:"rootd",1095:"nicelink",
    1096:"cnrprotocol",1097:"sunclustermgr",1098:"rmiactivation",1099:"rmiregistry",1100:"mctp",
    1102:"adobeserver-1",1104:"xrl",1105:"ftranhc",1106:"isoipsigport-1",1107:"isoipsigport-2",
    1108:"ratio-adp",1110:"nfsd-status",1111:"lmsocialserver",1112:"msql",1113:"ltp-deepspace",
    1114:"mini-sql",1117:"ardus-mtrns",1119:"bnetgame",1121:"rmpp",1122:"availant-mgr",
    1123:"murray",1124:"hpvmmcontrol",1126:"hpvmmdata",1130:"casp",1131:"caspssl",1132:"kvm-via-ip",
    1137:"trim",1138:"encrypted_admin",1141:"mxomss",1145:"x9-icue",1147:"capioverlan",
    1148:"elfiq-repl",1149:"bvtsonar",1151:"unizensus",1152:"winpoplanmess",1154:"resacommunity",
    1163:"sddp",1164:"qsm-proxy",1165:"qsm-gui",1166:"qsm-remote",1169:"tripwire",
    1174:"fnet-remote-ui",1175:"dossier",1183:"llsurfup-http",1185:"catchpole",1186:"mysql-cluster",
    1187:"alias",1192:"caids-sensor",1198:"cajo-discovery",1199:"dmidi",1201:"nucleus-sand",
    1213:"mpc-lifenet",1216:"etebac5",1217:"hpss-ndapi",1218:"aeroflight-ads",1233:"univ-appserver",
    1234:"hotline",1236:"bvcontrol",1244:"isbconference1",1247:"visionpyramid",1248:"hermes",
    1259:"opennl-voice",1271:"excw",1272:"cspmlockmgr",1277:"miva-mqs",1287:"routematch",
    1296:"dproxy",1300:"h323hostcallsc",1301:"ci3-software-1",1309:"jtag-server",1310:"husky",
    1311:"rxmon",1322:"novation",1328:"ewall",1334:"writesrv",1352:"lotusnotes",1417:"timbuktu-srv1",
    1433:"ms-sql-s",1434:"ms-sql-m",1443:"ies-lm",1455:"esl-lm",1461:"ibm_wrless_lan",
    1494:"citrix-ica",1500:"vlsi-lm",1501:"sas-3",1503:"imtc-mcs",1521:"oracle",1524:"ingreslock",
    1533:"virtual-places",1556:"veritas_pbx",1580:"tn-tl-r1",1583:"simbaexpress",1594:"sixtrak",
    1600:"issd",1641:"invision",1658:"sixnetudr",1666:"netview-aix-6",1687:"nsjtp-ctrl",
    1688:"nsjtp-data",1700:"mps-raft",1717:"fj-hdnet",1718:"h323gatedisc",1719:"h323gatestat",
    1720:"h323q931",1721:"caicci",1723:"pptp",1755:"wms",1761:"landesk-rc",1782:"hp-hcip",
    1783:"unknown",1801:"msmq",1805:"enl-name",1812:"radius",1839:"netopia-vo1",1840:"netopia-vo2",
    1862:"mysql-cm-agent",1863:"msnp",1864:"paradym-31",1875:"westell-stats",1883:"mqtt",
    1900:"upnp",1914:"elm-momentum",1935:"rtmp",1947:"sentinelsrm",1971:"netop-school",
    1972:"intersys-cache",1974:"drp",1984:"bigbrother",1998:"x25-svc-port",1999:"tcp-id-port",
    2000:"cisco-sccp",2001:"dc",2002:"globe",2003:"finger",2004:"mailbox",2005:"deslogin",
    2006:"invokator",2007:"dectalk",2008:"conf",2009:"news",2010:"search",2013:"raid-am",
    2020:"xinupageserver",2021:"servexec",2022:"down",2030:"device2",2033:"glogger",2034:"scoremgr",
    2035:"imsldoc",2038:"objectmanager",2040:"lam",2041:"interbase",2042:"isis",2043:"isis-bcast",
    2045:"cdfunc",2046:"sdfunc",2047:"dls",2048:"dls-monitor",2049:"nfs",2065:"dlsrpn",
    2068:"avocentkvm",2082:"infowave",2083:"radsec",2086:"gnunet",2087:"eli",2096:"nbx-dir",
    2099:"h2250-annex-g",2100:"amiganetfs",2103:"zephyr-clt",2105:"eklogin",2106:"ekshell",
    2107:"msmq-mgmt",2111:"kx",2119:"gsigatekeeper",2121:"ccproxy-ftp",2126:"pktcable-cops",
    2135:"gris",2144:"lv-ffx",2160:"apc-2160",2161:"apc-agent",2170:"eyetv",2179:"vmrdp",
    2181:"eforward",2190:"tivoconnect",2191:"tvbus",2196:"unknown",2200:"ici",2222:"EtherNetIP-1",
    2251:"dif-port",2260:"apc-2260",2288:"netml",2301:"compaqdiag",2323:"3d-nfsd",2366:"qip-login",
    2381:"compaq-https",2382:"ms-olap3",2383:"ms-olap4",2393:"ms-olap1",2394:"ms-olap2",
    2399:"fmpro-fdal",2401:"cvspserver",2492:"groove",2500:"rtsserv",2522:"windb",
    2525:"ms-v-worlds",2557:"nicetec-mgmt",2601:"zebra",2602:"ripd",2604:"ospfd",2605:"bgpd",
    2607:"connection",2608:"wag-service",2638:"sybase",2701:"sms-rcinfo",2702:"sms-xfer",
    2710:"sso-service",2717:"pn-requester",2718:"pn-requester2",2725:"msolap-ptp2",2800:"acc-raid",
    2809:"corbaloc",2811:"gsiftp",2869:"icslap",2875:"dxmessagebase2",2909:"funk-dialout",
    2910:"tdaccess",2920:"roboeda",2967:"symantec-av",2968:"enpp",2998:"iss-realsec",
    3000:"ppp",3001:"nessus",3003:"cgms",3005:"deslogin",3006:"deslogind",3011:"trusted-web",
    3017:"event_listener",3030:"arepa-cas",3031:"eppc",3052:"powerchute",3071:"csd-mgmt-port",
    3077:"orbix-loc-ssl",3128:"squid-http",3168:"poweronnud",3211:"avsecuremgmt",
    3221:"xnm-clear-text",3260:"iscsi",3261:"winshadow",3268:"globalcatLDAP",3269:"globalcatLDAPssl",
    3283:"netassistant",3300:"ceph",3301:"tarantool",3306:"mysql",3322:"active-net",3323:"active-net",
    3324:"active-net",3325:"active-net",3333:"dec-notes",3351:"btrieve",3367:"satvid-datalnk",
    3369:"satvid-datalnk",3370:"satvid-datalnk",3371:"satvid-datalnk",3372:"msdtc",
    3389:"ms-wbt-server",3390:"dsc",3404:"unknown",3476:"nppmp",3493:"nut",3517:"802-11-iapp",
    3527:"beserver-msg-q",3546:"unknown",3551:"apcupsd",3580:"nati-svrloc",3659:"apple-sasl",
    3689:"rendezvous",3690:"svn",3703:"adobeserver-3",3737:"xpanel",3766:"sitewatch-s",
    3784:"bfd-control",3800:"pwgpsi",3801:"ibm-mgr",3809:"apocd",3814:"neto-dcs",3826:"wormux",
    3827:"netmpi",3828:"neteh",3851:"spectraport",3869:"ovsam-mgmt",3871:"avocent-adsap",
    3878:"fotogcad",3880:"igrs",3889:"dandv-tester",3905:"mupdate",3914:"listcrt-port-2",
    3918:"pktcablemmcops",3920:"exasoftport1",3945:"emcads",3971:"lanrevserver",
    3986:"mapper-ws_ethd",3995:"iss-mgmt-ssl",3998:"dnx",4000:"remoteanything",4001:"newoak",
    4002:"mlchat-proxy",4003:"pxc-splr-ft",4004:"pxc-roid",4005:"pxc-pin",4006:"pxc-spvr",
    4045:"lockd",4111:"xgrid",4125:"rww",4126:"ddrepl",4129:"nuauth",4224:"xtell",
    4242:"vrml-multi-use",4279:"vrml-multi-use",4321:"rwhois",4343:"unicall",4443:"pharos",
    4444:"krb524",4445:"upnotifyp",4446:"n1-fwp",4449:"privatewire",4550:"gds-adppiw-db",
    4567:"tram",4662:"edonkey",4848:"appserv-http",4899:"radmin",4900:"hfcs",4998:"maybe-veritas",
    5000:"upnp",5001:"commplex-link",5002:"rfe",5003:"filemaker",5004:"avt-profile-1",
    5009:"airport-admin",5030:"surfpass",5033:"jtnetd-server",5050:"mmcc",5051:"ida-agent",
    5054:"rlm-admin",5060:"sip",5061:"sip-tls",5080:"onscreen",5087:"biotic",5100:"admd",
    5101:"admdog",5102:"admeng",5120:"barracuda-bbs",5190:"aol",5200:"targus-getdata",
    5214:"unknown",5221:"3exmp",5222:"xmpp-client",5225:"hp-server",5226:"hp-status",
    5269:"xmpp-server",5280:"xmpp-bosh",5298:"presence",5357:"wsdapi",5405:"pcduo",
    5414:"statusd",5431:"park-agent",5432:"postgresql",5440:"unknown",5500:"hotline",
    5510:"secureidprop",5544:"unknown",5550:"sdadmind",5555:"freeciv",5560:"isqlplus",
    5566:"westec-connect",5601:"esmagent",5631:"pcanywheredata",5633:"beorl",5666:"nrpe",
    5672:"amqp",5678:"rrac",5679:"activesync",5718:"dpm",5730:"unieng",5800:"vnc-http",
    5801:"vnc-http-1",5802:"vnc-http-2",5810:"unknown",5811:"unknown",5815:"unknown",
    5822:"unknown",5825:"unknown",5850:"unknown",5859:"wherehoo",5862:"unknown",5877:"unknown",
    5900:"vnc",5901:"vnc-1",5902:"vnc-2",5903:"vnc-3",5904:"ag-swim",5906:"rpas-c2",
    5907:"dsd",5910:"cm",5911:"cpdlc",5915:"unknown",5922:"unknown",5925:"unknown",
    5950:"unknown",5952:"unknown",5959:"unknown",5960:"unknown",5961:"unknown",5962:"unknown",
    5963:"indy",5985:"wsman",5986:"wsmans",5987:"wbem-rmi",5988:"wbem-http",5989:"wbem-https",
    5998:"ncd-diag",5999:"ncd-conf",6000:"X11",6001:"X11:1",6002:"X11:2",6003:"X11:3",
    6004:"X11:4",6005:"X11:5",6006:"X11:6",6007:"X11:7",6009:"X11:9",6025:"x11",6059:"X11:59",
    6100:"synchronet-db",6101:"backupexec",6106:"isdninfo",6112:"dtspc",6123:"backup-express",
    6129:"unknown",6156:"unknown",6346:"gnutella",6389:"clariion-evr01",6502:"netop-rc",
    6510:"mcer-port",6543:"mythtv",6547:"powerchuteplus",6565:"unknown",6566:"sane-port",
    6567:"esp",6580:"parsec-master",6646:"unknown",6666:"irc",6667:"irc",6668:"irc",6669:"irc",
    6689:"tsa",6692:"unknown",6699:"napster",6779:"unknown",6788:"smc-http",
    6789:"ibm-db2-admin",6792:"unknown",6839:"unknown",6881:"bittorrent-tracker",6901:"jetstream",
    6969:"acmsoda",7000:"afs3-fileserver",7001:"afs3-callback",7002:"afs3-prserver",
    7004:"afs3-kaserver",7007:"afs3-bos",7019:"doceri-ctl",7025:"vmsvc-2",7070:"realserver",
    7100:"font-service",7103:"unknown",7106:"unknown",7200:"fodms",7201:"dlip",7402:"rtps-dd-mt",
    7435:"unknown",7443:"oracleas-https",7496:"unknown",7512:"unknown",7625:"unknown",
    7627:"soap-http",7676:"imqbrokerd",7741:"scriptview",7777:"cbt",7778:"interwise",7800:"asr",
    7911:"unknown",7920:"unknown",7921:"unknown",7937:"nsrexecd",7938:"lgtomapper",7999:"irdmi2",
    8000:"http-alt",8001:"vcom-tunnel",8002:"teradataordbms",8007:"ajp12",8008:"http",
    8009:"ajp13",8010:"xmpp",8011:"unknown",8021:"ftp-proxy",8022:"oa-system",8031:"unknown",
    8042:"fs-agent",8045:"unknown",8080:"http-proxy",8081:"blackice-icecap",8082:"blackice-alerts",
    8083:"us-srv",8084:"websnp",8085:"unknown",8086:"d-s-n",8087:"simplifymedia",8088:"radan-http",
    8089:"unknown",8090:"opsmessaging",8093:"unknown",8099:"unknown",8100:"xprint-server",
    8180:"unknown",8181:"intermapper",8192:"sophos",8193:"sophos",8194:"sophos",8200:"trivnet1",
    8222:"unknown",8254:"unknown",8290:"unknown",8291:"winbox",8292:"blp3",8300:"tmi",
    8333:"bitcoin",8383:"m2mservices",8400:"cvd",8402:"abarsd",8443:"https-alt",8500:"fmtp",
    8600:"asterix",8649:"unknown",8651:"unknown",8652:"unknown",8654:"unknown",8701:"unknown",
    8800:"sunwebadmin",8873:"dxspider",8888:"sun-answerbook",8899:"ospf-lite",8994:"unknown",
    9000:"cslistener",9001:"tor-orport",9002:"dynamid",9003:"unknown",9009:"pichat",9010:"sdr",
    9011:"d-star",9040:"tor-trans",9050:"tor-socks",9071:"unknown",9080:"glrpc",
    9081:"cisco-aqos",9090:"zeus-admin",9091:"xmltec-xmlmail",9099:"unknown",9100:"jetdirect",
    9101:"jetdirect",9102:"jetdirect",9103:"jetdirect",9110:"unknown",9111:"DragonIDSConsole",
    9200:"wap-wsp",9207:"wap-vcal-s",9220:"unknown",9290:"unknown",9415:"unknown",9418:"git",
    9485:"unknown",9500:"ismserver",9502:"unknown",9503:"unknown",9535:"man",9575:"unknown",
    9593:"cba8",9594:"msgsys",9595:"pds",9618:"condor",9666:"zoomcp",9876:"sd",9877:"x510",
    9878:"kca-service",9898:"monkeycom",9900:"iua",9917:"unknown",9929:"nping-echo",
    9943:"unknown",9944:"unknown",9968:"unknown",9998:"distinct32",9999:"abyss",
    10000:"snet-sensor-mgmt",10001:"scp-config",10002:"documentum",10003:"documentum_s",
    10004:"emcrmirccd",10009:"swdtp-sv",10010:"rxapi",10012:"unknown",10024:"unknown",
    10025:"unknown",10082:"amandaidx",10180:"unknown",10215:"unknown",10243:"unknown",
    10566:"unknown",10616:"unknown",10617:"unknown",10621:"unknown",10626:"unknown",
    10628:"unknown",10629:"unknown",10778:"unknown",11110:"sgi-soap",11111:"vce",
    11211:"memcache",11967:"sysinfo-sp",12000:"cce4x",12174:"unknown",12265:"unknown",
    12345:"netbus",13456:"unknown",13722:"netbackup",13782:"netbackup",13783:"netbackup",
    14000:"scotty-ft",14238:"unknown",14441:"unknown",14442:"unknown",15000:"hydap",
    15002:"onep-tls",15003:"unknown",15004:"unknown",15660:"bex-xr",15672:"unknown",
    15742:"unknown",16000:"fmsas",16001:"fmsascon",16012:"unknown",16016:"unknown",
    16018:"unknown",16080:"osxwebadmin",16113:"unknown",16992:"amt-soap-http",
    16993:"amt-soap-https",17877:"unknown",17988:"unknown",18040:"unknown",18101:"unknown",
    18988:"unknown",19101:"unknown",19283:"keysrvr",19315:"keyshadow",19350:"unknown",
    19780:"unknown",19801:"unknown",19842:"unknown",20000:"dnp",20005:"btx",20031:"unknown",
    20221:"unknown",20222:"ipulse-ics",20828:"unknown",21571:"unknown",22939:"unknown",
    23502:"unknown",24444:"unknown",24800:"unknown",25734:"unknown",25735:"unknown",
    26214:"unknown",27000:"flexlm0",27017:"mongod",27018:"mongod",27352:"unknown",
    27353:"unknown",27355:"unknown",27356:"unknown",27715:"unknown",28017:"mongod",
    28201:"unknown",30000:"ndmps",30718:"unknown",30951:"unknown",31038:"unknown",31337:"Elite",
    32768:"filenet-tms",32769:"filenet-rpc",32770:"sometimes-rpc3",32771:"sometimes-rpc5",
    32772:"sometimes-rpc7",32773:"sometimes-rpc9",32774:"sometimes-rpc11",32775:"sometimes-rpc13",
    32776:"sometimes-rpc15",32777:"sometimes-rpc17",32778:"sometimes-rpc19",32779:"sometimes-rpc21",
    32780:"sometimes-rpc23",32781:"unknown",32782:"unknown",32783:"unknown",32784:"unknown",
    32785:"unknown",33354:"unknown",33899:"unknown",34571:"unknown",34572:"unknown",
    34573:"unknown",35500:"unknown",38292:"landesk-cba",40193:"unknown",40911:"unknown",
    41511:"unknown",42510:"caerpc",44176:"unknown",44442:"coldfusion-auth",44443:"coldfusion-auth",
    44501:"unknown",45100:"unknown",48080:"unknown",49152:"unknown",49153:"unknown",
    49154:"unknown",49155:"unknown",49156:"unknown",49157:"unknown",49158:"unknown",
    49159:"unknown",49160:"unknown",49161:"unknown",49163:"unknown",49165:"unknown",
    49167:"unknown",49175:"unknown",49176:"unknown",49400:"compaqdiag",49999:"unknown",
    50000:"ibm-db2",50001:"unknown",50002:"iiimsf",50003:"unknown",50006:"unknown",
    50300:"unknown",50389:"unknown",50500:"unknown",50636:"unknown",50800:"unknown",
    51103:"unknown",51493:"unknown",52673:"unknown",52822:"unknown",52848:"unknown",
    52869:"unknown",54045:"unknown",54328:"unknown",55055:"unknown",55056:"unknown",
    55555:"unknown",55600:"unknown",56737:"unknown",56738:"unknown",57294:"unknown",
    57797:"unknown",58080:"unknown",60020:"unknown",60443:"unknown",61532:"unknown",
    61900:"unknown",62078:"iphone-sync",63331:"unknown",64623:"unknown",64680:"unknown",
    65000:"unknown",65129:"unknown",65389:"unknown",
  };

  const allPorts = Object.keys(SERVICE_MAP).map(Number).sort((a, b) => a - b);

  const BATCH_SIZE = 100;
  const PORT_TIMEOUT = 1500;
  const SCAN_MAX_TIME = 50000;
  const scanStart = Date.now();

  interface PortResult { port: number; service: string; state: "open" | "closed" | "filtered"; }
  const results: PortResult[] = [];
  let scannedCount = 0;

  for (let i = 0; i < allPorts.length; i += BATCH_SIZE) {
    if (Date.now() - scanStart > SCAN_MAX_TIME) break;
    const batch = allPorts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (port) => {
        const state = await testPort(host, port, PORT_TIMEOUT);
        return { port, service: SERVICE_MAP[port] || "unknown", state };
      })
    );
    results.push(...batchResults);
    scannedCount += batch.length;
  }

  const openPorts = results.filter(r => r.state === "open").sort((a, b) => a.port - b.port);
  const filteredPorts = results.filter(r => r.state === "filtered").sort((a, b) => a.port - b.port);
  const closedCount = results.filter(r => r.state === "closed").length;

  const dangerousPorts = new Set([21,23,25,110,143,445,512,513,514,1099,1433,1434,1521,1524,
    2049,3306,3389,4444,5432,5555,5900,6000,6379,6667,9200,11211,27017,27018,28017,31337,
    12345,44442,44443,50000]);
  const remotePorts = new Set([22,23,3389,5800,5900,5901,5902,5903,2179,4899]);
  const warnPorts = new Set([135,137,138,139,161,162,389,636,1080,2121,3128,5060,8080,8443,9090]);

  const sevOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };

  const openFindings: Finding[] = [];
  for (const { port, service } of openPorts) {
    let severity = "INFO";
    let message = `Port ${port}/${service} is open`;
    let recommendation = "";

    if (dangerousPorts.has(port)) {
      severity = "HIGH";
      message = `Port ${port}/${service} is open - potential security risk`;
      recommendation = "Close this service or restrict access via firewall. Commonly targeted by attackers.";
    } else if (remotePorts.has(port)) {
      severity = "MEDIUM";
      message = `Port ${port}/${service} is open - remote access enabled`;
      recommendation = "Ensure strong authentication and consider IP whitelisting";
    } else if (warnPorts.has(port)) {
      severity = "LOW";
      message = `Port ${port}/${service} is open - review access controls`;
      recommendation = "Verify this service is required and properly configured";
    }

    openFindings.push({ type: "Open Port", severity, port, service, status: "open", message, recommendation });
  }
  openFindings.sort((a, b) => (sevOrder[a.severity] ?? 99) - (sevOrder[b.severity] ?? 99));

  f.push(...openFindings);

  if (filteredPorts.length > 0 && filteredPorts.length <= 30) {
    for (const { port, service } of filteredPorts) {
      f.push({
        type: "Filtered Port",
        severity: "MEDIUM",
        port,
        service,
        status: "filtered",
        message: `Port ${port}/${service} is filtered (firewall blocking)`,
        recommendation: "A firewall or security device is filtering this port. Verify the firewall rules are intentional.",
      });
    }
  } else if (filteredPorts.length > 30) {
    const sample = filteredPorts.slice(0, 10).map(p => p.port).join(", ");
    f.push({
      type: "Filtered Ports",
      severity: "MEDIUM",
      status: "filtered",
      message: `${filteredPorts.length} ports are filtered (firewall blocking traffic)`,
      value: `Includes ports: ${sample} and ${filteredPorts.length - 10} more`,
      recommendation: "A firewall is actively filtering these ports. Review firewall rules to ensure they match your security policy.",
    });
  }

  if (closedCount > 0) {
    f.push({
      type: "Closed Ports",
      severity: "GOOD",
      status: "closed",
      message: `${closedCount} port${closedCount > 1 ? "s" : ""} closed (connection refused - no service listening)`,
      value: `${closedCount} closed out of ${scannedCount} scanned`,
    });
  }

  f.push({
    type: "Port Scan Summary",
    severity: openPorts.length === 0 && filteredPorts.length === 0 ? "GOOD" : "INFO",
    message: `Scanned ${scannedCount} ports: ${openPorts.length} open, ${filteredPorts.length} filtered, ${closedCount} closed`,
    value: `${openPorts.length} open | ${filteredPorts.length} filtered | ${closedCount} closed`,
  });

  categories.push({ key: "network_scan", label: `Network Port Scan (${scannedCount} ports)`, findings: f });
  return categories;
}
