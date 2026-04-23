import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ScanCategory } from '../types/scanner';
import { getHighestSeverity, getSeverityDot } from '../utils/severityUtils';
import FindingRow from './FindingRow';

interface CategoryCardProps {
  category: ScanCategory;
  index: number;
}

export default function CategoryCard({ category, index }: CategoryCardProps) {
  const [open, setOpen] = useState(index < 3);
  const highest = getHighestSeverity(category.findings);

  return (
    <div
      className="animate-slide-up overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50 transition-colors hover:border-slate-700/80"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/30"
      >
        <div className={`h-2 w-2 rounded-full ${getSeverityDot(highest)}`} />
        <span className="flex-1 text-sm font-medium text-slate-200">{category.label}</span>
        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">
          {category.findings.length}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-800/50">
          {category.findings.map((finding, i) => (
            <FindingRow key={i} finding={finding} />
          ))}
        </div>
      )}
    </div>
  );
}
