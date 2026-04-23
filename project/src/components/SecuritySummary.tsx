import { Shield, AlertTriangle, Clock, CheckCircle2, TrendingUp } from 'lucide-react';

interface SecuritySummaryProps {
  summary: {
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
  };
}

export function SecuritySummary({ summary }: SecuritySummaryProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreRing = (score: number) => {
    if (score >= 80) return 'stroke-green-500';
    if (score >= 60) return 'stroke-yellow-500';
    if (score >= 40) return 'stroke-orange-500';
    return 'stroke-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 40) return 'Poor';
    return 'Critical';
  };

  return (
    <div className="mb-6 rounded-xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="mb-1 text-lg font-semibold text-white">Security Assessment Summary</h3>
          <p className="text-sm text-slate-400">Prioritized actions and defensive guidance</p>
        </div>
        <div className="flex flex-col items-center">
          <div className="relative">
            <svg className="h-20 w-20 -rotate-90 transform">
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-slate-700"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${(summary.security_score / 100) * 201} 201`}
                className={`${getScoreRing(summary.security_score)} transition-all duration-1000`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${getScoreColor(summary.security_score)}`}>
                {summary.security_score}
              </span>
              <span className="text-xs text-slate-400">{getScoreLabel(summary.security_score)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-red-500/10 p-4 ring-1 ring-red-500/20">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-red-400">Critical</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-400">{summary.critical_count}</div>
        </div>

        <div className="rounded-lg bg-orange-500/10 p-4 ring-1 ring-orange-500/20">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-orange-400">High</span>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-400">{summary.high_count}</div>
        </div>

        <div className="rounded-lg bg-yellow-500/10 p-4 ring-1 ring-yellow-500/20">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-yellow-400">Medium</span>
            <Clock className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">{summary.medium_count}</div>
        </div>

        <div className="rounded-lg bg-blue-500/10 p-4 ring-1 ring-blue-500/20">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-blue-400">Low</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-400">{summary.low_count}</div>
        </div>
      </div>

      {summary.priority_actions && summary.priority_actions.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-400" />
            <h4 className="font-semibold text-red-400">Priority Actions Required</h4>
          </div>
          <div className="space-y-3">
            {summary.priority_actions.map((action, idx) => (
              <div key={idx} className="rounded-md border border-red-500/20 bg-slate-900/50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                    action.priority === 'IMMEDIATE' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {action.priority}
                  </span>
                  <span className="text-sm font-medium text-white">{action.action}</span>
                </div>
                <ul className="ml-4 space-y-1">
                  {action.issues.map((issue, i) => (
                    <li key={i} className="text-xs text-slate-400">• {issue}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.quick_wins && summary.quick_wins.length > 0 && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <h4 className="font-semibold text-green-400">Quick Wins (Easy Fixes)</h4>
          </div>
          <ul className="space-y-2">
            {summary.quick_wins.map((win, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400"></div>
                {win}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
