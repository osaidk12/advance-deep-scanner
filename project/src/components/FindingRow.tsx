import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Finding } from '../types/scanner';
import SeverityBadge from './SeverityBadge';
import { SecurityRecommendation } from './SecurityRecommendation';

interface FindingRowProps {
  finding: Finding;
}

export default function FindingRow({ finding }: FindingRowProps) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails =
    finding.payload || finding.location || finding.evidence ||
    finding.recommendation || finding.value || finding.issues ||
    finding.paths || finding.url || finding.file || finding.risk ||
    finding.how_to_fix || finding.defense_tips;

  return (
    <div className="border-b border-slate-800/50 last:border-0">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
          hasDetails ? 'cursor-pointer hover:bg-slate-800/30' : 'cursor-default'
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {hasDetails ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            )
          ) : (
            <div className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            {finding.status && (finding.status === 'open' || finding.status === 'filtered' || finding.status === 'closed') && (
              <PortStateBadge state={finding.status as 'open' | 'filtered' | 'closed'} />
            )}
            <span className="text-xs font-medium text-slate-300">{finding.type}</span>
            {finding.port !== undefined && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                {finding.port}/tcp
              </span>
            )}
          </div>
          {finding.message && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{finding.message}</p>
          )}
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="animate-slide-up border-t border-slate-800/30 bg-slate-900/50 px-4 py-3 pl-11">
          <dl className="space-y-2 text-xs">
            {finding.value && <Detail label="Value" value={finding.value} />}
            {finding.location && <Detail label="Location" value={finding.location} mono />}
            {finding.payload && <Detail label="Payload" value={finding.payload} mono />}
            {finding.evidence && <Detail label="Evidence" value={finding.evidence} />}
            {finding.recommendation && <Detail label="Recommendation" value={finding.recommendation} />}
            {finding.file && <Detail label="File" value={finding.file} mono />}
            {finding.url && <Detail label="URL" value={finding.url} mono />}
            {finding.issues && (
              <div>
                <dt className="mb-1 font-medium text-slate-400">Issues</dt>
                <dd className="space-y-1">
                  {finding.issues.map((issue, i) => (
                    <span
                      key={i}
                      className="mr-2 inline-block rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-slate-400"
                    >
                      {issue}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {finding.paths && (
              <div>
                <dt className="mb-1 font-medium text-slate-400">Paths</dt>
                <dd className="space-y-1 font-mono text-slate-400">
                  {finding.paths.map((p, i) => (
                    <div key={i}>{p}</div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          <SecurityRecommendation finding={finding} />
        </div>
      )}
    </div>
  );
}

function PortStateBadge({ state }: { state: 'open' | 'filtered' | 'closed' }) {
  const styles = {
    open: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
    filtered: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
    closed: 'bg-slate-500/15 border-slate-500/40 text-slate-400',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[state]}`}>
      {state}
    </span>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-medium text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-slate-500 ${mono ? 'break-all font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
