import React, { useState } from 'react';
import { useStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { TableProperties, Save, Plus, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Transformation } from '../types';

export function Transformations({ onNext }: { onNext: () => void }) {
  const { sources, columnMappings, transformations, addTransformation } = useStore();
  
  const [activeSourceId, setActiveSourceId] = useState<string | null>(sources[0]?.id || null);
  
  const activeSourceMappings = columnMappings.filter(m => m.sourceId === activeSourceId);
  const [activeHeader, setActiveHeader] = useState<string | null>(activeSourceMappings[0]?.sourceHeader || null);
  
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
    toast.success('Transformations saved!');
  };

  const activeSource = sources.find(s => s.id === activeSourceId);
  const activeProfile = activeSource && activeHeader ? activeSource.profiles[activeHeader] : null;

  return (
    <div className="flex h-full space-x-4">
      {/* Sidebar: Mapped Columns */}
      <div className="w-64 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center mb-3">
            <TableProperties className="w-3.5 h-3.5 mr-2 text-emerald-600 dark:text-emerald-400" />
            Mapped Columns
          </h3>
          
          <select 
            value={activeSourceId || ''} 
            onChange={e => {
              setActiveSourceId(e.target.value);
              setActiveHeader(null); // Reset selection
            }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md py-1.5 px-2 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
          >
            {sources.map(s => (
              <option key={s.id} value={s.id}>{s.fileName}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeSourceMappings.length === 0 ? (
            <div className="text-xs text-slate-500 p-2 text-center">No columns mapped for this file.</div>
          ) : (
            activeSourceMappings.map(mapping => {
              const hasRules = transformations.some(t => t.sourceId === activeSourceId && t.sourceHeader === mapping.sourceHeader && Object.keys(t.mappings).length > 0);
              return (
                <button
                  key={mapping.id}
                  onClick={() => setActiveHeader(mapping.sourceHeader)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex justify-between items-center border ${
                    activeHeader === mapping.sourceHeader 
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' 
                      : 'bg-white dark:bg-slate-900/50 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{mapping.sourceHeader}</span>
                  {hasRules && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        {activeHeader ? (
          <>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Value Replacements: <span className="text-emerald-600 dark:text-emerald-300 font-mono bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded ml-2">{activeHeader}</span></h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-semibold">Unique values in source: {activeProfile?.uniqueCount}</p>
              </div>
              <div className="flex space-x-3">
                <button onClick={handleSave} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold transition-colors text-sm flex items-center shadow-sm">
                  <Save className="w-4 h-4 mr-2" /> Save Rules
                </button>
                <button onClick={onNext} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 font-semibold transition-colors text-sm shadow-sm flex items-center">
                  Next: Generate <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Replacement Rules</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Map specific source strings to new values (e.g. IDs).</p>
                </div>
                <button 
                  onClick={handleAddRule}
                  className="px-3 py-1.5 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-xs font-bold flex items-center uppercase tracking-wider"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
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
