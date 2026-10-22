import React, { useState, useEffect } from 'react';
import { Search, FileText, Download, Share2, Trash2, Shield, Calendar, User, Hash, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '../api/client';

const CATEGORIES = [
  'All',
  'Contracts & Agreements',
  'Salaries & Compensation',
  'External Engineering Drawings',
  'Regulatory Audit Papers',
  'General Confidential',
];

export default function DocumentListView({ activeUser, onOpenShare, onOpenUpload, refreshTrigger }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [alert, setAlert] = useState(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory !== 'All') params.append('category', selectedCategory);

      const query = params.toString() ? '?' + params.toString() : '';
      const data = await apiRequest('/documents' + query, { activeUser });
      setDocuments(data.documents || []);
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [activeUser?.email, selectedCategory, refreshTrigger]);

  const handleDownload = async (doc) => {
    try {
      const res = await apiRequest('/documents/' + doc.id + '/download', { activeUser });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_filename || 'download.bin';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setAlert({ type: 'success', message: 'Downloaded: ' + doc.title });
    } catch (err) {
      setAlert({ type: 'error', message: 'Download Rejected: ' + err.message });
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm('Are you sure you want to delete "' + doc.title + '"? This will archive the document while preserving the audit trail.')) {
      return;
    }

    try {
      await apiRequest('/documents/' + doc.id, {
        method: 'DELETE',
        activeUser,
      });
      setAlert({ type: 'success', message: 'Deleted and archived: ' + doc.title });
      loadDocuments();
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6 min-h-[480px]">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Protected Documents</h2>
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Syncing Vault...</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Zero-leak vault. Showing documents governed by your active credentials ({activeUser?.role}).
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadDocuments()}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={'px-3 py-1 rounded-lg text-xs font-medium transition-colors ' + (
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Alert Banner */}
      {alert && (
        <div
          className={'p-3 rounded-xl border text-xs flex items-center justify-between ' + (
            alert.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          )}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            <span>{alert.message}</span>
          </div>
          <button onClick={() => setAlert(null)} className="text-slate-500 hover:text-slate-300">
            &times;
          </button>
        </div>
      )}

      {/* Document Grid with Stable Height and Skeleton Loader */}
      {isLoading && documents.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[380px]">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex flex-col justify-between h-56 animate-pulse"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-24 bg-slate-800 rounded"></div>
                  <div className="h-4 w-12 bg-slate-800 rounded"></div>
                </div>
                <div className="h-5 w-3/4 bg-slate-800 rounded"></div>
                <div className="h-3 w-1/2 bg-slate-800/60 rounded"></div>
              </div>
              <div className="h-8 bg-slate-800/60 rounded-xl mt-4"></div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="min-h-[350px] flex flex-col items-center justify-center text-center py-16 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No Documents Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Either no documents have been uploaded in this category, or your active persona has not been granted access permissions.
          </p>
          <button
            onClick={onOpenUpload}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20"
          >
            Upload New Document
          </button>
        </div>
      ) : (
        <div className={'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[380px] transition-opacity duration-200 ' + (isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100')}>
          {documents.map((doc) => {
            const isOwner = doc.effective_permission === 'owner';
            const canEdit = isOwner || doc.effective_permission === 'edit';

            return (
              <div
                key={doc.id}
                className="bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-black/40 group"
              >
                <div>
                  {/* Category & Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {doc.category}
                    </span>
                    <span
                      className={'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ' + (
                        isOwner
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : doc.effective_permission === 'edit'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      )}
                    >
                      {doc.effective_permission || 'VIEW'}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-white tracking-tight line-clamp-2 group-hover:text-indigo-300 transition-colors">
                    {doc.title}
                  </h3>

                  {/* Original Filename & Size */}
                  <p className="text-xs text-slate-400 truncate mt-1">
                    {doc.original_filename} &bull; {(doc.file_size_bytes / 1024).toFixed(1)} KB
                  </p>

                  {/* Owner & Date */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 space-y-1.5 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-300">Owner:</span>
                      <span className="truncate">{doc.owner_name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 truncate" title={'SHA-256 Checksum: ' + doc.sha256_hash}>
                      <Hash className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span className="truncate">{doc.sha256_hash}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download</span>
                  </button>

                  {isOwner && (
                    <>
                      <button
                        onClick={() => onOpenShare(doc)}
                        className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition-colors"
                        title="Manage Permissions (Share / Revoke)"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(doc)}
                        className="p-1.5 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition-colors"
                        title="Archive Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
