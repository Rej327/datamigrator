import React, { useCallback, useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { useStore } from '../store';
import { SourceColumnProfile, SourceData } from '../types';
import { UploadCloud, Hash, Type, Calendar, CheckCircle2, Trash2, FileSpreadsheet } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function ImportProfile({ onNext }: { onNext: () => void }) {
  const { sources, addSource, removeSource } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
      const sampleValues = [];

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
      sampleData: data.slice(0, 100),
      rawRows: data
    });
    setIsProcessing(false);
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
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => processData(file, results),
      error: (error: any) => {
        toast.error('Error parsing CSV file');
        console.error(error);
        setIsProcessing(false);
      }
    });
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-1">Import Source Data</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Upload multiple legacy CSV files. The system profiles data locally.</p>
        </div>
        {sources.length > 0 && (
          <button onClick={onNext} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 font-semibold transition-colors text-sm shadow-sm">
            Continue to Schema Design
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Upload Dropzone */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <div 
            className={`flex-1 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors text-center ${
              isDragging 
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' 
                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-900/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Drop CSV files here</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-6">You can upload multiple files</p>
            
            <label className="cursor-pointer">
              <span className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-block">
                Browse Files
              </span>
              <input 
                type="file" 
                accept=".csv" 
                multiple
                className="hidden" 
                onChange={(e) => {
                  Array.from(e.target.files as Iterable<File> | ArrayLike<File> || []).forEach((file: File) => handleFile(file));
                }} 
                disabled={isProcessing}
              />
            </label>

            {isProcessing && (
              <div className="mt-6 text-sm font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                Processing and profiling file...
              </div>
            )}
          </div>
        </div>

        {/* Uploaded Files List */}
        <div className="w-full lg:w-2/3 flex flex-col min-h-0 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Imported Data Sources</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {sources.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                No files uploaded yet.
              </div>
            ) : (
              sources.map(source => (
                <div key={source.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900/30">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center space-x-3">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{source.fileName}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{source.rowCount.toLocaleString()} rows • {source.headers.length} columns</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeSource(source.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white dark:bg-slate-900/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-2 font-medium">Column</th>
                          <th className="px-4 py-2 font-medium">Type</th>
                          <th className="px-4 py-2 font-medium">Unique</th>
                          <th className="px-4 py-2 font-medium">Nulls</th>
                          <th className="px-4 py-2 font-medium">Sample</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {source.headers.slice(0, 5).map(header => {
                          const profile = source.profiles[header];
                          const Icon = profile.detectedType === 'number' ? Hash : 
                                       profile.detectedType === 'date' ? Calendar : Type;
                          return (
                            <tr key={header} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-4 py-2 font-bold text-slate-700 dark:text-slate-300">{header}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center space-x-1.5">
                                  <Icon className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                  <span className="capitalize text-slate-600 dark:text-slate-400 font-mono text-[10px]">{profile.detectedType}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{profile.uniqueCount.toLocaleString()}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${profile.nullCount > 0 ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-500/20' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'}`}>
                                  {profile.nullCount.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-slate-500 truncate max-w-[150px] italic">
                                {profile.sampleValues.join(', ')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {source.headers.length > 5 && (
                      <div className="px-4 py-2 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800">
                        + {source.headers.length - 5} more columns
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
