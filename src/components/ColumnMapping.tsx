import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { ArrowRight, GitMerge, AlertCircle, CheckCircle2, Check, Sparkles, Loader2, RotateCcw, X, Filter } from 'lucide-react';
import { toast } from 'sonner';

export function ColumnMappingUI({ onNext }: { onNext: () => void }) {
  const { sources, targetTables, columnMappings, addColumnMapping, removeColumnMapping } = useStore();
  const [activeSourceId, setActiveSourceId] = useState<string | null>(sources[0]?.id || null);
  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [isNavigatingNext, setIsNavigatingNext] = useState(false);
  const [viewFilter, setViewFilter] = useState<'ALL' | 'MAPPED' | 'UNMAPPED'>('ALL');
  const [switchingFilter, setSwitchingFilter] = useState<string | null>(null);

  const handleFilterSwitch = (filter: 'ALL' | 'MAPPED' | 'UNMAPPED') => {
    if (viewFilter === filter) return;
    setSwitchingFilter(filter);
    setTimeout(() => {
      setViewFilter(filter);
      setSwitchingFilter(null);
    }, 100);
  };

  const activeSource = sources.find(s => s.id === activeSourceId);

  const allTargetColumns = useMemo(() => {
    return targetTables.flatMap(table => 
      table.columns.map(col => ({
        ...col,
        tableId: table.id,
        tableName: table.name,
        fullPath: `${table.name}.${col.name}`
      }))
    );
  }, [targetTables]);

  if (sources.length === 0) {
    return <div className="p-8 text-center text-slate-500">Please import at least one CSV file first.</div>;
  }
  if (targetTables.length === 0) {
    return <div className="p-8 text-center text-slate-500">Please define a target schema first.</div>;
  }

  const handleMappingChange = (sourceHeader: string, targetPath: string) => {
    if (!activeSourceId) return;

    if (!targetPath || targetPath === '') {
      // Find existing and remove
      const existing = columnMappings.find(m => m.sourceId === activeSourceId && m.sourceHeader === sourceHeader);
      if (existing) {
        removeColumnMapping(existing.id);
        toast.info(`Unmapped column "${sourceHeader}"`);
      }
      return;
    }

    const [tableId, columnId] = targetPath.split('.');
    addColumnMapping({
      id: uuidv4(),
      sourceId: activeSourceId,
      sourceHeader,
      targetTableId: tableId,
      targetColumnId: columnId
    });

    const targetTable = targetTables.find(t => t.id === tableId);
    const targetCol = targetTable?.columns.find(c => c.id === columnId);
    if (targetTable && targetCol) {
      toast.success(`Mapped "${sourceHeader}" → ${targetTable.name}.${targetCol.name}`);
    }
  };

  const handleAutoMap = () => {
    if (!activeSource) return;
    setIsAutoMapping(true);

    setTimeout(() => {
      let mapped = 0;
      activeSource.headers.forEach(header => {
        const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Find best match in target tables
        for (const table of targetTables) {
          for (const col of table.columns) {
            const cleanCol = col.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanHeader === cleanCol || cleanHeader.includes(cleanCol) || cleanCol.includes(cleanHeader)) {
              addColumnMapping({
                id: uuidv4(),
                sourceId: activeSource.id,
                sourceHeader: header,
                targetTableId: table.id,
                targetColumnId: col.id
              });
              mapped++;
              return;
            }
          }
        }
      });
      setIsAutoMapping(false);
      toast.success(`Auto-mapped ${mapped} column(s) matching schema names!`);
    }, 250);
  };

  const handleClearMappings = () => {
    if (!activeSourceId) return;
    const toRemove = columnMappings.filter(m => m.sourceId === activeSourceId);
    toRemove.forEach(m => removeColumnMapping(m.id));
    toast.info('Cleared mappings for active file');
  };

  const handleProceedNext = () => {
    setIsNavigatingNext(true);
    setTimeout(() => {
      setIsNavigatingNext(false);
      onNext();
    }, 150);
  };

  const activeMappings = columnMappings.filter(m => m.sourceId === activeSourceId);
  const mappedCount = activeMappings.length;
  const totalSources = activeSource?.headers.length || 0;
  const unmappedCount = Math.max(0, totalSources - mappedCount);

  // Filtered source headers according to current viewFilter
  const filteredHeaders = useMemo(() => {
    if (!activeSource) return [];
    if (viewFilter === 'MAPPED') {
      return activeSource.headers.filter(h => activeMappings.some(m => m.sourceHeader === h));
    }
    if (viewFilter === 'UNMAPPED') {
      return activeSource.headers.filter(h => !activeMappings.some(m => m.sourceHeader === h));
    }
    return activeSource.headers;
  }, [activeSource, activeMappings, viewFilter]);

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden flex flex-col h-full backdrop-blur-xl shadow-sm dark:shadow-xl transition-colors">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-mono font-semibold mb-2">
              <span>Step 04: Attribute Alignment</span>
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight flex items-center">
              <GitMerge className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" />
              Column Mapping Engine
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Link legacy source columns to your target relational schema. <span className="text-emerald-600 dark:text-emerald-400 font-bold">{mappedCount}</span> mapped • <span className="text-amber-600 dark:text-amber-400 font-bold">{unmappedCount}</span> unmapped.
            </p>
          </div>

          <div className="border-l border-slate-200 dark:border-slate-800 pl-6">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Active Source File</label>
            <select 
              value={activeSourceId || ''} 
              onChange={e => setActiveSourceId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            >
              {sources.map(s => (
                <option key={s.id} value={s.id}>{s.fileName}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center space-x-2.5">
          <button 
            onClick={handleAutoMap}
            disabled={isAutoMapping}
            className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold transition-all text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Auto-match columns with similar names"
          >
            {isAutoMapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            <span>{isAutoMapping ? 'Matching Columns...' : 'Auto-Map Columns'}</span>
          </button>

          {mappedCount > 0 && (
            <button 
              onClick={handleClearMappings}
              className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold transition-all text-xs flex items-center space-x-1 shadow-xs cursor-pointer"
              title="Reset all column mappings"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Reset All</span>
            </button>
          )}

          <button 
            onClick={handleProceedNext} 
            disabled={isNavigatingNext}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all text-xs shadow-lg shadow-emerald-950/20 flex items-center space-x-2 cursor-pointer"
          >
            {isNavigatingNext ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading Transformations...</span>
              </>
            ) : (
              <>
                <span>Next: Transformations</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Sub-header Filter Tabs */}
      <div className="px-6 py-2.5 bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center mr-1">
            <Filter className="w-3 h-3 mr-1" /> Filter View:
          </span>
          <button
            onClick={() => handleFilterSwitch('ALL')}
            disabled={switchingFilter !== null}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
              viewFilter === 'ALL'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {switchingFilter === 'ALL' && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            <span>All Columns ({totalSources})</span>
          </button>
          <button
            onClick={() => handleFilterSwitch('MAPPED')}
            disabled={switchingFilter !== null}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
              viewFilter === 'MAPPED'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {switchingFilter === 'MAPPED' && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            <span>Mapped ({mappedCount})</span>
          </button>
          <button
            onClick={() => handleFilterSwitch('UNMAPPED')}
            disabled={switchingFilter !== null}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
              viewFilter === 'UNMAPPED'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {switchingFilter === 'UNMAPPED' && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            <span>Unmapped ({unmappedCount})</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeSource ? (
          <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-3 overflow-hidden shadow-xs">
            {filteredHeaders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No columns match the selected filter view ({viewFilter}).
              </div>
            ) : (
              <table className="w-full text-left text-sm border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    <th className="pb-2 pl-3 w-4/12">Source Column ({activeSource.fileName})</th>
                    <th className="pb-2 w-10 text-center"></th>
                    <th className="pb-2 w-5/12">Target Column (Database)</th>
                    <th className="pb-2 pr-3 w-3/12 text-right">Mapping Status & Action</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {filteredHeaders.map(header => {
                    const mapping = activeMappings.find(m => m.sourceHeader === header);
                    const isMapped = !!mapping;
                    const profile = activeSource.profiles[header];
                    
                    return (
                      <tr key={header} className="bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs rounded-xl">
                        <td className="py-3 px-3 rounded-l-xl border-y border-l border-slate-200 dark:border-slate-700/80">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{header}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            {profile?.detectedType} • {profile?.uniqueCount} unique values
                          </div>
                        </td>
                        <td className="py-3 text-center border-y border-slate-200 dark:border-slate-700/80">
                          <ArrowRight className={`w-4 h-4 mx-auto ${isMapped ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                        </td>
                        <td className="py-3 px-3 border-y border-slate-200 dark:border-slate-700/80">
                          <select
                            value={mapping ? `${mapping.targetTableId}.${mapping.targetColumnId}` : ''}
                            onChange={(e) => handleMappingChange(header, e.target.value)}
                            className={`w-full p-2.5 rounded-lg text-xs font-mono outline-none border transition-colors cursor-pointer ${
                              isMapped 
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold' 
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500'
                            }`}
                          >
                            {targetTables.map(table => (
                              <optgroup key={table.id} label={`Table: ${table.name}`}>
                                {table.columns.map(col => (
                                  <option key={col.id} value={`${table.id}.${col.id}`}>
                                    {table.name}.{col.name} ({col.type})
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 pr-3 rounded-r-xl border-y border-r border-slate-200 dark:border-slate-700/80 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {isMapped ? (
                              <>
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                                  <Check className="w-3 h-3" />
                                  <span>Mapped</span>
                                </span>
                                <button
                                  onClick={() => handleMappingChange(header, '')}
                                  className="px-2 py-1 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 rounded-md text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
                                  title="Unmap this column"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Unmap</span>
                                </button>
                              </>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase">
                                Unmapped
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm">Please select a source file to configure mappings.</div>
        )}
      </div>
    </div>
  );
}
