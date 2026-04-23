import {
  FileDown,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Target,
  Clock,
  Layers,
} from 'lucide-react';
import type { ScanResult } from '../types/scanner';
import { countBySeverity, SEVERITY_ORDER, getSeverityBg } from '../utils/severityUtils';
import { generatePdfReport } from '../utils/pdfReport';
import CategoryCard from './CategoryCard';
import { SecuritySummary } from './SecuritySummary';

interface ScanResultsProps {
  result: ScanResult;
  onNewScan: () => void;
}

export default function ScanResults({ result, onNewScan }: ScanResultsProps) {
  const counts = countBySeverity(result.categories);
  const totalFindings = Object.values(counts).reduce((a, b) => a + b, 0);
  const hasCritical = counts.CRITICAL > 0 || counts.HIGH > 0;

  function handleDownloadPdf() {
    generatePdfReport(result);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {hasCritical ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <ShieldAlert className="h-5 w-5 text-red-400" />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-white">Scan Complete</h2>
            <p className="text-xs text-slate-500">
              {totalFindings} findings across {result.categories.length} categories
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNewScan}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New Scan
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-teal-500"
          >
            <FileDown className="h-3.5 w-3.5" />
            Download PDF Report
          </button>
        </div>
      </div>

      <div className={`grid gap-3 ${result.resolved_ip ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <InfoTile icon={<Target className="h-4 w-4 text-cyan-400" />} label="Target" value={result.target} />
        {result.resolved_ip && (
          <InfoTile icon={<Target className="h-4 w-4 text-emerald-400" />} label="IP Address" value={result.resolved_ip} />
        )}
        <InfoTile
          icon={<Clock className="h-4 w-4 text-cyan-400" />}
          label="Completed"
          value={new Date(result.timestamp).toLocaleTimeString()}
        />
        <InfoTile
          icon={<Layers className="h-4 w-4 text-cyan-400" />}
          label="Scan Mode"
          value={result.scan_mode.toUpperCase()}
        />
      </div>

      {result.security_summary && (
        <SecuritySummary summary={result.security_summary} />
      )}

      <div className="flex flex-wrap gap-2">
        {SEVERITY_ORDER.map((sev) =>
          counts[sev] > 0 ? (
            <div
              key={sev}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${getSeverityBg(sev)}`}
            >
              <span className="text-lg font-bold tabular-nums">{counts[sev]}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                {sev}
              </span>
            </div>
          ) : null
        )}
      </div>

      <div className="space-y-2">
        {result.categories.map((cat, i) => (
          <CategoryCard key={cat.key} category={cat} index={i} />
        ))}
      </div>

      <div className="flex justify-center pt-2">
        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-teal-500 hover:shadow-cyan-500/30"
        >
          <FileDown className="h-4 w-4" />
          Download Full PDF Report
        </button>
      </div>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <p className="truncate text-xs font-medium text-slate-300">{value}</p>
    </div>
  );
}
