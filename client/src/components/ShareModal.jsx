import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../api/client';

export default function ShareModal({ isOpen, onClose, document, activeUser, onUpdateSuccess }) {
  const [permissions, setPermissions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState('read');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (isOpen && document?.id) {
      loadData();
    }
  }, [isOpen, document?.id]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [permData, usersData] = await Promise.all([
        apiRequest(`/documents/${document.id}/permissions`, { activeUser }),
        apiRequest('/auth/users', { activeUser }),
      ]);
      setPermissions(permData.permissions || []);
      setAllUsers(usersData.users || []);
      if (usersData.users?.length > 0) {
        setSelectedEmail(usersData.users[0].email);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !document) return null;

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!selectedEmail) return;

    setError(null);
    setSuccessMsg(null);

    try {
      await apiRequest(`/documents/${document.id}/permissions`, {
        method: 'POST',
        body: { targetEmail: selectedEmail, permissionLevel },
        activeUser,
      });

      setSuccessMsg(`Access granted to ${selectedEmail}`);
      loadData();
      onUpdateSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRevoke = async (userId) => {
    setError(null);
    setSuccessMsg(null);

    try {
      await apiRequest(`/documents/${document.id}/permissions/${userId}`, {
        method: 'DELETE',
        activeUser,
      });

      setSuccessMsg('Access revoked successfully');
      loadData();
      onUpdateSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100">Access Control List (ACL)</h3>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{document.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Grant Form */}
          <form onSubmit={handleGrant} className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-xl space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Grant Access to Named Person</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <select
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {allUsers
                    .filter((u) => u.id !== document.owner_id)
                    .map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <select
                  value={permissionLevel}
                  onChange={(e) => setPermissionLevel(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="read">Read Only</option>
                  <option value="edit">Edit & Read</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              Confirm Permission Grant
            </button>
          </form>

          {/* Active Grants */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Active Delegated Permissions ({permissions.length})
            </h4>

            {permissions.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-800/20 rounded-xl border border-slate-800">
                No external permissions granted yet. This document is strictly private to the owner.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-800/20">
                {permissions.map((perm) => (
                  <div key={perm.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-medium text-slate-200">{perm.full_name}</p>
                      <p className="text-[11px] text-slate-400">{perm.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        perm.permission_level === 'edit'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {perm.permission_level.toUpperCase()}
                      </span>
                      <button
                        onClick={() => handleRevoke(perm.user_id)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        title="Revoke Access Immediately"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
