import type { Severity } from '../types/scanner';
import { getSeverityBg } from '../utils/severityUtils';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md';
}

export default function SeverityBadge({ severity, size = 'sm' }: SeverityBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-semibold uppercase tracking-wider ${getSeverityBg(severity)} ${sizeClasses}`}
    >
      {severity}
    </span>
  );
}
