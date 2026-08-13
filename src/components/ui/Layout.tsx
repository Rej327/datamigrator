import React from 'react';
import { Database, FileSpreadsheet, GitMerge, LayoutDashboard, Play, TableProperties, Sun, Moon, Save } from 'lucide-react';
import { useStore } from '../../store';

type LayoutProps = {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { project, theme, toggleTheme, saveCurrentWorkspace } = useStore();

  const navItems = [
    { id: 'project', label: 'Project', icon: LayoutDashboard },
    { id: 'import', label: '1. Import & Profile', icon: FileSpreadsheet, disabled: !project },
    { id: 'schema', label: '2. Target Schema', icon: Database, disabled: !project },
    { id: 'mapping', label: '3. Mapping', icon: GitMerge, disabled: !project },
    { id: 'transform', label: '4. Transformations', icon: TableProperties, disabled: !project },
    { id: 'generate', label: '5. Generate SQL', icon: Play, disabled: !project },
  ];

  return (
    <div className={`${theme} flex h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-200 font-sans transition-colors duration-200`}>
      <aside className="w-64 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0 transition-colors duration-200">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center font-bold text-white text-lg italic mr-3">S</div>
          <span className="text-lg font-bold text-slate-800 dark:text-slate-200">DataMigrator</span>
        </div>
        <div className="flex-1 py-4 overflow-y-auto">
          <div className="px-4 mb-4">
            <h2 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Steps</h2>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setActiveTab(item.id)}
                  disabled={item.disabled}
                  className={`w-full flex items-center px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
                    activeTab === item.id
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                      : item.disabled
                      ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <item.icon className={`w-4 h-4 mr-3 ${activeTab === item.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
        {project && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
            <div className="overflow-hidden">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Current Project</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-300 truncate pr-2">{project.name}</div>
            </div>
            <button 
              onClick={saveCurrentWorkspace}
              title="Save Project State"
              className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-colors"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-950 transition-colors duration-200">
        <header className="h-16 bg-white dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-8 shadow-sm z-10 shrink-0 transition-colors duration-200">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
            {navItems.find(i => i.id === activeTab)?.label || 'Overview'}
          </h1>
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
