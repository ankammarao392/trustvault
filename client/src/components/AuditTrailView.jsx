import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, ShieldAlert, Search, RefreshCw, Filter, Loader2 } from 'lucide-react';
import { apiRequest } from '../api/client';

export default function AuditTrailView({ activeUser, refreshTrigger }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterAction) params.append('action', filterAction);
      if (filterStatus) params.append('status', filterStatus);

      const query = params.toString() ? '?' + params.toString() : '';
      const data = await apiRequest('/audit-logs' + query, { activeUser });
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [activeUser?.email, filterAction, filterStatus, refreshTrigger]);

  const getActionBadge = (action) => {
    switch (action) {
      case 'UPLOAD':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'DOWNLOAD':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'SHARE_PERMISSION':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'REVOKE_PERMISSION':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 min-h-[480px]">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Compliance & Forensic Audit Trail</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              IMMUTABLE
            </span>
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Refreshing...</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically timestamped, append-only security logs for all access, downloads, and permission mutations.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-all self-start"
        >
          <RefreshCw className={'w-3.5 h-3.5 ' + (isLoading ? 'animate-spin' : '')} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {error ? (
        <div className="min-h-[350px] p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Access Restricted</p>
            <p className="text-amber-400/90 mt-1">{error}</p>
            <p className="mt-3 text-slate-400 leading-relaxed">
              Tip: Switch to the <strong>Chief Compliance Admin</strong> using the top persona bar to view system-wide audit records.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search audit events by document, actor, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Actions</option>
                <option value="UPLOAD">UPLOAD</option>
                <option value="DOWNLOAD">DOWNLOAD</option>
                <option value="READ_METADATA">READ_METADATA</option>
                <option value="SHARE_PERMISSION">SHARE_PERMISSION</option>
                <option value="REVOKE_PERMISSION">REVOKE_PERMISSION</option>
                <option value="DELETE">DELETE</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="DENIED">DENIED (Security Violation)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className={'bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl min-h-[380px] transition-opacity duration-200 ' + (isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100')}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Timestamp (UTC)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Document Target</th>
                    <th className="px-4 py-3">IP / User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-slate-500 italic">
                        {isLoading ? 'Loading audit records...' : 'No audit records found matching criteria.'}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const isDenied = log.status === 'DENIED';
                      return (
                        <tr
                          key={log.id}
                          className={'hover:bg-slate-800/30 transition-colors ' + (
                            isDenied ? 'bg-red-500/5' : ''
                          )}
                        >
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ' + (
                              isDenied
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            )}>
                              {isDenied ? (
                                <>
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>DENIED</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>SUCCESS</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ' + getActionBadge(log.action)}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <p className="font-medium text-slate-200">{log.actor_email}</p>
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{log.actor_role}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-200 truncate max-w-xs">{log.document_title || '-'}</p>
                              {log.document_id && (
                                <p className="text-[10px] text-slate-500 font-mono">Doc #{log.document_id}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {log.ip_address}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
