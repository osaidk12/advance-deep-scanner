import type { ScanMode, ScanResult, ScanCategory, ScanProgress } from '../types/scanner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface CrawlData {
  urls: string[];
  forms: { action: string; method: string; inputs: string[] }[];
  params: { url: string; params: string[] }[];
  html: string;
}

interface GroupConfig {
  group: string;
  label: string;
  testCount: number;
  needsCrawlData?: boolean;
}

const LIGHT_GROUPS: GroupConfig[] = [
  { group: 'recon', label: 'Reconnaissance', testCount: 11 },
];

const DEEP_GROUPS: GroupConfig[] = [
  { group: 'recon', label: 'Reconnaissance', testCount: 11 },
  { group: 'discovery', label: 'Discovery & Crawling', testCount: 9 },
  { group: 'injection', label: 'Injection Testing', testCount: 12, needsCrawlData: true },
  { group: 'advanced', label: 'Advanced Attacks', testCount: 9, needsCrawlData: true },
  { group: 'files', label: 'File & Config Analysis', testCount: 13, needsCrawlData: true },
];

const NETWORK_GROUPS: GroupConfig[] = [
  { group: 'network', label: 'Network Port Scan', testCount: 12 },
];

const GROUP_TESTS: Record<string, string[]> = {
  recon: [
    'Web Server Fingerprint',
    'HTTP Security Headers',
    'Cookie Security',
    'SSL/TLS Certificate',
    'Known Vulnerabilities',
    'Robots.txt Analysis',
    'Client Access Policy',
    'Directory Listing',
    'HTTP Methods',
    'Security.txt',
    'CORS Configuration',
  ],
  discovery: [
    'URL Crawling',
    'Technology Detection',
    'Port Scanning',
    'Login Interfaces',
    'OpenAPI/Swagger Docs',
    'GraphQL Endpoints',
    'Admin Pages',
    'Domain Info Sources',
    'Sensitive Data Crawling',
  ],
  injection: [
    'SQL Injection',
    'NoSQL Injection',
    'XSS (Cross-Site Scripting)',
    'Local File Inclusion',
    'Remote File Inclusion',
    'Command Injection',
    'Code Injection',
    'Server-Side Template Injection',
    'Log4j / Log4Shell',
    'ASP Cookieless XSS',
    'Client-Side Template Injection',
    'Prototype Pollution',
  ],
  advanced: [
    'SSRF Detection',
    'Open Redirect',
    'Broken Authentication',
    'ViewState Deserialization',
    'HTTP Request Smuggling',
    'CSRF Detection',
    'Insecure Deserialization',
    'Session Fixation',
    'IDOR Detection',
  ],
  files: [
    'Sensitive Files Exposure',
    'Backup Files',
    'Outdated Libraries',
    'Information Disclosure',
    'Commented Code / Debug Info',
    'Cleartext Credentials',
    'Weak Password Submission',
    'Misconfigurations',
    'JWT Weaknesses',
    'URL Override / Host Header',
    'OpenAPI Endpoint Fuzzing',
    'Security Headers Deep Check',
    'Cookie Attribute Audit',
  ],
  network: [
    'Scanning system ports (1-100)',
    'Scanning well-known services (100-500)',
    'Scanning registered ports (500-1024)',
    'Scanning high-range ports (1025-2000)',
    'Scanning database & app ports (2000-5000)',
    'Scanning remote access ports (5000-7000)',
    'Scanning web server ports (7000-9000)',
    'Scanning management ports (9000-15000)',
    'Scanning enterprise ports (15000-30000)',
    'Scanning dynamic/ephemeral ports (30000-65535)',
    'Analyzing open services',
    'Compiling results',
  ],
};

async function callScanGroup(
  url: string,
  group: string,
  crawlData?: CrawlData
): Promise<{ categories: ScanCategory[]; crawl_data?: CrawlData }> {
  const apiUrl = `${SUPABASE_URL}/functions/v1/scan`;
  const payload: Record<string, unknown> = { url, group };
  if (crawlData) payload.crawl_data = crawlData;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Scan failed' }));
    throw new Error(err.error || `Server responded with ${response.status}`);
  }

  const data = await response.json();
  return { categories: data.categories || [], crawl_data: data.crawl_data };
}

export async function runScan(
  url: string,
  mode: ScanMode,
  onProgress: (progress: ScanProgress) => void
): Promise<ScanResult> {
  const groups = mode === 'deep' ? DEEP_GROUPS : mode === 'network' ? NETWORK_GROUPS : LIGHT_GROUPS;
  const totalTests = groups.reduce((sum, g) => sum + g.testCount, 0);
  let completedTests = 0;
  const allCategories: ScanCategory[] = [];
  let crawlData: CrawlData | undefined;
  const startTime = Date.now();

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const testNames = GROUP_TESTS[g.group] || [];

    let testTick = 0;
    const tickInterval = setInterval(() => {
      if (testTick < testNames.length) {
        onProgress({
          currentTest: testNames[testTick],
          progress: ((completedTests + testTick) / totalTests) * 100,
          totalTests,
          completedTests: completedTests + testTick,
          currentGroup: g.label,
          groupIndex: i + 1,
          totalGroups: groups.length,
          elapsed: Math.floor((Date.now() - startTime) / 1000),
        });
        testTick++;
      }
    }, 1200);

    onProgress({
      currentTest: testNames[0] || g.label,
      progress: (completedTests / totalTests) * 100,
      totalTests,
      completedTests,
      currentGroup: g.label,
      groupIndex: i + 1,
      totalGroups: groups.length,
      elapsed: Math.floor((Date.now() - startTime) / 1000),
    });

    try {
      const result = await callScanGroup(
        url,
        g.group,
        g.needsCrawlData ? crawlData : undefined
      );

      if (g.group === 'discovery' && result.crawl_data) {
        crawlData = result.crawl_data;
      }

      allCategories.push(...result.categories);
    } catch (e) {
      allCategories.push({
        key: `${g.group}_error`,
        label: `${g.label} (Error)`,
        findings: [
          {
            type: 'Scan Error',
            severity: 'INFO',
            message: e instanceof Error ? e.message : 'Group scan failed',
          },
        ],
      });
    } finally {
      clearInterval(tickInterval);
    }

    completedTests += g.testCount;
  }

  onProgress({
    currentTest: 'Complete',
    progress: 100,
    totalTests,
    completedTests: totalTests,
    currentGroup: 'Done',
    groupIndex: groups.length,
    totalGroups: groups.length,
    elapsed: Math.floor((Date.now() - startTime) / 1000),
  });

  return {
    target: url,
    scan_mode: mode,
    timestamp: new Date().toISOString(),
    categories: allCategories,
  };
}
