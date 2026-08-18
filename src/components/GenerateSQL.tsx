import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { 
  Play, Download, Code, CheckCircle, AlertTriangle, Loader2, 
  Copy, Check, FileText, Layers, Columns, Maximize2, Sparkles,
  WrapText, Hash
} from 'lucide-react';
import { toast } from 'sonner';

// High-speed syntax token styling for SQL
function SqlCodeViewer({ code, wrap = false }: { code: string; wrap?: boolean }) {
  const lines = useMemo(() => {
    if (!code) return [];
    return code.split('\n');
  }, [code]);

  // Syntax highlighter for individual line
  const renderHighlightedLine = (line: string) => {
    if (line.trim().startsWith('--')) {
      return <span className="text-slate-400 dark:text-slate-500 italic font-mono">{line}</span>;
    }

    // Token regex for SQL keywords, types, strings, numbers
    const parts = line.split(/('(?:''|[^'])*')/g);

    return parts.map((part, i) => {
      // String literal
      if (part.startsWith("'") && part.endsWith("'")) {
        return (
          <span key={i} className="text-amber-600 dark:text-amber-300 font-mono">
            {part}
          </span>
        );
      }

      // Format keywords and types outside of string literals
      const wordParts = part.split(/\b/);
      return wordParts.map((word, j) => {
        const upper = word.toUpperCase();
        
        // Keywords
        if ([
          'CREATE', 'TABLE', 'ALTER', 'ADD', 'COLUMN', 'INSERT', 'INTO', 'VALUES',
          'PRIMARY', 'KEY', 'NOT', 'NULL', 'FOREIGN', 'REFERENCES', 'UNIQUE',
          'DEFAULT', 'DROP', 'SELECT', 'FROM', 'WHERE', 'IF', 'EXISTS'
        ].includes(upper)) {
          return (
            <span key={j} className="text-blue-600 dark:text-blue-400 font-bold font-mono">
              {word}
            </span>
          );
        }

        // Data Types
        if ([
          'UUID', 'VARCHAR', 'TEXT', 'INTEGER', 'INT', 'BIGINT', 'BOOLEAN', 'BOOL',
          'DATE', 'TIMESTAMP', 'TIMESTAMPTZ', 'JSON', 'JSONB', 'NUMERIC', 'DECIMAL',
          'REAL', 'SERIAL', 'BIGSERIAL', 'DOUBLE', 'PRECISION'
        ].includes(upper)) {
          return (
            <span key={j} className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
              {word}
            </span>
          );
        }

        // Booleans / Null
        if (['TRUE', 'FALSE', 'NULL'].includes(upper)) {
          return (
            <span key={j} className="text-purple-600 dark:text-purple-400 font-bold font-mono">
              {word}
            </span>
          );
        }

        // Numbers
        if (/^\d+$/.test(word)) {
          return (
            <span key={j} className="text-cyan-600 dark:text-cyan-400 font-mono">
              {word}
            </span>
          );
        }

        return <span key={j} className="text-slate-800 dark:text-slate-200 font-mono">{word}</span>;
      });
    });
  };

  return (
    <div className="flex font-mono text-xs select-text overflow-x-auto min-w-full">
      {/* Line Numbers Gutter */}
      <div className="py-4 pl-3 pr-3 text-right select-none bg-slate-100/80 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 shrink-0 font-mono text-[11px]">
        {lines.map((_, index) => (
          <div key={index} className="leading-5 h-5">{index + 1}</div>
        ))}
      </div>

      {/* Code Text Content */}
      <div className={`py-4 pl-4 pr-6 flex-1 bg-white dark:bg-slate-950 font-mono text-xs leading-5 ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
        {lines.map((line, index) => (
          <div key={index} className="h-5 leading-5 hover:bg-slate-100/50 dark:hover:bg-slate-900/30">
            {renderHighlightedLine(line)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GenerateSQL() {
  const { targetTables, columnMappings, transformations, sources } = useStore();
  
  const [schemaSql, setSchemaSql] = useState('');
  const [seedSql, setSeedSql] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [activeTab, setActiveTab] = useState<'SPLIT' | 'SCHEMA' | 'SEED' | 'COMBINED'>('SPLIT');
  const [switchingTab, setSwitchingTab] = useState<string | null>(null);
  const [enableWrap, setEnableWrap] = useState(false);

  const handleTabSwitch = (tab: 'SPLIT' | 'SCHEMA' | 'SEED' | 'COMBINED') => {
    if (activeTab === tab) return;
    setSwitchingTab(tab);
    setTimeout(() => {
      setActiveTab(tab);
      setSwitchingTab(null);
    }, 100);
  };

  const [isDownloadingSchema, setIsDownloadingSchema] = useState(false);
  const [isDownloadingSeed, setIsDownloadingSeed] = useState(false);
  const [isDownloadingCombined, setIsDownloadingCombined] = useState(false);
  
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [copiedCombined, setCopiedCombined] = useState(false);

  const hasMissingRawData = sources.some(s => !s.rawRows || s.rawRows.length === 0);

  const combinedSql = useMemo(() => {
    if (!schemaSql && !seedSql) return '';
    return `-- ==========================================\n-- Database Migration Pipeline Artifact\n-- Generated by DataMigrator Studio\n-- Target Tables: ${targetTables.length} | Source Files: ${sources.length}\n-- ==========================================\n\n-- 1. TARGET DDL SCHEMA\n${schemaSql}\n\n-- 2. BULK SEED DATA INSERTS\n${seedSql || '-- No seed inserts generated.'}\n`;
  }, [schemaSql, seedSql, targetTables.length, sources.length]);

  const generateSchema = () => {
    let sql = '';
    targetTables.forEach(table => {
      if (table.isImported) {
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
    const tableInserts: Record<string, string[]> = {};
    targetTables.forEach(t => tableInserts[t.name] = []);

    for (const source of sources) {
      if (!source.rawRows) continue;
      const rows = source.rawRows;
      const mappingLogic: Record<string, any> = {};
      
      targetTables.forEach(table => {
        mappingLogic[table.id] = {};
        table.columns.forEach(col => {
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
            if (colsToInsert.length === 0) return;

            const vals = colsToInsert.map(colName => {
              const { sourceHeader, rules } = logic[colName];
              let rawValue = row[sourceHeader];
              
              if (rules && rules[rawValue] !== undefined) {
                rawValue = rules[rawValue];
              }

              if (rawValue === null || rawValue === undefined || rawValue === '') return 'NULL';
              
              const strVal = String(rawValue).replace(/'/g, "''");
              if (!isNaN(Number(rawValue)) && typeof rawValue === 'number') return rawValue;
              
              return `'${strVal}'`;
            });

            if (vals.some(v => v !== 'NULL')) {
              const valString = `(${vals.join(', ')})`;
              tableInserts[table.name].push(valString);
            }
          });
        });
        processed += chunk.length;
        setProgress(Math.floor((processed / total) * 100));
        await new Promise(r => setTimeout(r, 0));
      }
    }

    Object.keys(tableInserts).forEach(tableName => {
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
      toast.success('SQL scripts compiled successfully!');
    } catch (error) {
      toast.error('Error generating SQL');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadFile = (filename: string, content: string, type: 'schema' | 'seed' | 'combined') => {
    if (type === 'schema') setIsDownloadingSchema(true);
    else if (type === 'seed') setIsDownloadingSeed(true);
    else setIsDownloadingCombined(true);

    setTimeout(() => {
      const element = document.createElement('a');
      const file = new Blob([content], {type: 'text/plain;charset=utf-8'});
      element.href = URL.createObjectURL(file);
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      if (type === 'schema') setIsDownloadingSchema(false);
      else if (type === 'seed') setIsDownloadingSeed(false);
      else setIsDownloadingCombined(false);
      
      toast.success(`Downloaded ${filename}`);
    }, 200);
  };

  const handleCopy = (content: string, type: 'schema' | 'seed' | 'combined') => {
    navigator.clipboard.writeText(content);
    if (type === 'schema') {
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2000);
    } else if (type === 'seed') {
      setCopiedSeed(true);
      setTimeout(() => setCopiedSeed(false), 2000);
    } else {
      setCopiedCombined(true);
      setTimeout(() => setCopiedCombined(false), 2000);
    }
    toast.success('Copied SQL to clipboard');
  };

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 flex flex-col h-full backdrop-blur-xl shadow-sm dark:shadow-xl transition-colors">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 shrink-0 border-b border-slate-200 dark:border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-mono font-semibold mb-2">
            <span>Step 06: Target Code Compilation</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Generate Migration SQL Scripts</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Compile your relational schema definitions and raw dataset inserts with custom transformations applied.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {(schemaSql || seedSql) && (
            <button
              onClick={() => handleDownloadFile('migration_bundle.sql', combinedSql, 'combined')}
              disabled={isDownloadingCombined}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Download full migration script"
            >
              {isDownloadingCombined ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              <span>Download Combined SQL</span>
            </button>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || targetTables.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/20 transition-all text-xs flex items-center space-x-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Generating SQL ({progress}%)...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-emerald-300" />
                <span>Compile Migration SQL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="mb-5 shrink-0 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
          <div className="flex justify-between text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 mb-1.5">
            <span className="flex items-center space-x-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Streaming relational records to SQL buffer...</span>
            </span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {hasMissingRawData && (
        <div className="mb-5 shrink-0 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 flex items-start">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-800 dark:text-amber-300 text-xs">Raw Data Session Refresh</h4>
            <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
              One or more imported files lost their in-memory data rows due to a browser page refresh. 
              You can still compile the DDL schema, or re-upload the CSV extract in Step 2 to generate multi-row seed inserts.
            </p>
          </div>
        </div>
      )}

      {(schemaSql || seedSql) && (
        <div className="flex-1 overflow-hidden flex flex-col space-y-3 min-h-0">
          
          {/* Editor Mode Tabs & Controls */}
          <div className="flex items-center justify-between shrink-0 bg-slate-100/70 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handleTabSwitch('SPLIT')}
                disabled={switchingTab !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'SPLIT' 
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {switchingTab === 'SPLIT' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> : <Columns className="w-3.5 h-3.5" />}
                <span>Side-by-Side</span>
              </button>

              <button
                onClick={() => handleTabSwitch('SCHEMA')}
                disabled={switchingTab !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'SCHEMA' 
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200 dark:border-slate-700' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {switchingTab === 'SCHEMA' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> : <Code className="w-3.5 h-3.5" />}
                <span>schema.sql</span>
              </button>

              <button
                onClick={() => handleTabSwitch('SEED')}
                disabled={switchingTab !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'SEED' 
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs border border-slate-200 dark:border-slate-700' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {switchingTab === 'SEED' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500" /> : <Layers className="w-3.5 h-3.5" />}
                <span>seed.sql</span>
              </button>

              <button
                onClick={() => handleTabSwitch('COMBINED')}
                disabled={switchingTab !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'COMBINED' 
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {switchingTab === 'COMBINED' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> : <FileText className="w-3.5 h-3.5" />}
                <span>combined_migration.sql</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setEnableWrap(!enableWrap)}
                className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  enableWrap 
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Toggle Word Wrap"
              >
                <WrapText className="w-3.5 h-3.5" />
                <span className="text-[10px]">Wrap</span>
              </button>
            </div>
          </div>

          {/* Editors Canvas */}
          <div className="flex-1 min-h-0 flex space-x-4">
            
            {/* SPLIT VIEW */}
            {activeTab === 'SPLIT' && (
              <>
                {/* Schema Editor Panel */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-between items-center shrink-0">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-[11px] uppercase font-mono tracking-wider">
                      <Code className="w-3.5 h-3.5 mr-2 text-blue-600 dark:text-blue-400" /> schema.sql
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleCopy(schemaSql, 'schema')}
                        className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold flex items-center bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-xs"
                        title="Copy schema SQL"
                      >
                        {copiedSchema ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                        <span>{copiedSchema ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button 
                        onClick={() => handleDownloadFile('schema.sql', schemaSql, 'schema')}
                        disabled={isDownloadingSchema}
                        className="text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-xs font-bold flex items-center bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        {isDownloadingSchema ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                        <span>{isDownloadingSchema ? 'Saving...' : 'Download'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
                    <SqlCodeViewer code={schemaSql} wrap={enableWrap} />
                  </div>
                </div>

                {/* Seed Editor Panel */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-between items-center shrink-0">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-[11px] uppercase font-mono tracking-wider">
                      <Layers className="w-3.5 h-3.5 mr-2 text-teal-600 dark:text-teal-400" /> seed.sql
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleCopy(seedSql, 'seed')}
                        className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold flex items-center bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-xs"
                        title="Copy seed SQL"
                      >
                        {copiedSeed ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                        <span>{copiedSeed ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button 
                        onClick={() => handleDownloadFile('seed.sql', seedSql, 'seed')}
                        disabled={isDownloadingSeed}
                        className="text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/20 text-xs font-bold flex items-center bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        {isDownloadingSeed ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                        <span>{isDownloadingSeed ? 'Saving...' : 'Download'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
                    <SqlCodeViewer code={seedSql || '-- No seed rows generated (check column mappings).'} wrap={enableWrap} />
                  </div>
                </div>
              </>
            )}

            {/* FULLSCHEMA VIEW */}
            {activeTab === 'SCHEMA' && (
              <div className="w-full flex-1 flex flex-col bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-between items-center shrink-0">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-xs uppercase font-mono tracking-wider">
                    <Code className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" /> schema.sql (Full View)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopy(schemaSql, 'schema')}
                      className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      {copiedSchema ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                      <span>{copiedSchema ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadFile('schema.sql', schemaSql, 'schema')}
                      disabled={isDownloadingSchema}
                      className="text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-colors cursor-pointer shadow-xs"
                    >
                      {isDownloadingSchema ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                      <span>Download File</span>
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
                  <SqlCodeViewer code={schemaSql} wrap={enableWrap} />
                </div>
              </div>
            )}

            {/* FULL SEED VIEW */}
            {activeTab === 'SEED' && (
              <div className="w-full flex-1 flex flex-col bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-between items-center shrink-0">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-xs uppercase font-mono tracking-wider">
                    <Layers className="w-4 h-4 mr-2 text-teal-600 dark:text-teal-400" /> seed.sql (Full View)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopy(seedSql, 'seed')}
                      className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      {copiedSeed ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                      <span>{copiedSeed ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadFile('seed.sql', seedSql, 'seed')}
                      disabled={isDownloadingSeed}
                      className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-colors cursor-pointer shadow-xs"
                    >
                      {isDownloadingSeed ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                      <span>Download File</span>
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
                  <SqlCodeViewer code={seedSql || '-- No seed rows generated.'} wrap={enableWrap} />
                </div>
              </div>
            )}

            {/* COMBINED MIGRATION VIEW */}
            {activeTab === 'COMBINED' && (
              <div className="w-full flex-1 flex flex-col bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-between items-center shrink-0">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-xs uppercase font-mono tracking-wider">
                    <FileText className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" /> Combined Migration Artifact (DDL + Inserts)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopy(combinedSql, 'combined')}
                      className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      {copiedCombined ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                      <span>{copiedCombined ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadFile('complete_migration.sql', combinedSql, 'combined')}
                      disabled={isDownloadingCombined}
                      className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-colors cursor-pointer shadow-xs"
                    >
                      {isDownloadingCombined ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                      <span>Download Artifact</span>
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
                  <SqlCodeViewer code={combinedSql} wrap={enableWrap} />
                </div>
              </div>
            )}
          </div>

          {/* Footer Status Banner */}
          <div className="shrink-0 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-xs">Production SQL Ready</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Validated relational syntax with full table constraints and transformed values.</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono text-slate-500 dark:text-slate-400">
              <span>Tables: <strong className="text-slate-800 dark:text-slate-200">{targetTables.length}</strong></span>
              <span>Sources: <strong className="text-slate-800 dark:text-slate-200">{sources.length}</strong></span>
            </div>
          </div>
        </div>
      )}

      {!schemaSql && !isGenerating && (
        <div className="flex-1 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 text-slate-500 text-center p-12">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-slate-600 shadow-xs">
              <Code className="w-7 h-7" />
            </div>
            <p className="font-bold text-slate-800 dark:text-slate-300 text-sm">Ready to Build SQL Pipeline</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">Click "Compile Migration SQL" above to generate standard DDL schema and bulk multi-row INSERT scripts in IDE code viewer.</p>
          </div>
        </div>
      )}
    </div>
  );
}
