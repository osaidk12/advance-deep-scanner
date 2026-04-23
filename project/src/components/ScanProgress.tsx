import { Loader2 } from 'lucide-react';
import type { ScanProgress as ScanProgressType } from '../types/scanner';

interface ScanProgressProps {
  progress: ScanProgressType;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ScanProgressDisplay({ progress }: ScanProgressProps) {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          <div className="absolute inset-0 h-5 w-5 animate-ping rounded-full bg-cyan-400/20" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Scanning in progress</p>
          <p className="text-xs text-slate-500">
            {progress.completedTests} of {progress.totalTests} tests completed
          </p>
        </div>
      </div>

      {progress.currentGroup && progress.totalGroups && progress.totalGroups > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Phase {progress.groupIndex} of {progress.totalGroups}: {progress.currentGroup}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: progress.totalGroups }).map((_, idx) => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  idx < (progress.groupIndex || 0)
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-500'
                    : idx === (progress.groupIndex || 0) - 1
                      ? 'bg-cyan-500/50 animate-pulse'
                      : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="font-mono text-cyan-400">{progress.currentTest}</span>
          <span className="text-slate-500">{Math.round(progress.progress)}%</span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500 ease-out"
            style={{ width: `${progress.progress}%` }}
          />
          <div className="absolute inset-0 h-full animate-scan-line bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Elapsed', value: formatElapsed(progress.elapsed ?? 0) },
          { label: 'Tests Run', value: String(progress.completedTests) },
          { label: 'Remaining', value: String(progress.totalTests - progress.completedTests) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2 text-center"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{stat.label}</p>
            <p className="mt-0.5 font-mono text-sm text-slate-300">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
