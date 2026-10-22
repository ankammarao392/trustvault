import React, { useState } from 'react';
import RoleSwitcher, { DEMO_USERS } from './components/RoleSwitcher';
import Navbar from './components/Navbar';
import DocumentListView from './components/DocumentListView';
import AuditTrailView from './components/AuditTrailView';
import UploadModal from './components/UploadModal';
import ShareModal from './components/ShareModal';
import { ShieldCheck, Lock, Activity, EyeOff } from 'lucide-react';

export default function App() {
  const [activeUser, setActiveUser] = useState(DEMO_USERS[1]); // Default to Sarah Connor (Document Owner)
  const [activeTab, setActiveTab] = useState('documents');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleUpdateSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Interactive Role Switcher Banner */}
      <RoleSwitcher
        activeUser={activeUser}
        onSelectUser={(user) => {
          setActiveUser(user);
          // If switching to viewer while on audit tab, switch to documents tab
          if (user.role === 'viewer' && activeTab === 'audit') {
            setActiveTab('documents');
          }
        }}
      />

      {/* Primary Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeUser={activeUser}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Persona Context Banner */}
        <div className="mb-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 border border-slate-700/60">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Authenticated Identity:</span>
                <span className="text-xs font-bold text-slate-200">{activeUser.name}</span>
                <span className="text-[10px] font-mono text-slate-500">({activeUser.email})</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activeUser.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Least Privilege Active</span>
            </span>
          </div>
        </div>

        {/* Dynamic Views */}
        {activeTab === 'documents' ? (
          <DocumentListView
            key={`${activeUser.email}-${refreshTrigger}`}
            activeUser={activeUser}
            onOpenShare={(doc) => setShareDoc(doc)}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        ) : (
          <AuditTrailView
            key={`audit-${activeUser.email}-${refreshTrigger}`}
            activeUser={activeUser}
          />
        )}
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        activeUser={activeUser}
        onUploadSuccess={handleUploadSuccess}
      />

      <ShareModal
        isOpen={Boolean(shareDoc)}
        onClose={() => setShareDoc(null)}
        document={shareDoc}
        activeUser={activeUser}
        onUpdateSuccess={handleUpdateSuccess}
      />

      {/* Security Architecture Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-300">TrustVault Security Assurance:</span>
            <span>Zero IDOR leakage &bull; Obfuscated UUID storage &bull; Append-only audit integrity</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>FastAPI/Node `.js` Core</span>
            <span>&bull;</span>
            <span>Tailwind CSS</span>
            <span>&bull;</span>
            <span>SQLite WAL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
