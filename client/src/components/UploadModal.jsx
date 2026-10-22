import React, { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, File, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api/client';

export default function UploadModal({ isOpen, onClose, activeUser, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Contracts & Agreements');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Reset state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setTitle('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setFile(null);
    setTitle('');
    setError(null);
    onClose();
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      // Clean display name by stripping extension
      const defaultName = selected.name.replace(/\.[^/.]+$/, '');
      setTitle(defaultName);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim() || file.name);
      formData.append('category', category);

      await apiRequest('/documents', {
        method: 'POST',
        body: formData,
        activeUser,
      });

      handleClose();
      onUploadSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <UploadCloud className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-100">Upload Confidential Document</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* File Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-800/20 hover:bg-slate-800/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-200 font-medium">
                <File className="w-4 h-4 text-slate-400" />
                <span>{file.name}</span>
                <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-200 font-medium">Click or drag file to upload</p>
                <p className="text-xs text-slate-400 mt-1">
                  PDF, DOCX, PNG, JPEG, TXT (Strict server-side magic byte enforcement)
                </p>
              </div>
            )}
          </div>

          {/* Document Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Document Display Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Auditor Engagement Agreement"
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Classification Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="Contracts & Agreements">Contracts & Agreements</option>
              <option value="Salaries & Compensation">Salaries & Compensation</option>
              <option value="External Engineering Drawings">External Engineering Drawings</option>
              <option value="Regulatory Audit Papers">Regulatory Audit Papers</option>
              <option value="General Confidential">General Confidential</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/20"
            >
              {isSubmitting ? 'Securing & Ingesting...' : 'Upload & Encrypt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
