import React, { useState } from 'react';
import { useStore } from '../store';
import { Play, Download, Code, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function GenerateSQL() {
  const { targetTables, columnMappings, transformations, sources } = useStore();
  
  const [schemaSql, setSchemaSql] = useState('');
  const [seedSql, setSeedSql] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const hasMissingRawData = sources.some(s => !s.rawRows || s.rawRows.length === 0);

  const generateSchema = () => {
    let sql = '';
    targetTables.forEach(table => {
      if (table.isImported) {
        // Find columns that were added after import
        const newColumns = table.columns.filter(col => !col.isImported);
        if (newColumns.length > 0) {
          sql += `-- Altering existing table: ${table.name}\n`;
          newColumns.forEach(col => {
            let def = `ALTER TABLE ${table.name} ADD COLUMN ${col.name} ${col.type}`;
            if (!col.nullable && !col.isPrimaryKey) def += ' NOT NULL';
            sql += def + ';\n';
          });
          sql += '\n';
        } else {
          sql += `-- Table ${table.name} is imported and has no structural changes.\n\n`;
        }
      } else {
        // Standard create table
        sql += `CREATE TABLE ${table.name} (\n`;
        const colDefs = table.columns.map(col => {
          let def = `  ${col.name} ${col.type}`;
          if (col.isPrimaryKey) def += ' PRIMARY KEY';
          else if (!col.nullable) def += ' NOT NULL';
          return def;
        });
        sql += colDefs.join(',\n');
        sql += '\n);\n\n';
      }
    });
    return sql;
  };

  const generateSeed = async () => {
    if (sources.length === 0) return '';
    
    let finalSql = '';

    // Group inserts by table across all sources
    const tableInserts: Record<string, string[]> = {};
    targetTables.forEach(t => tableInserts[t.name] = []);

    for (const source of sources) {
      if (!source.rawRows) continue;

      const rows = source.rawRows;

      // Build logic mapping for this specific source file
      const mappingLogic: Record<string, any> = {};
      targetTables.forEach(table => {
        mappingLogic[table.id] = {};
        table.columns.forEach(col => {
          // Find mapping for THIS target column that comes from THIS source file
          const mapping = columnMappings.find(m => m.targetColumnId === col.id && m.sourceId === source.id);
          if (mapping) {
            const trans = transformations.find(t => t.sourceHeader === mapping.sourceHeader && t.sourceId === source.id);
            mappingLogic[table.id][col.name] = {
              sourceHeader: mapping.sourceHeader,
              rules: trans ? trans.mappings : {}
            };
          }
        });
      });

      const total = rows.length;
      let processed = 0;
      const chunkSize = 1000;
      
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        
        chunk.forEach(row => {
          targetTables.forEach(table => {
            const logic = mappingLogic[table.id];
            const colsToInsert = Object.keys(logic);
            if (colsToInsert.length === 0) return; // Skip if no mappings from this file to this table

            const vals = colsToInsert.map(colName => {
              const { sourceHeader, rules } = logic[colName];
              let rawValue = row[sourceHeader];
              
              // Apply transformation
              if (rules && rules[rawValue] !== undefined) {
                rawValue = rules[rawValue];
              }

              // SQL format
              if (rawValue === null || rawValue === undefined || rawValue === '') return 'NULL';
              if (typeof rawValue === 'number') return rawValue;
              if (typeof rawValue === 'boolean') return rawValue ? 'TRUE' : 'FALSE';
              
              // Basic string escaping
              return `'${String(rawValue).replace(/'/g, "''")}'`;
            });

            // Only insert if at least one value is not NULL
            if (vals.some(v => v !== 'NULL')) {
              const valString = `(${vals.join(', ')})`;
              tableInserts[table.name].push(valString);
            }
          });
        });

        processed += chunk.length;
        setProgress(Math.floor((processed / total) * 100));
        // Yield to main thread
        await new Promise(r => setTimeout(r, 0));
      }
    }

    // Build final SQL string
    Object.keys(tableInserts).forEach(tableName => {
      // Find columns that have any mapping across any source
      const mappedColumns = new Set<string>();
      targetTables.find(t => t.name === tableName)?.columns.forEach(c => {
        if (columnMappings.some(m => m.targetColumnId === c.id)) {
          mappedColumns.add(c.name);
        }
      });

      const cols = Array.from(mappedColumns);
      
      if (cols.length === 0 || tableInserts[tableName].length === 0) return;

      finalSql += `INSERT INTO ${tableName} (${cols.join(', ')})\nVALUES\n`;
      finalSql += tableInserts[tableName].join(',\n');
      finalSql += ';\n\n';
    });

    return finalSql;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    
    try {
      const schema = generateSchema();
      setSchemaSql(schema);

      const seed = await generateSeed();
      setSeedSql(seed);
    } catch (error) {
      toast.error('Error generating SQL');
      console.error(error);
    } finally {
      setIsGenerating(false);
      setProgress(100);
    }
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-6xl mx-auto flex flex-col h-full">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-1">Generate SQL Outputs</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Apply rules and generate target schema and seed data SQL files.</p>
        </div>
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || targetTables.length === 0 || hasMissingRawData}
          className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 font-semibold transition-colors shadow-sm flex items-center disabled:opacity-50 text-sm"
        >
          {isGenerating ? (
            <span>Generating ({progress}%)...</span>
          ) : (
             <><Play className="w-4 h-4 mr-2" /> Start Generation</>
          )}
        </button>
      </div>

      {hasMissingRawData && (
        <div className="mb-6 shrink-0 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 flex items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 mr-3 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">Raw Data Missing</h4>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
              One or more imported files lost their raw data payload (usually due to a page reload). 
              You can still view the schema, but you must re-import the CSV files in Step 1 to generate Seed SQL.
            </p>
          </div>
        </div>
      )}

      {(schemaSql || seedSql) && (
        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          <div className="flex-1 flex space-x-4 min-h-0">
            {/* Schema SQL */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center text-[10px] uppercase tracking-wider"><Code className="w-3.5 h-3.5 mr-2" /> schema.sql</span>
                <button 
                  onClick={() => downloadFile('schema.sql', schemaSql)}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-xs font-semibold flex items-center"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Download
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-white dark:bg-transparent text-slate-800 dark:text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre">
                {schemaSql}
              </div>
            </div>

            {/* Seed SQL */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center text-[10px] uppercase tracking-wider"><Code className="w-3.5 h-3.5 mr-2" /> seed.sql</span>
                <button 
                  onClick={() => downloadFile('seed.sql', seedSql)}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-xs font-semibold flex items-center"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Download
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-white dark:bg-transparent text-emerald-700 dark:text-emerald-200 font-mono text-[11px] leading-relaxed whitespace-pre opacity-90">
                {seedSql ? seedSql : 'No seed data generated (check mappings).'}
              </div>
            </div>
          </div>
          
          <div className="shrink-0 bg-green-50 dark:bg-emerald-500/10 border border-green-200 dark:border-emerald-500/20 rounded-lg p-3 flex items-center">
             <CheckCircle className="w-4 h-4 text-green-600 dark:text-emerald-400 mr-3" />
             <div>
                <h4 className="font-bold text-green-800 dark:text-emerald-400 text-sm">Generation Complete</h4>
                <p className="text-xs text-green-700 dark:text-emerald-500/80 mt-0.5">Schema and seed SQL generated successfully. Download the files to run in your target database.</p>
             </div>
          </div>
        </div>
      )}

      {!schemaSql && !isGenerating && (
        <div className="flex-1 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/30 text-slate-500 text-center p-8">
          <div>
            <Code className="w-12 h-12 text-slate-400 dark:text-slate-700 mx-auto mb-4" />
            <p className="font-medium">Click "Start Generation" to apply rules and create SQL files.</p>
          </div>
        </div>
      )}
    </div>
  );
}
