import React, { useState } from 'react';
import { useStore } from '../store';
import { Lock, Sparkles, ArrowRight, ShieldCheck, KeyRound, Sun, Moon, Database } from 'lucide-react';
import { toast } from 'sonner';

export function PasswordGate() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, theme, toggleTheme } = useStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    setTimeout(() => {
      const success = login(password);
      if (success) {
        toast.success('Access granted! Welcome to DataMigrator.');
      } else {
        setError(true);
        toast.error('Invalid password. Please check your credentials.');
      }
      setIsLoading(false);
    }, 200);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 relative overflow-hidden font-sans transition-colors duration-200">
      
      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={toggleTheme}
          className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
          title="Toggle Light / Dark Mode"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>

      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Icon & Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/20 mx-auto mb-4 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 dark:bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Database className="w-7 h-7 text-emerald-400" />
            </div>
          </div>

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Enterprise Data Migrator</span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Security Checkpoint
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Enter your application password to access the database migration workspace.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                autoFocus
                placeholder="Enter password..."
                className={`w-full pl-10 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950/80 border rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm font-medium outline-none transition-all shadow-inner ${
                  error 
                    ? 'border-rose-500 ring-2 ring-rose-500/20' 
                    : 'border-slate-300 dark:border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                }`}
                required
              />
            </div>
            {error && (
              <p className="text-[11px] font-semibold text-rose-500 mt-2 animate-in fade-in">
                Incorrect password. Please try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!password || isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-2xl font-bold transition-all text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/20 cursor-pointer active:scale-[0.99]"
          >
            <span>{isLoading ? 'Verifying...' : 'Unlock Workspace'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Local session verified • SQLite Storage</span>
        </div>

      </div>
    </div>
  );
}
