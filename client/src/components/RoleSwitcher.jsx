import React from 'react';
import { ShieldAlert, UserCheck, Eye, ShieldCheck } from 'lucide-react';

export const DEMO_USERS = [
  {
    email: 'admin@trustvault.internal',
    name: 'Chief Compliance Admin',
    role: 'admin',
    description: 'System auditor with full visibility over global audit logs and user management.',
    icon: ShieldCheck,
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  {
    email: 'owner@trustvault.internal',
    name: 'Sarah Connor (Document Owner)',
    role: 'owner',
    description: 'Document creator with authority to upload, grant permissions, and revoke access.',
    icon: UserCheck,
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  {
    email: 'viewer@trustvault.internal',
    name: 'David Miller (Auditor / Viewer)',
    role: 'viewer',
    description: 'External reviewer. Can strictly access documents explicitly shared with him.',
    icon: Eye,
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
];

export default function RoleSwitcher({ activeUser, onSelectUser }) {
  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="text-slate-200">Interactive Security Evaluator:</strong> Switch personas below to test zero-trust isolation in real time.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {DEMO_USERS.map((user) => {
            const Icon = user.icon;
            const isSelected = activeUser?.email === user.email;
            return (
              <button
                key={user.email}
                onClick={() => onSelectUser(user)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{user.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${user.badgeColor}`}>
                  {user.role}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
