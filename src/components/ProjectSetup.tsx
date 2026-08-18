import React, { useState } from 'react';
import { useStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { Folder, Plus, Trash2, ArrowRight, Sparkles, Layers, ShieldCheck, Loader2 } from 'lucide-react';

export function ProjectSetup({ onNext }: { onNext: () => void }) {
  const { project, setProject, savedWorkspaces, loadWorkspace, deleteWorkspace, saveCurrentWorkspace } = useStore();
  
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [isCreatingNew, setIsCreatingNew] = useState(!project && savedWorkspaces.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingWorkspaceId, setLoadingWorkspaceId] = useState<string | null>(null);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    setTimeout(() => {
      setProject({
        id: project?.id || uuidv4(),
        name,
        description
      });
      saveCurrentWorkspace();
      setIsSubmitting(false);
      onNext();
    }, 200);
  };

  const handleCreateNew = () => {
    setProject({ id: uuidv4(), name: 'New Migration Project', description: '' });
    setName('');
    setDescription('');
    setIsCreatingNew(true);
  };

  const handleLoadWorkspace = (wsId: string, wsName: string, wsDesc: string) => {
    setLoadingWorkspaceId(wsId);
    setTimeout(() => {
      loadWorkspace(wsId);
      setName(wsName);
      setDescription(wsDesc);
      setIsCreatingNew(false);
      setLoadingWorkspaceId(null);
    }, 150);
  };

  const handleDeleteWorkspace = (wsId: string) => {
    setDeletingWorkspaceId(wsId);
    setTimeout(() => {
      deleteWorkspace(wsId);
      setDeletingWorkspaceId(null);
    }, 200);
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
      
      {/* Saved Projects Sidebar */}
      <div className="col-span-1 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 flex flex-col h-[calc(100vh-14rem)] backdrop-blur-xl shadow-sm dark:shadow-xl transition-colors">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/80">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm tracking-tight">Saved Projects</h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{savedWorkspaces.length} workspace(s)</p>
          </div>
          <button 
            onClick={handleCreateNew}
            className="p-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-xl transition-all shadow-xs cursor-pointer"
            title="Create new project"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {savedWorkspaces.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
              <Layers className="w-6 h-6 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No saved projects yet.</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">Create your first migration workspace.</p>
            </div>
          ) : (
            savedWorkspaces.map(ws => (
              <div 
                key={ws.project.id}
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                  project?.id === ws.project.id 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 shadow-sm' 
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                onClick={() => handleLoadWorkspace(ws.project.id, ws.project.name, ws.project.description)}
              >
                <div className="flex items-center truncate">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0 ${
                    project?.id === ws.project.id ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {loadingWorkspaceId === ws.project.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Folder className="w-4 h-4" />
                    )}
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-bold truncate block text-slate-800 dark:text-slate-200">{ws.project.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {ws.sources?.length || 0} source(s) • {ws.targetTables?.length || 0} table(s)
                    </span>
                  </div>
                </div>

                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    handleDeleteWorkspace(ws.project.id); 
                  }}
                  disabled={deletingWorkspaceId === ws.project.id}
                  className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg cursor-pointer"
                  title="Delete project"
                >
                  {deletingWorkspaceId === ws.project.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Main */}
      <div className="col-span-2 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-8 h-[calc(100vh-14rem)] flex flex-col justify-between backdrop-blur-xl shadow-sm dark:shadow-xl transition-colors">
        <div>
          <div className="mb-8">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-mono font-semibold mb-3">
              <Sparkles className="w-3 h-3" />
              <span>Step 01: Migration Initialization</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isCreatingNew ? 'Create Migration Project' : 'Project Settings'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 leading-relaxed">
              Configure your migration workspace metadata. Project state is automatically cached and preserved.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-2">
                Project Name <span className="text-emerald-600 dark:text-emerald-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm font-medium placeholder-slate-400 shadow-inner"
                placeholder="e.g. Production PostgreSQL Migration 2026"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-2">
                Description / Scope (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm font-medium placeholder-slate-400 resize-none shadow-inner"
                placeholder="Details regarding target tables, source legacy CSVs, or specific encoding guidelines..."
              />
            </div>
          </form>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Local privacy: data is parsed on-device</span>
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={!name.trim() || isSubmitting}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all text-xs flex items-center space-x-2 shadow-lg shadow-emerald-950/20 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing Workspace...</span>
              </>
            ) : (
              <>
                <span>Proceed to Import Source</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
