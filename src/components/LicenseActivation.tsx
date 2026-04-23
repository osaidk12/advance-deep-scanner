import { useState } from 'react';
import { Key, ShieldCheck, AlertTriangle, Clock, Loader2, ArrowRight } from 'lucide-react';
import { activateLicense } from '../services/licenseService';
import type { LicenseStatus } from '../services/licenseService';

interface LicenseActivationProps {
  onActivated: (status: LicenseStatus) => void;
}

export default function LicenseActivation({ onActivated }: LicenseActivationProps) {
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const result = await activateLicense(trimmed);
      if (result.valid) {
        onActivated(result);
      } else {
        setError(result.error || 'Invalid license key');
      }
    } catch {
      setError('Failed to activate license. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function formatKey(value: string): string {
    const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const parts = clean.match(/.{1,4}/g) || [];
    return parts.join('-');
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/20">
            <Key className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Activate Your License</h2>
          <p className="mt-2 text-sm text-slate-400">
            Enter your license key to unlock VulnScan Pro. All scan modes and features will be available once activated.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                License Key
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(formatKey(e.target.value))}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  maxLength={19}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-3.5 pl-11 pr-4 font-mono text-sm tracking-widest text-white placeholder-slate-600 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || keyInput.replace(/-/g, '').length < 16}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-teal-500 hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  Activate License
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-5">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              What you get
            </h4>
            <div className="space-y-2.5">
              {[
                { icon: ShieldCheck, text: 'Full access to all scan modes' },
                { icon: Clock, text: 'License duration set by your admin' },
                { icon: Key, text: 'Light, Deep, and Network scans unlocked' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4 text-teal-400" />
                  <span className="text-xs text-slate-400">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-600">
          Contact your administrator to obtain a license key
        </p>
      </div>
    </div>
  );
}
