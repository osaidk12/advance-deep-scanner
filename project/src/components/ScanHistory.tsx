import { Clock, ExternalLink } from 'lucide-react';
import type { ScanHistoryEntry } from '../types/scanner';

interface ScanHistoryProps {
  history: ScanHistoryEntry[];
  onSelect: (entry: ScanHistoryEntry) => void;
}

export default function ScanHistory({ history, onSelect }: ScanHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-medium text-slate-400">Recent Scans</h3>
      </div>
      <div className="space-y-2">
        {history.map((entry) => (
          <button
            key={entry.scan_id}
            onClick={() => onSelect(entry)}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/20 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-800/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-300">{entry.url}</p>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-600">
                <span className="uppercase">{entry.scan_mode} scan</span>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {entry.critical > 0 && (
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                  {entry.critical}C
                </span>
              )}
              {entry.high > 0 && (
                <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold text-orange-400">
                  {entry.high}H
                </span>
              )}
              <span className="text-[10px] tabular-nums text-slate-500">
                {entry.total_vulnerabilities} total
              </span>
              <ExternalLink className="h-3 w-3 text-slate-600" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
