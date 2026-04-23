import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key, Plus, Ban, Trash2, RefreshCw, Copy, CheckCircle2,
  XCircle, Shield, Loader2, ChevronDown, Search,
  LogOut, Lock, Eye, EyeOff, Clock,
} from 'lucide-react';
import {
  adminFetchKeys,
  adminGenerateKeys,
  adminRevokeKey,
  adminDeleteKey,
} from '../services/licenseService';
import {
  adminLogout,
  verifyAdminSession,
  changeAdminPassword,
  getAdminStats,
} from '../services/adminService';
import type { LicenseKey } from '../services/licenseService';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<{ id: string; username: string } | null>(null);
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newKeys, setNewKeys] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, inactive: 0, active: 0, expired: 0, revoked: 0 });

  // Generate form
  const [genCount, setGenCount] = useState(1);
  const [genDuration, setGenDuration] = useState(30);
  const [genNotes, setGenNotes] = useState('');

  // Change password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // Verify session on mount
  useEffect(() => {
    async function check() {
      const result = await verifyAdminSession();
      if (!result.valid) {
        navigate('/admin', { replace: true });
        return;
      }
      setAdmin(result.admin || null);
    }
    check();
  }, [navigate]);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetchKeys();
      setKeys(data);
      const s = await getAdminStats();
      setStats(s);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load keys' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) loadKeys();
  }, [admin, loadKeys]);

  async function handleLogout() {
    await adminLogout();
    navigate('/admin', { replace: true });
  }

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
      setMessage({ type: 'success', text: 'Key revoked successfully' });
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPw.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters' });
      return;
    }
    setChangingPw(true);
    try {
      const result = await changeAdminPassword(currentPw, newPw);
      if (result.success) {
        setMessage({ type: 'success', text: 'Password changed successfully' });
        setShowChangePassword(false);
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to change password' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to change password' });
    } finally {
      setChangingPw(false);
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

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/3 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-teal-500/3 blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500">
              <Shield className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">VulnScan Pro Admin</h1>
              <p className="text-[10px] text-slate-500">License Key Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              <span className="text-xs font-medium text-slate-300">{admin.username}</span>
            </div>
            <button
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
              title="Change Password"
            >
              <Lock className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Change password modal */}
        {showChangePassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Change Password</h3>
                <button
                  onClick={() => setShowChangePassword(false)}
                  className="rounded p-1 text-slate-500 hover:text-slate-300"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Current Password</label>
                  <input
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      required
                      minLength={8}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 pr-10 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={changingPw}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40"
                >
                  {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Update Password
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Stats cards */}
        <div className="mb-8 grid grid-cols-5 gap-4">
          {[
            { label: 'Total Keys', count: stats.total, icon: Key, color: 'text-slate-300', bg: 'from-slate-800/50 to-slate-900/50' },
            { label: 'Inactive', count: stats.inactive, icon: Clock, color: 'text-slate-400', bg: 'from-slate-800/30 to-slate-900/30' },
            { label: 'Active', count: stats.active, icon: CheckCircle2, color: 'text-emerald-400', bg: 'from-emerald-900/20 to-slate-900/30' },
            { label: 'Expired', count: stats.expired, icon: XCircle, color: 'text-amber-400', bg: 'from-amber-900/20 to-slate-900/30' },
            { label: 'Revoked', count: stats.revoked, icon: Ban, color: 'text-red-400', bg: 'from-red-900/20 to-slate-900/30' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border border-slate-800/60 bg-gradient-to-br ${s.bg} p-4 transition-all hover:border-slate-700/60`}>
              <div className="mb-2 flex items-center justify-between">
                <s.icon className={`h-4 w-4 ${s.color} opacity-60`} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>

        {/* Generate section */}
        <div className="mb-6 rounded-xl border border-slate-800/60 bg-slate-900/40 p-5">
          <button
            onClick={() => setShowGenerate(!showGenerate)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                <Plus className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-200">Generate New License Keys</span>
                <p className="text-[11px] text-slate-500">Create keys with custom duration for users</p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${showGenerate ? 'rotate-180' : ''}`} />
          </button>

          {showGenerate && (
            <div className="mt-5 space-y-4 border-t border-slate-800/60 pt-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-400">Number of Keys</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={genCount}
                    onChange={(e) => setGenCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                    className="w-full rounded-lg border border-slate-700/80 bg-slate-800/50 px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-400">Duration (days)</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={genDuration}
                    onChange={(e) => setGenDuration(Math.max(1, Math.min(3650, Number(e.target.value))))}
                    className="w-full rounded-lg border border-slate-700/80 bg-slate-800/50 px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-400">Notes (optional)</label>
                <input
                  type="text"
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  placeholder="e.g. Client: Acme Corp, 1-year license"
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-800/50 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate {genCount} Key{genCount > 1 ? 's' : ''} ({genDuration} day{genDuration > 1 ? 's' : ''})
              </button>

              {newKeys.length > 0 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-300">Keys Generated Successfully</span>
                  </div>
                  <div className="space-y-2">
                    {newKeys.map((k) => (
                      <div key={k} className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-4 py-2.5">
                        <code className="flex-1 font-mono text-xs tracking-widest text-slate-300">{k}</code>
                        <button
                          onClick={() => copyKey(k)}
                          className="shrink-0 rounded-md border border-slate-700/50 bg-slate-800/50 p-1.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300"
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
                  <p className="mt-3 text-[11px] font-medium text-slate-500">Copy these keys and share with users. They will not be shown again after closing this section.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 flex items-center gap-2.5 rounded-xl border px-5 py-3.5 ${
            message.type === 'success'
              ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300'
              : 'border-red-500/25 bg-red-500/5 text-red-300'
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
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by key value..."
              className="w-full rounded-xl border border-slate-700/60 bg-slate-800/30 py-2.5 pl-10 pr-3 text-xs text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>
          <div className="flex gap-1.5">
            {['all', 'inactive', 'active', 'expired', 'revoked'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  filterStatus === s
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-800/30 text-slate-500 border border-slate-800/50 hover:bg-slate-800/50 hover:text-slate-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={loadKeys}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-800/50 hover:text-slate-400"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Keys table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="rounded-xl border border-slate-800/50 bg-slate-900/20 py-16 text-center">
            <Key className="mx-auto h-10 w-10 text-slate-700" />
            <p className="mt-3 text-sm font-medium text-slate-500">No license keys found</p>
            <p className="mt-1 text-xs text-slate-600">Generate new keys using the form above</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/60 bg-slate-900/80">
                    <th className="px-5 py-3.5 font-semibold text-slate-400">License Key</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-400">Status</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-400">Duration</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-400">Created</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-400">Activated</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-400">Expires</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-400">Notes</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeys.map((k) => (
                    <tr key={k.id} className="border-b border-slate-800/30 transition-colors hover:bg-slate-800/10">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Key className="h-3.5 w-3.5 text-slate-600" />
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
                      <td className="px-5 py-3.5">
                        <StatusBadge status={k.status} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {k.duration_days}d
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {k.activated_at ? new Date(k.activated_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3.5 max-w-[140px] truncate text-slate-600">
                        {k.notes || '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          {k.status !== 'revoked' && k.status !== 'expired' && (
                            <button
                              onClick={() => handleRevoke(k.id)}
                              className="rounded-md border border-slate-700/30 p-1.5 text-slate-600 transition-colors hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400"
                              title="Revoke Key"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(k.id)}
                            className="rounded-md border border-slate-700/30 p-1.5 text-slate-600 transition-colors hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400"
                            title="Delete Key"
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

        {/* Footer */}
        <div className="mt-8 border-t border-slate-800/40 pt-4 text-center">
          <p className="text-[11px] text-slate-600">VulnScan Pro Admin Panel -- Authorized access only</p>
        </div>
      </main>
    </div>
  );
}
