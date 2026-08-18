import React, { useEffect, useState } from 'react';
import { Database, FileSpreadsheet, GitMerge, LayoutDashboard, Play, TableProperties, Sun, Moon, Save, Sparkles, LogOut, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { toast } from 'sonner';

type LayoutProps = {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { project, sources, theme, toggleTheme, saveCurrentWorkspace, logout } = useStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [switchingTabId, setSwitchingTabId] = useState<string | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [theme]);

  const handleTabClick = (tabId: string, disabled?: boolean) => {
    if (disabled || activeTab === tabId) return;
    setSwitchingTabId(tabId);
    setTimeout(() => {
      setActiveTab(tabId);
      setSwitchingTabId(null);
    }, 120);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(() => {
      saveCurrentWorkspace();
      setIsSaving(false);
    }, 250);
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      logout();
      setIsLoggingOut(false);
    }, 150);
  };

  const navItems = [
    { id: 'project', label: 'Project Setup', step: '01', icon: LayoutDashboard },
    { id: 'import', label: 'Import & Profile', step: '02', icon: FileSpreadsheet, disabled: false },
    { id: 'schema', label: 'Target Schema', step: '03', icon: Database, disabled: !project && sources.length === 0 },
    { id: 'mapping', label: 'Column Mapping', step: '04', icon: GitMerge, disabled: sources.length === 0 },
    { id: 'transform', label: 'Transformations', step: '05', icon: TableProperties, disabled: sources.length === 0 },
    { id: 'generate', label: 'Generate SQL', step: '06', icon: Play, disabled: sources.length === 0 },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      
      {/* Sidebar */}
      <aside className="w-72 bg-white dark:bg-slate-950/95 border-r border-slate-200 dark:border-slate-800/80 flex flex-col shrink-0 backdrop-blur-xl shadow-xs transition-colors duration-200">
        
        {/* Brand */}
        <div className="h-18 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                DataMigrator
              </span>
              <span className="block text-[10px] font-mono font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                Enterprise ETL v2.0
              </span>
            </div>
          </div>
        </div>

        {/* Steps Navigation */}
        <div className="flex-1 py-6 px-4 overflow-y-auto space-y-6">
          <div>
            <h2 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-3">
              Migration Pipeline
            </h2>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                const isSwitching = switchingTabId === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id, item.disabled)}
                    disabled={item.disabled || isSwitching}
                    className={`w-full flex items-center justify-between px-3.5 py-3 text-xs font-bold rounded-xl transition-all duration-200 group cursor-pointer ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shadow-sm shadow-emerald-500/5'
                        : item.disabled
                        ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                      }`}>
                        {isSwitching ? (
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <item.icon className="w-4 h-4" />
                        )}
                      </div>
                      <span className="tracking-wide">
                        {isSwitching ? `Loading ${item.label}...` : item.label}
                      </span>
                    </div>

                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500'
                    }`}>
                      {item.step}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Active Workspace Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="overflow-hidden pr-2">
            <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Workspace</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
              {project ? project.name : 'No project loaded'}
            </div>
          </div>
          {project && (
            <button 
              onClick={handleSave}
              disabled={isSaving}
              title="Save Workspace State"
              className="p-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl transition-colors shadow-xs cursor-pointer shrink-0"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <Save className="w-4 h-4" />}
            </button>
          )}
        </div>
      </aside>

      {/* Main View Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <header className="h-18 bg-white/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between px-8 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
              <span>{navItems.find(i => i.id === activeTab)?.label || 'Overview'}</span>
              {switchingTabId && <Loader2 className="w-4 h-4 animate-spin text-emerald-500 inline" />}
            </h1>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              Live Ready
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            {project && (
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-60 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                title="Save Workspace Progress"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? 'Saving...' : 'Save Project'}</span>
              </button>
            )}

            <button 
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors shadow-xs cursor-pointer"
              title="Toggle Light / Dark Mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800/60 disabled:opacity-60 transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
              title="Lock & Log Out"
            >
              {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin text-rose-500" /> : <LogOut className="w-4 h-4 text-rose-500" />}
              <span className="text-xs font-bold">{isLoggingOut ? 'Exiting...' : 'Log Out'}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}


