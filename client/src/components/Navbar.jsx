import React from 'react';
import { Shield, FileText, Activity, Upload, Lock } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, activeUser, onOpenUpload }) {
  return (
    <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">TrustVault</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ZERO-TRUST
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Confidential Document Governance</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'documents'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Vault Documents</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'audit'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Audit Trail</span>
            {activeUser?.role !== 'admin' && (
              <Lock className="w-3 h-3 text-slate-500" title="Admin or Owner Document Scoped" />
            )}
          </button>
        </nav>

        {/* Actions & Profile */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" />
            <span>Secure Upload</span>
          </button>
        </div>
      </div>
    </header>
  );
}
