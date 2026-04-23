import { Shield, Activity } from 'lucide-react';

export default function Header() {
  return (
    <header className="relative border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              VulnScan<span className="text-cyan-400">Pro</span>
            </h1>
            <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
              Security Assessment Tool
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
          <span>System Online</span>
        </div>
      </div>
    </header>
  );
}
