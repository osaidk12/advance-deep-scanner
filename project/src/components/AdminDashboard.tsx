import { useState, useEffect, useCallback } from 'react';
import {
  Key, Plus, Ban, Trash2, RefreshCw, Copy, CheckCircle2,
  XCircle, Shield, Loader2, ChevronDown, Search,
} from 'lucide-react';
import {
  adminFetchKeys,
  adminGenerateKeys,
  adminRevokeKey,
  adminDeleteKey,
} from '../services/licenseService';
import type { LicenseKey } from '../services/licenseService';

interface AdminDashboardProps {
  onClose: () => void;
}

export default function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newKeys, setNewKeys] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Generate form
  const [genCount, setGenCount] = useState(1);
  const [genDuration, setGenDuration] = useState(30);
  const [genNotes, setGenNotes] = useState('');

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetchKeys();
      setKeys(data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load keys' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const result = await adminGenerateKeys(genCount, genDuration, genNotes);
      if (result.keys) {
        setNewKeys(result.keys);
        setMessage({ type: 'success', text: result.message });
        await loadKeys();
      } else {
        setMessage({ type: 'error', text: 'Failed to generate keys' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate keys' });
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    try {
      await adminRevokeKey(keyId);
      setMessage({ type: 'success', text: 'Key revoked' });
      await loadKeys();
    } catch {
      setMessage({ type: 'error', text: 'Failed to revoke key' });
    }
  }

  async function handleDelete(keyId: string) {
    try {
      await adminDeleteKey(keyId);
      setMessage({ type: 'success', text: 'Key deleted' });
      await loadKeys();
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete key' });
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const filteredKeys = keys.filter((k) => {
    if (filterStatus !== 'all' && k.status !== filterStatus) return false;
    if (searchQuery && !k.key.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusCounts = {
    all: keys.length,
    inactive: keys.filter((k) => k.status === 'inactive').length,
    active: keys.filter((k) => k.status === 'active').length,
    expired: keys.filter((k) => k.status === 'expired').length,
    revoked: keys.filter((k) => k.status === 'revoked').length,
  };

  function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
      inactive: 'bg-slate-500/15 border-slate-500/40 text-slate-400',
      active: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
      expired: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
      revoked: 'bg-red-500/15 border-red-500/40 text-red-400',
    };
    return (
      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status] || styles.inactive}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">License Key Admin</h2>
            <p className="text-xs text-slate-500">Generate, manage, and monitor license keys</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadKeys}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            Back to Scanner
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', count: statusCounts.all, color: 'text-slate-300' },
          { label: 'Inactive', count: statusCounts.inactive, color: 'text-slate-400' },
          { label: 'Active', count: statusCounts.active, color: 'text-emerald-400' },
          { label: 'Expired', count: statusCounts.expired, color: 'text-amber-400' },
          { label: 'Revoked', count: statusCounts.revoked, color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2.5 text-center">
            <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.count}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Generate section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <button
          onClick={() => setShowGenerate(!showGenerate)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">Generate New Keys</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${showGenerate ? 'rotate-180' : ''}`} />
        </button>

        {showGenerate && (
          <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Number of Keys</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={genCount}
                  onChange={(e) => setGenCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Duration (days)</label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={genDuration}
                  onChange={(e) => setGenDuration(Math.max(1, Math.min(3650, Number(e.target.value))))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes (optional)</label>
              <input
                type="text"
                value={genNotes}
                onChange={(e) => setGenNotes(e.target.value)}
                placeholder="e.g. Client: Acme Corp"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Generate {genCount} Key{genCount > 1 ? 's' : ''} ({genDuration} day{genDuration > 1 ? 's' : ''})
            </button>

            {newKeys.length > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">New Keys Generated</span>
                </div>
                <div className="space-y-2">
                  {newKeys.map((k) => (
                    <div key={k} className="flex items-center gap-2 rounded-md bg-slate-800/50 px-3 py-2">
                      <code className="flex-1 font-mono text-xs tracking-wider text-slate-300">{k}</code>
                      <button
                        onClick={() => copyKey(k)}
                        className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300"
                      >
                        {copiedKey === k ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">Copy these keys and share them with users. They will not be shown again.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${
          message.type === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
            : 'border-red-500/30 bg-red-500/5 text-red-300'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keys..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'inactive', 'active', 'expired', 'revoked'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                filterStatus === s
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Keys table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      ) : filteredKeys.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-800/20 py-12 text-center">
          <Key className="mx-auto h-8 w-8 text-slate-700" />
          <p className="mt-2 text-sm text-slate-500">No keys found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3 font-semibold text-slate-400">Key</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Duration</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Activated</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Expires</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Notes</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map((k) => (
                  <tr key={k.id} className="border-b border-slate-800/50 transition-colors hover:bg-slate-800/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-[11px] tracking-wider text-slate-300">{k.key}</code>
                        <button
                          onClick={() => copyKey(k.key)}
                          className="shrink-0 rounded p-0.5 text-slate-600 transition-colors hover:text-slate-400"
                        >
                          {copiedKey === k.key ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={k.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {k.duration_days}d
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {k.activated_at ? new Date(k.activated_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 max-w-[120px] truncate text-slate-500">
                      {k.notes || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {k.status !== 'revoked' && k.status !== 'expired' && (
                          <button
                            onClick={() => handleRevoke(k.id)}
                            className="rounded p-1 text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            title="Revoke"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(k.id)}
                          className="rounded p-1 text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
