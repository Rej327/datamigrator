import React, { useState } from 'react';
import { useStore } from '../store';
import { TargetTable, TargetColumn } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Plus, Trash2, Key, Database, Server, Upload, X } from 'lucide-react';

const parseSimpleDDL = (ddl: string, fallbackTableName = 'new_table'): TargetTable[] => {
  const tables: TargetTable[] = [];
  const cleanDdl = ddl.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); 
  
  const statements = cleanDdl.split(/CREATE\s+(?:(?:OR\s+REPLACE|TEMP|TEMPORARY|UNLOGGED|GLOBAL|LOCAL|VOLATILE|SET|MULTISET)\s+)*TABLE/i);
  
  for (let i = 1; i < statements.length; i++) {
    const stmt = statements[i];
    
    const firstParenIdx = stmt.indexOf('(');
    if (firstParenIdx === -1) continue;
    
    const tableHeader = stmt.substring(0, firstParenIdx).trim();
    let namePart = tableHeader.replace(/IF\s+NOT\s+EXISTS\s+/i, '').trim();
    let tableName = namePart.replace(/["'`\[\]]/g, '');
    if (tableName.includes('.')) tableName = tableName.split('.').pop() || tableName;
    
    const bodyText = stmt.substring(firstParenIdx + 1);
    const columnStrs: string[] = [];
    let current = '';
    let parenCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let j = 0; j < bodyText.length; j++) {
      const char = bodyText[j];
      
      if (!inString && (char === "'" || char === '"' || char === '`')) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        current += char;
      } else if (!inString && char === '(') {
        parenCount++;
        current += char;
      } else if (!inString && char === ')') {
        if (parenCount === 0) break;
        parenCount--;
        current += char;
      } else if (!inString && char === ',' && parenCount === 0) {
        if (current.trim()) columnStrs.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) columnStrs.push(current.trim());
    
    const columns: TargetColumn[] = [];
    columnStrs.forEach(colStr => {
      if (/^(?:CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|INDEX|KEY)\b/i.test(colStr)) return;
      
      const parts = colStr.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const rawName = parts[0].replace(/["'`\[\]]/g, '');
        const rawType = parts[1].toLowerCase();
        
        let mappedType: TargetColumn['type'] = 'varchar';
        if (rawType.includes('int')) mappedType = 'integer';
        if (rawType.includes('bigint')) mappedType = 'bigint';
        if (rawType.includes('uuid')) mappedType = 'uuid';
        if (rawType.includes('bool') || rawType.includes('bit')) mappedType = 'boolean';
        if (rawType.includes('date')) mappedType = 'date';
        if (rawType.includes('time')) mappedType = 'timestamp';
        if (rawType.includes('json')) mappedType = 'json';
        if (rawType.includes('numeric') || rawType.includes('dec')) mappedType = 'numeric';
        if (rawType.includes('real') || rawType.includes('double') || rawType.includes('float')) mappedType = 'real';
        if (rawType.includes('text') || rawType.includes('char')) mappedType = 'text';
        if (rawType.includes('serial')) mappedType = 'serial';
        if (rawType.includes('enum')) mappedType = 'enum';
        
        const isPrimaryKey = colStr.toUpperCase().includes('PRIMARY KEY');
        const isNotNull = colStr.toUpperCase().includes('NOT NULL');
        
        columns.push({
          id: uuidv4(),
          name: rawName,
          type: mappedType,
          nullable: !isNotNull,
          isPrimaryKey,
          isImported: true
        });
      }
    });
    
    if (columns.length > 0) {
      tables.push({
        id: uuidv4(),
        name: tableName,
        columns,
        isImported: true
      });
    }
  }
  return tables;
};

export function TargetSchema({ onNext }: { onNext: () => void }) {
  const { targetTables, addTargetTable, updateTargetTable, removeTargetTable } = useStore();
  const [activeTableId, setActiveTableId] = useState<string | null>(targetTables[0]?.id || null);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [ddlInput, setDdlInput] = useState('');

  const handleAddTable = () => {
    const newTable: TargetTable = {
      id: uuidv4(),
      name: 'new_table',
      columns: [
        { id: uuidv4(), name: 'id', type: 'uuid', isPrimaryKey: true, nullable: false, isImported: false }
      ],
      isImported: false
    };
    addTargetTable(newTable);
    setActiveTableId(newTable.id);
  };

  const handleAddColumn = (tableId: string) => {
    const table = targetTables.find(t => t.id === tableId);
    if (!table) return;
    
    const newTable = {
      ...table,
      columns: [
        ...table.columns,
        { id: uuidv4(), name: 'new_column', type: 'varchar', nullable: true, isImported: false } as TargetColumn
      ]
    };
    updateTargetTable(newTable);
  };

  const handleImportDDL = () => {
    if (!ddlInput.trim()) return;
    let parsedTables = parseSimpleDDL(ddlInput);
    
    // Fallback: if no tables found, try to parse as just a list of columns
    if (parsedTables.length === 0 && !ddlInput.toUpperCase().includes('TABLE')) {
      const fallbackDdl = `CREATE TABLE imported_table (\n${ddlInput}\n);`;
      const fallbackTables = parseSimpleDDL(fallbackDdl, 'imported_table');
      if (fallbackTables.length > 0 && fallbackTables[0].columns.length > 0) {
        parsedTables = fallbackTables;
      }
    }

    if (parsedTables.length > 0) {
      parsedTables.forEach(t => addTargetTable(t));
      setActiveTableId(parsedTables[0].id);
      setShowImportModal(false);
      setDdlInput('');
      toast.success(`Successfully imported ${parsedTables.length} table(s)`);
    } else {
      toast.error('Could not parse any CREATE TABLE statements. Please check your SQL syntax or try pasting just the column definitions separated by commas.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setDdlInput(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const activeTable = targetTables.find(t => t.id === activeTableId);

  const DATA_TYPES = [
    'uuid', 'varchar', 'text', 'integer', 'bigint', 'boolean', 
    'date', 'timestamp', 'timestamptz', 'serial', 'bigserial', 
    'json', 'jsonb', 'numeric', 'real', 'double precision', 'enum'
  ];

  return (
    <div className="flex h-full space-x-4 relative">
      {/* Sidebar: Table List */}
      <div className="w-64 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center">
              <Database className="w-3.5 h-3.5 mr-2 text-emerald-600 dark:text-emerald-400" />
              Target Tables
            </h3>
            <button onClick={handleAddTable} title="Add Table Manually" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => setShowImportModal(true)}
            className="w-full py-1.5 px-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-400 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center justify-center"
          >
            <Upload className="w-3 h-3 mr-1.5" /> Import DDL Schema
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {targetTables.length === 0 ? (
            <div className="text-sm text-slate-500 p-4 text-center">No tables defined yet.</div>
          ) : (
            targetTables.map(table => (
              <button
                key={table.id}
                onClick={() => setActiveTableId(table.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex justify-between items-center border ${
                  activeTableId === table.id 
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' 
                    : 'bg-white dark:bg-slate-900/50 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="truncate flex items-center">
                  <span className="truncate">{table.name}</span>
                  {table.isImported && (
                    <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase">Imported</span>
                  )}
                </div>
                <Trash2 
                  className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ${activeTableId === table.id ? 'opacity-100 text-emerald-500 dark:text-emerald-400' : ''}`}
                  onClick={(e) => { e.stopPropagation(); removeTargetTable(table.id); if(activeTableId===table.id) setActiveTableId(null); }}
                />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Table Editor */}
      <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        {activeTable ? (
          <>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-4">
                <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <input
                  type="text"
                  value={activeTable.name}
                  onChange={(e) => updateTargetTable({ ...activeTable, name: e.target.value })}
                  className="text-xl font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none focus:ring-0 p-0 hover:bg-slate-200 dark:hover:bg-slate-800 rounded px-2 py-1 transition-colors"
                />
              </div>
              <button onClick={onNext} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 font-semibold transition-colors text-sm shadow-sm">
                Next: Map Columns
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Columns</h4>
                <button 
                  onClick={() => handleAddColumn(activeTable.id)}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/20"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Column
                </button>
              </div>

              <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-2">
                <table className="w-full text-left text-sm border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-slate-500 text-[10px] uppercase">
                      <th className="pb-2 w-8"></th>
                      <th className="pb-2 pl-2">Column Name</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Nullable</th>
                      <th className="pb-2 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {activeTable.columns.map((col, idx) => (
                      <tr key={col.id} className="bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm dark:shadow-none">
                        <td className="py-2 rounded-l-lg border-y border-l border-slate-200 dark:border-slate-700 text-center pl-2 relative">
                          {col.isPrimaryKey && <Key className="w-3.5 h-3.5 text-amber-500 inline" />}
                          {!col.isImported && activeTable.isImported && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-lg" title="New column added to imported table"></div>
                          )}
                        </td>
                        <td className="py-2 border-y border-slate-200 dark:border-slate-700 px-2">
                          <input
                            type="text"
                            value={col.name}
                            onChange={(e) => {
                              const newCols = [...activeTable.columns];
                              newCols[idx] = { ...col, name: e.target.value };
                              updateTargetTable({ ...activeTable, columns: newCols });
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 p-1.5 focus:ring-1 focus:ring-emerald-500 rounded outline-none text-slate-800 dark:text-slate-200 font-medium"
                          />
                        </td>
                        <td className="py-2 border-y border-slate-200 dark:border-slate-700 px-2">
                          <select
                            value={col.type}
                            onChange={(e) => {
                              const newCols = [...activeTable.columns];
                              newCols[idx] = { ...col, type: e.target.value as any };
                              updateTargetTable({ ...activeTable, columns: newCols });
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none text-slate-700 dark:text-slate-300 font-mono uppercase"
                          >
                            {DATA_TYPES.map(type => (
                              <option key={type} value={type}>{type.toUpperCase()}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 border-y border-slate-200 dark:border-slate-700 px-2">
                          <input
                            type="checkbox"
                            checked={col.nullable || false}
                            onChange={(e) => {
                              const newCols = [...activeTable.columns];
                              newCols[idx] = { ...col, nullable: e.target.checked };
                              updateTargetTable({ ...activeTable, columns: newCols });
                            }}
                            className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500"
                            disabled={col.isPrimaryKey}
                          />
                        </td>
                        <td className="py-2 rounded-r-lg border-y border-r border-slate-200 dark:border-slate-700 text-right pr-4">
                          <button
                            onClick={() => {
                              const newCols = activeTable.columns.filter(c => c.id !== col.id);
                              updateTargetTable({ ...activeTable, columns: newCols });
                            }}
                            className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                            disabled={col.isPrimaryKey}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
            <Database className="w-12 h-12 mb-4 text-slate-400 dark:text-slate-700" />
            <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400">No Table Selected</h3>
            <p className="text-sm mt-1 mb-4 text-center max-w-md">Create a new table or import an existing schema to begin.</p>
            <div className="flex space-x-3">
              <button onClick={handleAddTable} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 font-semibold transition-colors text-sm">
                Create Table
              </button>
              <button onClick={() => setShowImportModal(true)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold transition-colors text-sm shadow-sm">
                Import DDL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DDL Import Modal */}
      {showImportModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Import SQL Schema</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Paste your existing <code className="font-mono text-xs bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded">CREATE TABLE</code> statements below, or upload a <code className="font-mono text-xs bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded">.sql</code> file. 
                Any new columns added after import will be treated as <code className="font-mono text-xs bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded">ALTER TABLE</code> statements during generation.
              </p>
              
              <div className="flex items-center space-x-4">
                <label className="cursor-pointer px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm font-semibold flex items-center">
                  <Upload className="w-4 h-4 mr-2" /> Upload .sql File
                  <input type="file" accept=".sql" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              <div>
                <textarea
                  value={ddlInput}
                  onChange={(e) => setDdlInput(e.target.value)}
                  placeholder="CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  name varchar(255) NOT NULL,
  created_at timestamp
);"
                  className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-xs text-slate-800 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3">
              <button 
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 font-semibold text-sm hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleImportDDL}
                disabled={!ddlInput.trim()}
                className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 font-semibold transition-colors text-sm disabled:opacity-50"
              >
                Parse & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
