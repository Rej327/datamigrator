import React, { useState } from 'react';
import { useStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { TableProperties, Save, Plus, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Transformation } from '../types';

export function Transformations({ onNext }: { onNext: () => void }) {
  const { sources, columnMappings, transformations, addTransformation } = useStore();
  
  const [activeSourceId, setActiveSourceId] = useState<string | null>(sources[0]?.id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isNavigatingNext, setIsNavigatingNext] = useState(false);
  
  const [activeSourceMappings, setActiveSourceMappings] = useState<any[]>([]);
  const [activeHeader, setActiveHeader] = useState<string | null>(null);
  const [switchingHeader, setSwitchingHeader] = useState<string | null>(null);

  React.useEffect(() => {
    const mappings = columnMappings.filter(m => m.sourceId === activeSourceId);
    setActiveSourceMappings(mappings);
    if (!activeHeader && mappings.length > 0) {
      setActiveHeader(mappings[0].sourceHeader);
    }
  }, [activeSourceId, columnMappings]);

  const handleSelectHeader = (header: string) => {
    if (activeHeader === header) return;
    setSwitchingHeader(header);
    setTimeout(() => {
      setActiveHeader(header);
      setSwitchingHeader(null);
    }, 100);
  };
  
  // Local state for the currently edited mapping rules
  const [localMappings, setLocalMappings] = useState<Array<{id: string, source: string, target: string}>>([]);

  // When active header changes, load its transformations
  React.useEffect(() => {
    if (!activeHeader || !activeSourceId) return;
    const trans = transformations.find(t => t.sourceId === activeSourceId && t.sourceHeader === activeHeader);
    if (trans && trans.mappings) {
      const arr = Object.entries(trans.mappings).map(([k, v]) => ({ id: uuidv4(), source: k, target: String(v) }));
      setLocalMappings(arr);
    } else {
      setLocalMappings([]);
    }
  }, [activeHeader, activeSourceId, transformations]);

  if (sources.length === 0 || columnMappings.length === 0) {
    return <div className="p-8 text-center text-slate-500">Please map columns first.</div>;
  }

  const handleAddRule = () => {
    setLocalMappings([...localMappings, { id: uuidv4(), source: '', target: '' }]);
  };

  const handleSave = () => {
    if (!activeHeader || !activeSourceId) return;
    setIsSaving(true);

    setTimeout(() => {
      const mappingDict: Record<string, string> = {};
      localMappings.forEach(m => {
        if (m.source.trim() !== '') {
          mappingDict[m.source.trim()] = m.target.trim();
        }
      });

      const existingId = transformations.find(t => t.sourceId === activeSourceId && t.sourceHeader === activeHeader)?.id || uuidv4();
      addTransformation({
        id: existingId,
        sourceId: activeSourceId,
        sourceHeader: activeHeader,
        type: 'REPLACE',
        mappings: mappingDict
      });
      setIsSaving(false);
      toast.success('Transformations saved!');
    }, 200);
  };

  const handleProceedNext = () => {
    setIsNavigatingNext(true);
    setTimeout(() => {
      setIsNavigatingNext(false);
      onNext();
    }, 150);
  };

  const activeSource = sources.find(s => s.id === activeSourceId);
  const activeProfile = activeSource && activeHeader ? activeSource.profiles[activeHeader] : null;

  return (
    <div className="flex h-full space-x-6">
      {/* Sidebar: Mapped Columns */}
      <div className="w-72 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex flex-col overflow-hidden shrink-0 backdrop-blur-xl shadow-sm dark:shadow-xl transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 flex items-center mb-3">
            <TableProperties className="w-3.5 h-3.5 mr-2 text-emerald-600 dark:text-emerald-400" />
            Mapped Columns ({activeSourceMappings.length})
          </h3>
          
          <select 
            value={activeSourceId || ''} 
            onChange={e => {
              setActiveSourceId(e.target.value);
              setActiveHeader(null); // Reset selection
            }}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          >
            {sources.map(s => (
              <option key={s.id} value={s.id}>{s.fileName}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeSourceMappings.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
              <TableProperties className="w-6 h-6 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No columns mapped.</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">Map columns in Step 04 first.</p>
            </div>
          ) : (
            activeSourceMappings.map(mapping => {
              const hasRules = transformations.some(t => t.sourceId === activeSourceId && t.sourceHeader === mapping.sourceHeader && Object.keys(t.mappings).length > 0);
              const isActive = activeHeader === mapping.sourceHeader;
              return (
                <button
                  key={mapping.id}
                  onClick={() => handleSelectHeader(mapping.sourceHeader)}
                  disabled={switchingHeader !== null}
                  className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold transition-all flex justify-between items-center border cursor-pointer ${
                    isActive 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 shadow-sm' 
                      : 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    {switchingHeader === mapping.sourceHeader ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : null}
                    <span className="truncate">{mapping.sourceHeader}</span>
                  </div>
                  {hasRules && <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-xs"></div>}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex flex-col overflow-hidden backdrop-blur-xl shadow-sm dark:shadow-xl transition-colors">
        {activeHeader ? (
          <>
            <div className="p-6 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 flex justify-between items-center">
              <div>
                <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-mono font-semibold mb-2">
                  <span>Step 05: Categorical Transformation</span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center">
                  Value Mappings: <span className="text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-0.5 rounded-lg ml-2">{activeHeader}</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">Unique values in source: {activeProfile?.uniqueCount}</p>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all text-xs flex items-center shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-emerald-600 dark:text-emerald-400" /> : <Save className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />}
                  <span>{isSaving ? 'Saving Rules...' : 'Save Rules'}</span>
                </button>
                <button 
                  onClick={handleProceedNext} 
                  disabled={isNavigatingNext}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all text-xs shadow-lg shadow-emerald-950/20 flex items-center space-x-2 cursor-pointer"
                >
                  {isNavigatingNext ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading SQL Generator...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to SQL</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-1">Explicit Value Replacements</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Map specific legacy strings to new database enum values, IDs, or codes.</p>
                </div>
                <button 
                  onClick={handleAddRule}
                  className="px-3.5 py-2 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl transition-all text-xs font-bold flex items-center shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Replacement Rule
                </button>
              </div>

              {localMappings.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
                  <p className="text-slate-500 text-sm mb-4 font-medium">No rules defined for this column.</p>
                  <button onClick={handleAddRule} className="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline">Create first rule</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {localMappings.map((mapping, idx) => (
                    <div key={mapping.id} className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Source value (exact match)"
                          value={mapping.source}
                          onChange={(e) => {
                            const newArr = [...localMappings];
                            newArr[idx].source = e.target.value;
                            setLocalMappings(newArr);
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Target value (e.g. 15)"
                          value={mapping.target}
                          onChange={(e) => {
                            const newArr = [...localMappings];
                            newArr[idx].target = e.target.value;
                            setLocalMappings(newArr);
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-emerald-700 dark:text-emerald-200 font-bold placeholder-slate-400 dark:placeholder-slate-500"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const newArr = localMappings.filter(m => m.id !== mapping.id);
                          setLocalMappings(newArr);
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors shrink-0"
                      >
                        <Plus className="w-5 h-5 rotate-45" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions / Sample Values */}
              <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Sample Source Values (Click to add rule)</h4>
                <div className="flex flex-wrap gap-2">
                  {activeProfile?.sampleValues.map((val, i) => (
                    <button 
                      key={i}
                      onClick={() => {
                        if (!localMappings.some(m => m.source === String(val))) {
                          setLocalMappings([...localMappings, { id: uuidv4(), source: String(val), target: '' }]);
                        }
                      }}
                      className="px-3 py-1.5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors shadow-sm"
                    >
                      {String(val)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
           <div className="flex-1 flex items-center justify-center text-slate-500 font-medium">
              Select a mapped column to define transformations.
           </div>
        )}
      </div>
    </div>
  );
}
