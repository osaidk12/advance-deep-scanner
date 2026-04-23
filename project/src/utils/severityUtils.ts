import type { Severity, Finding, ScanCategory } from '../types/scanner';

export const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'GOOD'];

export function getSeverityColor(severity: Severity): string {
  const map: Record<Severity, string> = {
    CRITICAL: 'text-red-400',
    HIGH: 'text-orange-400',
    MEDIUM: 'text-amber-400',
    LOW: 'text-sky-400',
    INFO: 'text-slate-400',
    GOOD: 'text-emerald-400',
  };
  return map[severity] || 'text-slate-400';
}

export function getSeverityBg(severity: Severity): string {
  const map: Record<Severity, string> = {
    CRITICAL: 'bg-red-500/10 border-red-500/30 text-red-400',
    HIGH: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    MEDIUM: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    LOW: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
    INFO: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    GOOD: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  };
  return map[severity] || 'bg-slate-500/10 border-slate-500/30 text-slate-400';
}

export function getSeverityDot(severity: Severity): string {
  const map: Record<Severity, string> = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-amber-500',
    LOW: 'bg-sky-500',
    INFO: 'bg-slate-500',
    GOOD: 'bg-emerald-500',
  };
  return map[severity] || 'bg-slate-500';
}

export function countBySeverity(categories: ScanCategory[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
    GOOD: 0,
  };

  for (const cat of categories) {
    for (const f of cat.findings) {
      if (f.severity in counts) {
        counts[f.severity]++;
      }
    }
  }

  return counts;
}

export function getHighestSeverity(findings: Finding[]): Severity {
  for (const s of SEVERITY_ORDER) {
    if (findings.some((f) => f.severity === s)) return s;
  }
  return 'INFO';
}

export function getCategoryIcon(key: string): string {
  const iconMap: Record<string, string> = {
    web_server_fingerprint: 'Server',
    http_headers_security: 'Shield',
    cookie_security: 'Cookie',
    ssl_certificate: 'Lock',
    known_vulnerabilities: 'AlertTriangle',
    robots_txt: 'FileSearch',
    client_access_policy: 'FileKey',
    directory_listing: 'FolderOpen',
    http_methods: 'ArrowLeftRight',
    security_txt: 'FileText',
    cors_configuration: 'Globe',
    sql_injection: 'Database',
    xss: 'Code',
    file_inclusion: 'FileWarning',
    command_injection: 'Terminal',
    ssrf: 'ExternalLink',
    open_redirect: 'CornerUpRight',
    csrf: 'ShieldOff',
    ssti: 'Braces',
    log4j_rce: 'Bug',
    backup_files: 'Archive',
    outdated_libraries: 'PackageOpen',
    admin_pages: 'KeyRound',
    sensitive_files: 'FileWarning',
    graphql_endpoints: 'Workflow',
    information_disclosure: 'Eye',
    nosql_injection: 'Database',
    jwt_weaknesses: 'Key',
    misconfigurations: 'Settings',
    prototype_pollution: 'Code',
    crawled_urls: 'Search',
    technology_detection: 'Cpu',
    port_scan: 'Radio',
    login_interfaces: 'LogIn',
    openapi_docs: 'FileCode',
    domain_sources: 'Globe',
    sensitive_data_crawling: 'ScanSearch',
    code_injection: 'Terminal',
    asp_cookieless_xss: 'Code',
    client_template_injection: 'Braces',
    url_override: 'Link',
    broken_auth: 'ShieldOff',
    viewstate_rce: 'AlertTriangle',
    http_smuggling: 'Split',
    insecure_deserialization: 'PackageOpen',
    session_fixation: 'Fingerprint',
    idor: 'Users',
    commented_code: 'MessageSquare',
    cleartext_credentials: 'KeyRound',
    weak_password_submission: 'Lock',
    openapi_fuzzing: 'Zap',
    security_headers_deep: 'ShieldCheck',
    cookie_audit: 'Cookie',
    network_scan: 'Network',
  };
  return iconMap[key] || 'Shield';
}
