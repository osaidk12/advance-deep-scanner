export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | 'GOOD';

export type ScanMode = 'light' | 'deep' | 'network';

export type ScanStatus = 'idle' | 'scanning' | 'completed' | 'error';

export interface Finding {
  type: string;
  severity: Severity;
  message?: string;
  value?: string;
  location?: string;
  payload?: string;
  evidence?: string;
  recommendation?: string;
  risk?: string;
  how_to_fix?: string[];
  defense_tips?: string[];
  header?: string;
  cookie_name?: string;
  issues?: string[];
  file?: string;
  url?: string;
  method?: string;
  status_code?: number;
  paths?: string[];
  port?: number;
  service?: string;
  status?: string;
  cms?: string;
  description?: string;
  parameter?: string;
  size?: number;
  [key: string]: unknown;
}

export interface ScanCategory {
  key: string;
  label: string;
  findings: Finding[];
}

export interface SecuritySummary {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  security_score: number;
  priority_actions?: Array<{
    priority: string;
    action: string;
    issues: string[];
  }>;
  quick_wins?: string[];
}

export interface ScanResult {
  target: string;
  resolved_ip?: string | null;
  scan_mode: ScanMode;
  timestamp: string;
  categories: ScanCategory[];
  security_summary?: SecuritySummary;
}

export interface ScanHistoryEntry {
  scan_id: string;
  url: string;
  scan_mode: ScanMode;
  timestamp: string;
  total_vulnerabilities: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ScanProgress {
  currentTest: string;
  progress: number;
  totalTests: number;
  completedTests: number;
  currentGroup?: string;
  groupIndex?: number;
  totalGroups?: number;
  elapsed?: number;
}
