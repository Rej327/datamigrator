import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { ArrowRight, GitMerge, AlertCircle, CheckCircle2 } from 'lucide-react';

export function ColumnMappingUI({ onNext }: { onNext: () => void }) {
  const { sources, targetTables, columnMappings, addColumnMapping, removeColumnMapping } = useStore();
  const [activeSourceId, setActiveSourceId] = useState<string | null>(sources[0]?.id || null);

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

    if (!targetPath) {
      // Find existing and remove
      const existing = columnMappings.find(m => m.sourceId === activeSourceId && m.sourceHeader === sourceHeader);
      if (existing) removeColumnMapping(existing.id);
      return;
    }

    const [tableId, columnId] = targetPath.split('::');
    addColumnMapping({
      id: uuidv4(),
      sourceId: activeSourceId,
      sourceHeader,
      targetTableId: tableId,
      targetColumnId: columnId
    });
  };

  const activeMappings = columnMappings.filter(m => m.sourceId === activeSourceId);
  const mappedCount = activeMappings.length;
  const totalSources = activeSource?.headers.length || 0;

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-6">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg flex items-center">
              <GitMerge className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" />
              Column Mapping
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Map source columns to your new schema. {mappedCount} of {totalSources} mapped.
            </p>
          </div>

          <div className="border-l border-slate-300 dark:border-slate-700 pl-6">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Active Source File</label>
            <select 
              value={activeSourceId || ''} 
              onChange={e => setActiveSourceId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md py-1.5 px-3 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            >
              {sources.map(s => (
                <option key={s.id} value={s.id}>{s.fileName}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button onClick={onNext} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 font-semibold transition-colors text-sm">
          Next: Define Transformations
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {activeSource ? (
          <div className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 overflow-hidden">
            <table className="w-full text-left text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase">
                  <th className="pb-2 pl-2 w-5/12">Source Column ({activeSource.fileName})</th>
                  <th className="pb-2 w-12 text-center"></th>
                  <th className="pb-2 w-5/12">Target Column (DB)</th>
                  <th className="pb-2 pr-2 w-16 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {activeSource.headers.map(header => {
                  const profile = activeSource.profiles[header];
                  const mapping = activeMappings.find(m => m.sourceHeader === header);
                  const mappingValue = mapping ? `${mapping.targetTableId}::${mapping.targetColumnId}` : '';

                  return (
                    <tr key={header} className={`transition-colors ${mapping ? 'bg-white dark:bg-slate-800/50 shadow-sm dark:shadow-none' : 'bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-500/20'}`}>
                      <td className={`py-3 pl-3 rounded-l-lg ${mapping ? 'border-y border-l border-slate-200 dark:border-slate-700' : 'border-y border-l border-yellow-200 dark:border-yellow-500/20'}`}>
                        <div className={`font-bold ${mapping ? 'text-slate-800 dark:text-slate-200' : 'text-yellow-800 dark:text-yellow-100'}`}>{header}</div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-mono">Type: {profile.detectedType} • Unique: {profile.uniqueCount}</div>
                      </td>
                      <td className={`py-3 text-center ${mapping ? 'border-y border-slate-200 dark:border-slate-700' : 'border-y border-yellow-200 dark:border-yellow-500/20'}`}>
                        <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 mx-auto" />
                      </td>
                      <td className={`py-3 ${mapping ? 'border-y border-slate-200 dark:border-slate-700' : 'border-y border-yellow-200 dark:border-yellow-500/20'}`}>
                        <select
                          value={mappingValue}
                          onChange={(e) => handleMappingChange(header, e.target.value)}
                          className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900/80 focus:ring-1 focus:ring-emerald-500 outline-none text-xs text-slate-800 dark:text-slate-300 font-medium"
                        >
                          <option value="">-- Do not map (Ignore) --</option>
                          {targetTables.map(table => (
                            <optgroup key={table.id} label={table.name} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                              {table.columns.map(col => (
                                <option key={col.id} value={`${table.id}::${col.id}`} className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-medium">
                                  {col.name} ({col.type})
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                      <td className={`py-3 pr-3 rounded-r-lg text-center ${mapping ? 'border-y border-r border-slate-200 dark:border-slate-700' : 'border-y border-r border-yellow-200 dark:border-yellow-500/20'}`}>
                        {mapping ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-emerald-500 mx-auto" />
                        ) : (
                          <div title="Unmapped"><AlertCircle className="w-5 h-5 text-amber-500 dark:text-yellow-500 mx-auto" /></div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500 italic">
            Select a source file to map columns.
          </div>
        )}
      </div>
    </div>
  );
}
