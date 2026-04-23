import { useState } from 'react';
import { Search, Zap, Radar, Network, AlertTriangle, Globe } from 'lucide-react';
import type { ScanMode } from '../types/scanner';

interface ScanFormProps {
  onStartScan: (url: string, mode: ScanMode) => void;
  isScanning: boolean;
}

interface DnsLookupResult {
  domain: string;
  ip: string;
}

export default function ScanForm({ onStartScan, isScanning }: ScanFormProps) {
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState<ScanMode>('light');
  const [dnsLookupInput, setDnsLookupInput] = useState('');
  const [dnsResult, setDnsResult] = useState<DnsLookupResult | null>(null);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = target.trim();
    if (!trimmed) return;

    onStartScan(trimmed, mode);
  }

  async function handleDnsLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = dnsLookupInput.trim();
    if (!trimmed) return;

    setDnsLoading(true);
    setDnsError(null);
    setDnsResult(null);

    try {
      const cleanDomain = trimmed.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dns-lookup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: cleanDomain }),
      });

      const data = await response.json();

      if (data.error) {
        setDnsError(data.error);
      } else if (data.ip) {
        setDnsResult({ domain: cleanDomain, ip: data.ip });
      } else {
        setDnsError('Could not resolve domain');
      }
    } catch (err) {
      setDnsError('Failed to perform DNS lookup');
    } finally {
      setDnsLoading(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm leading-relaxed text-amber-200/80">
            Only scan websites you own or have explicit authorization to test.
            Unauthorized scanning may violate computer crime laws.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200">DNS Lookup</h3>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Find the IP address of any domain without running a full security scan.
        </p>
        <form onSubmit={handleDnsLookup} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={dnsLookupInput}
              onChange={(e) => setDnsLookupInput(e.target.value)}
              placeholder="example.com"
              disabled={dnsLoading}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 transition-all focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={dnsLoading || !dnsLookupInput.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {dnsLoading ? 'Looking up...' : 'Find IP'}
            </button>
          </div>
          {dnsResult && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Domain</p>
                  <p className="font-mono text-sm text-slate-200">{dnsResult.domain}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">IP Address</p>
                  <p className="font-mono text-sm font-semibold text-emerald-400">{dnsResult.ip}</p>
                </div>
              </div>
            </div>
          )}
          {dnsError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2">
              <p className="text-xs text-red-400">{dnsError}</p>
            </div>
          )}
        </form>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-800"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-slate-950 px-2 text-slate-600">OR</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Target URL or IP Address
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="example.com  or  192.168.1.1"
              disabled={isScanning}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-600">
            Accepts domains, IPs, or full URLs. Protocol auto-detected for optimal scanning.
          </p>
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium text-slate-300">
            Scan Mode
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setMode('light')}
              disabled={isScanning}
              className={`group relative rounded-lg border p-4 text-left transition-all ${
                mode === 'light'
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
              } disabled:opacity-50`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Zap
                  className={`h-4 w-4 ${
                    mode === 'light' ? 'text-cyan-400' : 'text-slate-500'
                  }`}
                />
                <span
                  className={`text-sm font-semibold ${
                    mode === 'light' ? 'text-cyan-300' : 'text-slate-300'
                  }`}
                >
                  Light Scan
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Quick security check with subdomain discovery, SSL/TLS analysis, security headers, cookies, and CORS configuration.
              </p>
              <span className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-slate-600">
                12 Tests -- ~30-60s
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode('deep')}
              disabled={isScanning}
              className={`group relative rounded-lg border p-4 text-left transition-all ${
                mode === 'deep'
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
              } disabled:opacity-50`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Radar
                  className={`h-4 w-4 ${
                    mode === 'deep' ? 'text-cyan-400' : 'text-slate-500'
                  }`}
                />
                <span
                  className={`text-sm font-semibold ${
                    mode === 'deep' ? 'text-cyan-300' : 'text-slate-300'
                  }`}
                >
                  Deep Scan
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Comprehensive scan with subdomain enumeration, injection testing, SSRF, XSS, file inclusion, and 50+ security checks.
              </p>
              <span className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-slate-600">
                55 Tests -- ~2-5min
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode('network')}
              disabled={isScanning}
              className={`group relative rounded-lg border p-4 text-left transition-all ${
                mode === 'network'
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
              } disabled:opacity-50`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Network
                  className={`h-4 w-4 ${
                    mode === 'network' ? 'text-cyan-400' : 'text-slate-500'
                  }`}
                />
                <span
                  className={`text-sm font-semibold ${
                    mode === 'network' ? 'text-cyan-300' : 'text-slate-300'
                  }`}
                >
                  Network Scan
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Focused network analysis scanning common and high-risk ports to identify exposed services.
              </p>
              <span className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-slate-600">
                Port Scan -- ~30-60s
              </span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isScanning || !target.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-teal-500 hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {isScanning ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Scanning...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Start Scan
            </>
          )}
        </button>
      </form>
    </div>
  );
}
