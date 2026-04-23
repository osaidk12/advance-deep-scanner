import { Shield, AlertTriangle, Wrench, Target } from 'lucide-react';

interface SecurityRecommendationProps {
  finding: {
    type: string;
    severity: string;
    message?: string;
    risk?: string;
    how_to_fix?: string[];
    defense_tips?: string[];
    [key: string]: unknown;
  };
}

export function SecurityRecommendation({ finding }: SecurityRecommendationProps) {
  if (finding.severity === 'INFO' || finding.severity === 'GOOD' || !finding.risk) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-full bg-red-100 p-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-slate-900">Why This Matters</h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{finding.risk}</p>
        </div>
      </div>

      {finding.how_to_fix && finding.how_to_fix.length > 0 && (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-blue-100 p-2">
            <Wrench className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-900">How to Fix</h4>
            <ul className="mt-2 space-y-2">
              {finding.how_to_fix.map((fix, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                    {idx + 1}
                  </span>
                  <span className="flex-1 leading-relaxed">{fix}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {finding.defense_tips && finding.defense_tips.length > 0 && (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-green-100 p-2">
            <Shield className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-900">Defense Best Practices</h4>
            <ul className="mt-2 space-y-1.5">
              {finding.defense_tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                  <Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span className="flex-1 leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
