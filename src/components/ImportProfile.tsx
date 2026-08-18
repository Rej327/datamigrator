import React, { useCallback, useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { useStore } from '../store';
import { SourceColumnProfile, SourceData } from '../types';
import { 
  UploadCloud, Hash, Type, Calendar, CheckCircle2, Trash2, 
  FileSpreadsheet, Table, ChevronDown, ChevronUp, Eye, Edit3, Loader2, ArrowRight
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DataViewerModal } from './DataViewerModal';

export function ImportProfile({ onNext }: { onNext: () => void }) {
  const { sources, addSource, removeSource } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openingSourceId, setOpeningSourceId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [isNavigatingNext, setIsNavigatingNext] = useState(false);

  // Expanded columns state per source
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  // Active modal viewer state
  const [viewerSource, setViewerSource] = useState<SourceData | null>(null);
  const [viewerColumn, setViewerColumn] = useState<string | null>(null);

  const toggleExpand = (sourceId: string) => {
    setExpandedSources(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId]
    }));
  };

  const openDataViewer = (source: SourceData, column?: string) => {
    setOpeningSourceId(source.id + (column ? `_${column}` : ''));
    setTimeout(() => {
      setViewerSource(source);
      setViewerColumn(column || null);
      setOpeningSourceId(null);
    }, 100);
  };

  const handleRemoveSource = (id: string) => {
    setDeletingSourceId(id);
    setTimeout(() => {
      removeSource(id);
      setDeletingSourceId(null);
      toast.info('Data source removed');
    }, 150);
  };

  const handleProceedNext = () => {
    setIsNavigatingNext(true);
    setTimeout(() => {
      setIsNavigatingNext(false);
      onNext();
    }, 150);
  };

  const processData = (file: File, results: Papa.ParseResult<any>) => {
    const data = results.data;
    if (data.length === 0) {
      toast.error('The CSV file appears to be empty.');
      setIsProcessing(false);
      return;
    }

    const headers = Object.keys(data[0]);
    const profiles: Record<string, SourceColumnProfile> = {};

    headers.forEach(header => {
      let nullCount = 0;
      const uniqueValues = new Set();
      let typeCounts = { string: 0, number: 0, boolean: 0, date: 0 };
      const sampleValues: any[] = [];

      for (let i = 0; i < Math.min(data.length, 10000); i++) {
        const val = data[i][header];
        if (val === null || val === undefined || val === '') {
          nullCount++;
          continue;
        }
        
        uniqueValues.add(val);
        if (sampleValues.length < 5 && !sampleValues.includes(val)) {
          sampleValues.push(val);
        }

        if (!isNaN(Number(val))) typeCounts.number++;
        else if (String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'false') typeCounts.boolean++;
        else if (!isNaN(Date.parse(val))) typeCounts.date++;
        else typeCounts.string++;
      }

      let detectedType: SourceColumnProfile['detectedType'] = 'string';
      const totalTyped = typeCounts.string + typeCounts.number + typeCounts.boolean + typeCounts.date;
      
      if (typeCounts.number > totalTyped * 0.8) detectedType = 'number';
      else if (typeCounts.date > totalTyped * 0.8) detectedType = 'date';
      else if (typeCounts.boolean > totalTyped * 0.8) detectedType = 'boolean';

      profiles[header] = {
        name: header,
        detectedType,
        nullCount,
        uniqueCount: uniqueValues.size,
        sampleValues
      };
    });

    addSource({
      id: uuidv4(),
      fileName: file.name,
      rowCount: data.length,
      headers,
      profiles,
      sampleData: data.slice(0, 10000),
      rawRows: data
    });
    setIsProcessing(false);
    toast.success(`Imported ${file.name} (${data.length.toLocaleString()} rows) successfully!`);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    Array.from(e.dataTransfer.files as Iterable<File> | ArrayLike<File>).forEach((file: File) => {
      if (file.type.includes('csv') || file.name.endsWith('.csv')) {
        handleFile(file);
      }
    });
  }, []);

  const handleFile = (file: File) => {
    setIsProcessing(true);
    
    // Auto-create default project if not set yet so workspace persists immediately
    const currentProject = useStore.getState().project;
    if (!currentProject) {
      const defaultProj = {
        id: uuidv4(),
        name: file.name.replace(/\.[^/.]+$/, "") + " Migration",
        description: "Auto-created workspace for " + file.name
      };
      useStore.getState().setProject(defaultProj);
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => processData(file, results),
      error: (error: any) => {
        toast.error('Error parsing CSV file: ' + (error.message || 'Unknown error'));
        console.error(error);
        setIsProcessing(false);
      }
    });
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header Actions & Compact Upload Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 pb-2">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-mono font-semibold mb-1.5">
            <span>Step 02: Legacy Data Ingestion</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Import & Profile Source Files</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">High-speed local profiling, schema inference, and in-memory conflict diagnostics.</p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {/* Compact Upload Action Button / Mini Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`transition-all rounded-xl ${isDragging ? 'scale-105 ring-2 ring-emerald-500' : ''}`}
          >
            <label className="cursor-pointer">
              <span className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-2 shadow-xs cursor-pointer">
                <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Upload CSV Extract</span>
              </span>
              <input 
                type="file" 
                accept=".csv,text/csv,text/plain" 
                multiple
                className="hidden" 
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    files.forEach(file => handleFile(file));
                  }
                  e.target.value = '';
                }} 
                disabled={isProcessing}
              />
            </label>
          </div>

          {sources.length > 0 && (
            <button 
              onClick={handleProceedNext} 
              disabled={isNavigatingNext}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all text-xs shadow-lg shadow-emerald-950/20 flex items-center space-x-2 cursor-pointer"
            >
              {isNavigatingNext ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading Target Schema...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Target Schema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center space-x-2 animate-pulse font-mono">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Profiling & indexing dataset columns...</span>
        </div>
      )}

      {/* Main Full-Width Uploaded Files & Column Profiles Area */}
      <div className="w-full flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden backdrop-blur-xl shadow-sm dark:shadow-xl">
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">Imported Data Sources ({sources.length})</h3>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Click any column for deep statistics & bulk replace</span>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sources.length === 0 ? (
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                isDragging 
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' 
                  : 'border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">No CSV files imported yet</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">Drag and drop your CSV files anywhere here, or click the button below to browse.</p>
              
              <label className="mt-4 cursor-pointer">
                <span className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all inline-block shadow-md">
                  Choose CSV File
                </span>
                <input 
                  type="file" 
                  accept=".csv,text/csv,text/plain" 
                  multiple
                  className="hidden" 
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      files.forEach(file => handleFile(file));
                    }
                    e.target.value = '';
                  }} 
                  disabled={isProcessing}
                />
              </label>
            </div>
          ) : (
            sources.map(source => {
              const isExpanded = !!expandedSources[source.id];
              const visibleHeaders = isExpanded ? source.headers : source.headers.slice(0, 8);
              const isOpening = openingSourceId === source.id;

              return (
                <div key={source.id} className="border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/40 shadow-xs">
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800/80">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-tight">{source.fileName}</h4>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          {source.rowCount.toLocaleString()} records • {source.headers.length} attributes
                        </p>
                      </div>
                    </div>
                      
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openDataViewer(source)}
                        disabled={isOpening}
                        className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-60 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        {isOpening ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Opening Grid...</span>
                          </>
                        ) : (
                          <>
                            <Table className="w-3.5 h-3.5" />
                            <span>Open Data Grid</span>
                          </>
                        )}
                      </button>
                      
                      <button 
                        onClick={() => handleRemoveSource(source.id)}
                        disabled={deletingSourceId === source.id}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete source"
                      >
                        {deletingSourceId === source.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                    
                    <div className="p-0 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800/80 text-[10px] uppercase font-bold tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5">Column (Click to Inspect)</th>
                            <th className="px-4 py-2.5">Inferred Type</th>
                            <th className="px-4 py-2.5">Cardinality</th>
                            <th className="px-4 py-2.5">Missing / Nulls</th>
                            <th className="px-4 py-2.5">Preview Values</th>
                            <th className="px-4 py-2.5 text-right">Quick Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                          {visibleHeaders.map(header => {
                            const profile = source.profiles[header];
                            const Icon = profile?.detectedType === 'number' ? Hash : 
                                         profile?.detectedType === 'date' ? Calendar : Type;
                            return (
                              <tr 
                                key={header} 
                                onClick={() => openDataViewer(source, header)}
                                className="hover:bg-emerald-50/60 dark:hover:bg-emerald-500/5 cursor-pointer transition-colors group"
                              >
                                <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                                  <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors underline-offset-4 group-hover:underline">
                                    {header}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center space-x-1.5">
                                    <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="capitalize text-slate-600 dark:text-slate-400 font-mono text-[11px]">{profile?.detectedType}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{profile?.uniqueCount.toLocaleString()}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                                    profile?.nullCount > 0 
                                      ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20' 
                                      : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                  }`}>
                                    {profile?.nullCount.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 truncate max-w-[200px] text-[11px]">
                                  {profile?.sampleValues.join(', ')}
                                </td>
                                <td className="px-4 py-2.5 text-right font-sans">
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center space-x-1">
                                    <Edit3 className="w-3 h-3 mr-0.5" />
                                    <span>Inspect</span>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      
                      {source.headers.length > 6 && (
                        <button 
                          onClick={() => toggleExpand(source.id)}
                          className="w-full px-4 py-2.5 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-slate-100/60 dark:bg-slate-950/60 hover:bg-slate-200/80 dark:hover:bg-slate-900 border-t border-slate-200 dark:border-slate-800/80 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Show fewer columns</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>+ {source.headers.length - 6} more columns (Click to view all)</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      {/* Full Data Viewer & Bulk Editor Modal */}
      {viewerSource && (
        <DataViewerModal
          source={viewerSource}
          initialSelectedColumn={viewerColumn}
          onClose={() => {
            setViewerSource(null);
            setViewerColumn(null);
          }}
        />
      )}
    </div>
  );
}

