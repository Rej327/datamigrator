import React, { useState } from 'react';
import { useStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { Folder, Plus, Trash2 } from 'lucide-react';

export function ProjectSetup({ onNext }: { onNext: () => void }) {
  const { project, setProject, savedWorkspaces, loadWorkspace, deleteWorkspace, saveCurrentWorkspace } = useStore();
  
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [isCreatingNew, setIsCreatingNew] = useState(!project && savedWorkspaces.length === 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setProject({
      id: project?.id || uuidv4(),
      name,
      description
    });
    saveCurrentWorkspace();
    onNext();
  };

  const handleCreateNew = () => {
    setProject({ id: uuidv4(), name: 'New Project', description: '' });
    setName('');
    setDescription('');
    setIsCreatingNew(true);
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
      
      {/* Saved Projects Sidebar */}
      <div className="col-span-1 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col h-[calc(100vh-12rem)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-200">Saved Projects</h3>
          <button 
            onClick={handleCreateNew}
            className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {savedWorkspaces.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic text-center p-4">No saved projects yet.</p>
          ) : (
            savedWorkspaces.map(ws => (
              <div 
                key={ws.project.id}
                className={`group flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                  project?.id === ws.project.id 
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                onClick={() => {
                  loadWorkspace(ws.project.id);
                  setName(ws.project.name);
                  setDescription(ws.project.description);
                  setIsCreatingNew(false);
                }}
              >
                <div className="flex items-center truncate">
                  <Folder className="w-4 h-4 mr-2 shrink-0 opacity-70" />
                  <span className="text-sm font-medium truncate">{ws.project.name}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.project.id); }}
                  className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Main */}
      <div className="col-span-2 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-8 h-[calc(100vh-12rem)]">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
            {isCreatingNew ? 'Create Migration Project' : 'Project Details'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Define the core details of your legacy data migration effort before importing data.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Project Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors text-sm"
              placeholder="e.g. HR Legacy Database Migration"
              required
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors resize-none text-sm"
              placeholder="Migration from legacy HR system to normalized schema..."
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-md transition-colors text-sm"
            >
              {project && !isCreatingNew ? 'Update & Continue' : 'Create Project & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
