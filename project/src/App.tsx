import { useState, useCallback, useEffect } from 'react';
import type { ScanMode, ScanResult, ScanStatus, ScanProgress as ScanProgressType, ScanHistoryEntry } from './types/scanner';
import { countBySeverity } from './utils/severityUtils';
import { runScan } from './services/scannerService';
import { checkLicenseStatus, clearStoredLicense } from './services/licenseService';
import type { LicenseStatus } from './services/licenseService';
import Header from './components/Header';
import ScanForm from './components/ScanForm';
import ScanProgressDisplay from './components/ScanProgress';
import ScanResults from './components/ScanResults';
import ScanHistory from './components/ScanHistory';
import LicenseActivation from './components/LicenseActivation';
import { Key, ShieldCheck, Clock } from 'lucide-react';

type AppView = 'loading' | 'license' | 'scanner';

export default function App() {
  const [view, setView] = useState<AppView>('loading');
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState<ScanProgressType | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkLicense() {
      const ls = await checkLicenseStatus();
      setLicenseStatus(ls);
      setView(ls.valid ? 'scanner' : 'license');
    }
    checkLicense();
  }, []);

  const handleLicenseActivated = useCallback((ls: LicenseStatus) => {
    setLicenseStatus(ls);
    setView('scanner');
  }, []);

  const handleStartScan = useCallback(async (url: string, mode: ScanMode) => {
    setStatus('scanning');
    setError(null);
    setResult(null);

    try {
      const scanResult = await runScan(url, mode, (p) => setProgress(p));
      setResult(scanResult);
      setStatus('completed');

      const counts = countBySeverity(scanResult.categories);
      setHistory((prev) => [
        {
          scan_id: Date.now().toString(),
          url,
          scan_mode: mode,
          timestamp: scanResult.timestamp,
          total_vulnerabilities: counts.CRITICAL + counts.HIGH + counts.MEDIUM + counts.LOW,
          critical: counts.CRITICAL,
          high: counts.HIGH,
          medium: counts.MEDIUM,
          low: counts.LOW,
        },
        ...prev.slice(0, 9),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setStatus('error');
    }
  }, []);

  function handleNewScan() {
    setStatus('idle');
    setResult(null);
    setProgress(null);
    setError(null);
  }

  function handleDeactivate() {
    clearStoredLicense();
    setLicenseStatus(null);
    setView('license');
  }

  if (view === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      </div>
    );
  }

  if (view === 'license') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
        </div>
        <Header />
        <LicenseActivation onActivated={handleLicenseActivated} />
      </div>
    );
  }

  // Scanner view (license valid)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <Header />

      {/* License status bar */}
      {licenseStatus?.valid && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/5">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">
                Licensed
              </span>
              {licenseStatus.remaining_days !== undefined && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400/70">
                  <Clock className="h-3 w-3" />
                  {licenseStatus.remaining_days} day{licenseStatus.remaining_days !== 1 ? 's' : ''} remaining
                </span>
              )}
            </div>
            <button
              onClick={handleDeactivate}
              className="flex items-center gap-1 text-[11px] text-slate-500 transition-colors hover:text-red-400"
            >
              <Key className="h-3 w-3" />
              Deactivate
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {status === 'idle' && (
              <ScanForm onStartScan={handleStartScan} isScanning={false} />
            )}

            {status === 'scanning' && (
              <>
                <ScanForm onStartScan={handleStartScan} isScanning={true} />
                {progress && <ScanProgressDisplay progress={progress} />}
              </>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
                <button
                  onClick={handleNewScan}
                  className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
                >
                  Try Again
                </button>
              </div>
            )}

            {status === 'completed' && result && (
              <ScanResults result={result} onNewScan={handleNewScan} />
            )}
          </div>

          <aside className="space-y-6">
            <ScanHistory history={history} onSelect={() => {}} />

            {status === 'idle' && history.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-5">
                <h3 className="mb-2 text-sm font-medium text-slate-300">Getting Started</h3>
                <ol className="space-y-2 text-xs leading-relaxed text-slate-500">
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-cyan-400">1</span>
                    Enter the URL of a website you are authorized to test.
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-cyan-400">2</span>
                    Choose Light, Deep, or Network scan mode.
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-cyan-400">3</span>
                    Review findings and download a PDF report.
                  </li>
                </ol>
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-5">
              <h3 className="mb-3 text-sm font-medium text-slate-300">Severity Legend</h3>
              <div className="space-y-2">
                {[
                  { sev: 'CRITICAL', color: 'bg-red-500', desc: 'Immediate exploitation risk' },
                  { sev: 'HIGH', color: 'bg-orange-500', desc: 'Significant security flaw' },
                  { sev: 'MEDIUM', color: 'bg-amber-500', desc: 'Moderate risk issue' },
                  { sev: 'LOW', color: 'bg-sky-500', desc: 'Minor concern' },
                  { sev: 'INFO', color: 'bg-slate-500', desc: 'Informational finding' },
                  { sev: 'GOOD', color: 'bg-emerald-500', desc: 'Properly configured' },
                ].map((item) => (
                  <div key={item.sev} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${item.color}`} />
                    <span className="w-16 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.sev}
                    </span>
                    <span className="text-[11px] text-slate-600">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-800/50 py-6 text-center">
        <p className="text-xs text-slate-600">
          CEH Security Assessment Tool -- For authorized testing only
        </p>
      </footer>
    </div>
  );
}
