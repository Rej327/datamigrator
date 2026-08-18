import React, { useState, useMemo, useTransition } from 'react';
import { SourceData } from '../types';
import { useStore } from '../store';
import { 
  X, Search, Replace, Download, Edit3, Check, RotateCcw, 
  Hash, Calendar, Type, ArrowUpDown, Filter, ChevronLeft, ChevronRight,
  AlertTriangle, Copy, Sparkles, CheckCircle2, ShieldAlert, SlidersHorizontal,
  Trash2, Wand2, Plus, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';

interface DataViewerModalProps {
  source: SourceData;
  initialSelectedColumn?: string | null;
  onClose: () => void;
}

type AnomalyFilterType = 'ALL' | 'DUPLICATES' | 'NULLS' | 'TYPE_MISMATCH' | 'WHITESPACE';
type SortDirection = 'ASC' | 'DESC' | null;

export function DataViewerModal({ source, initialSelectedColumn, onClose }: DataViewerModalProps) {
  const { updateSourceRows } = useStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // Working copy of the rows for editing
  const [rows, setRows] = useState<any[]>(() => {
    return source.rawRows && source.rawRows.length > 0 
      ? JSON.parse(JSON.stringify(source.rawRows)) 
      : JSON.parse(JSON.stringify(source.sampleData));
  });

  // History for undo support
  const [history, setHistory] = useState<any[][]>([]);

  // Selected column for detailed profile view or filtering
  const [selectedColumn, setSelectedColumn] = useState<string | null>(
    initialSelectedColumn || source.headers[0] || null
  );

  // Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Anomaly & Diagnostic Filters
  const [anomalyFilter, setAnomalyFilter] = useState<AnomalyFilterType>('ALL');
  const [switchingAnomalyFilter, setSwitchingAnomalyFilter] = useState<string | null>(null);

  const handleAnomalyFilterSwitch = (filter: AnomalyFilterType) => {
    if (anomalyFilter === filter) return;
    setSwitchingAnomalyFilter(filter);
    setTimeout(() => {
      setAnomalyFilter(filter);
      setCurrentPage(1);
      setSwitchingAnomalyFilter(null);
    }, 100);
  };

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [columnFilter, setColumnFilter] = useState<string>('ALL');

  // Custom filter condition
  const [filterOperator, setFilterOperator] = useState<string>('contains');
  const [filterTargetVal, setFilterTargetVal] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Modals & Panels
  const [showBulkReplace, setShowBulkReplace] = useState(false);
  const [showCleaningTools, setShowCleaningTools] = useState(false);
  const [showDistinctValuesModal, setShowDistinctValuesModal] = useState(false);

  // Distinct value editing state
  const [editingDistinctVal, setEditingDistinctVal] = useState<string | null>(null);
  const [newDistinctVal, setNewDistinctVal] = useState<string>('');

  // Bulk Find & Replace state
  const [targetColumn, setTargetColumn] = useState<string>(initialSelectedColumn || source.headers[0] || 'ALL');
  const [findValue, setFindValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [matchMode, setMatchMode] = useState<'exact' | 'contains' | 'case_insensitive' | 'regex'>('exact');

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Null filling preset
  const [nullFillValue, setNullFillValue] = useState('N/A');

  // Precompute duplicate counts per column for lightning fast filtering
  const duplicateSets = useMemo(() => {
    const sets: Record<string, Set<string>> = {};
    source.headers.forEach(h => {
      const counts: Record<string, number> = {};
      rows.forEach(r => {
        const val = String(r[h] ?? '').trim();
        if (val !== '') {
          counts[val] = (counts[val] || 0) + 1;
        }
      });
      const dupSet = new Set<string>();
      Object.entries(counts).forEach(([val, count]) => {
        if (count > 1) dupSet.add(val);
      });
      sets[h] = dupSet;
    });
    return sets;
  }, [rows, source.headers]);

  // Check cell anomaly helper
  const checkCellAnomaly = (val: any, colHeader: string) => {
    const profile = source.profiles[colHeader];
    const isNull = val === null || val === undefined || String(val).trim() === '';
    const strVal = String(val ?? '');
    const hasWhitespace = strVal.length > 0 && (strVal.startsWith(' ') || strVal.endsWith(' ') || strVal.includes('\t') || strVal.includes('\n'));
    const isDuplicate = !isNull && (duplicateSets[colHeader]?.has(strVal.trim()) ?? false);

    let isTypeMismatch = false;
    if (!isNull && profile) {
      if (profile.detectedType === 'number' && isNaN(Number(strVal.replace(/,/g, '')))) {
        isTypeMismatch = true;
      } else if (profile.detectedType === 'date' && isNaN(Date.parse(strVal))) {
        isTypeMismatch = true;
      } else if (profile.detectedType === 'boolean') {
        const lower = strVal.toLowerCase().trim();
        if (!['true', 'false', '1', '0', 'yes', 'no', 't', 'f'].includes(lower)) {
          isTypeMismatch = true;
        }
      }
    }

    return { isNull, hasWhitespace, isDuplicate, isTypeMismatch };
  };

  // Anomaly metrics summary across dataset
  const anomalySummary = useMemo(() => {
    let totalDuplicates = 0;
    let totalNulls = 0;
    let totalTypeMismatches = 0;
    let totalWhitespaceIssues = 0;

    const activeCol = selectedColumn || source.headers[0];
    const targetCols = activeCol ? [activeCol] : source.headers;

    rows.forEach(row => {
      targetCols.forEach(col => {
        const anomalies = checkCellAnomaly(row[col], col);
        if (anomalies.isNull) totalNulls++;
        if (anomalies.isDuplicate) totalDuplicates++;
        if (anomalies.isTypeMismatch) totalTypeMismatches++;
        if (anomalies.hasWhitespace) totalWhitespaceIssues++;
      });
    });

    return {
      totalDuplicates,
      totalNulls,
      totalTypeMismatches,
      totalWhitespaceIssues,
      activeCol
    };
  }, [rows, selectedColumn, source.headers, duplicateSets]);

  // Distinct values and occurrence frequency for the selected column (for enum / distinct value editor)
  const distinctValuesList = useMemo(() => {
    const col = selectedColumn || source.headers[0];
    if (!col) return [];

    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const val = r[col];
      const key = val === null || val === undefined ? '__NULL__' : String(val);
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([value, count]) => ({
        value: value === '__NULL__' ? '' : value,
        isNull: value === '__NULL__',
        count,
        percentage: ((count / rows.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows, selectedColumn, source.headers]);

  // Bulk replace all occurrences of a distinct value in the selected column
  const handleReplaceDistinctValue = (oldVal: string, newVal: string, isNullTarget: boolean) => {
    const col = selectedColumn || source.headers[0];
    if (!col) return;

    setIsProcessing(true);
    setProcessingStatus(`Updating values in [${col}]...`);

    setTimeout(() => {
      try {
        recordHistory();
        let replacedCount = 0;

        const newRows = rows.map(r => {
          const currentVal = r[col];
          let matches = false;

          if (isNullTarget) {
            if (currentVal === null || currentVal === undefined || String(currentVal).trim() === '') {
              matches = true;
            }
          } else {
            if (String(currentVal ?? '') === oldVal) {
              matches = true;
            }
          }

          if (matches) {
            replacedCount++;
            return { ...r, [col]: newVal };
          }
          return r;
        });

        setRows(newRows);
        updateSourceRows(source.id, newRows);
        setEditingDistinctVal(null);
        setNewDistinctVal('');
        toast.success(`Updated ${replacedCount} row(s) from "${isNullTarget ? 'NULL' : oldVal}" to "${newVal}" in [${col}]!`);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Push state to history before modifications
  const recordHistory = () => {
    setHistory(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(rows))]);
  };

  // Filter and Sort rows
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];
    const activeCol = selectedColumn || source.headers[0];

    // 1. Diagnostic Anomaly Filters
    if (anomalyFilter === 'DUPLICATES' && activeCol) {
      const dupSet = duplicateSets[activeCol] || new Set();
      result = result.filter(r => {
        const val = String(r[activeCol] ?? '').trim();
        return val !== '' && dupSet.has(val);
      });
    } else if (anomalyFilter === 'NULLS') {
      result = result.filter(r => {
        if (activeCol) {
          const val = r[activeCol];
          return val === null || val === undefined || String(val).trim() === '';
        }
        return source.headers.some(h => r[h] === null || r[h] === undefined || String(r[h]).trim() === '');
      });
    } else if (anomalyFilter === 'TYPE_MISMATCH' && activeCol) {
      result = result.filter(r => checkCellAnomaly(r[activeCol], activeCol).isTypeMismatch);
    } else if (anomalyFilter === 'WHITESPACE') {
      result = result.filter(r => {
        if (activeCol) {
          return checkCellAnomaly(r[activeCol], activeCol).hasWhitespace;
        }
        return source.headers.some(h => checkCellAnomaly(r[h], h).hasWhitespace);
      });
    }

    // 2. Custom Condition Filter
    if (filterTargetVal.trim() !== '' && columnFilter !== 'ALL') {
      const target = filterTargetVal.trim().toLowerCase();
      result = result.filter(r => {
        const val = String(r[columnFilter] ?? '').toLowerCase();
        switch (filterOperator) {
          case 'equals': return val === target;
          case 'not_equals': return val !== target;
          case 'contains': return val.includes(target);
          case 'starts_with': return val.startsWith(target);
          case 'ends_with': return val.endsWith(target);
          case 'greater_than': return Number(val) > Number(target);
          case 'less_than': return Number(val) < Number(target);
          default: return val.includes(target);
        }
      });
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) => {
        if (columnFilter !== 'ALL') {
          const val = String(row[columnFilter] ?? '').toLowerCase();
          return val.includes(query);
        }
        return Object.values(row).some((val) => 
          String(val ?? '').toLowerCase().includes(query)
        );
      });
    }

    // 4. Sorting
    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        const valA = a[sortColumn] ?? '';
        const valB = b[sortColumn] ?? '';
        const numA = Number(valA);
        const numB = Number(valB);

        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
          return sortDirection === 'ASC' ? numA - numB : numB - numA;
        }
        return sortDirection === 'ASC' 
          ? String(valA).localeCompare(String(valB)) 
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [rows, anomalyFilter, selectedColumn, duplicateSets, source.headers, filterTargetVal, columnFilter, filterOperator, searchQuery, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / pageSize));
  const currentRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  // Bulk match preview calculation
  const matchCount = useMemo(() => {
    if (!findValue) return 0;
    let count = 0;
    const targets = targetColumn === 'ALL' ? source.headers : [targetColumn];

    try {
      const regex = matchMode === 'regex' ? new RegExp(findValue, 'g') : null;
      rows.forEach(row => {
        targets.forEach(col => {
          const val = String(row[col] ?? '');
          if (matchMode === 'exact') {
            if (val === findValue) count++;
          } else if (matchMode === 'case_insensitive') {
            if (val.toLowerCase() === findValue.toLowerCase()) count++;
          } else if (matchMode === 'contains') {
            if (val.includes(findValue)) count++;
          } else if (regex && regex.test(val)) {
            count++;
          }
        });
      });
    } catch {
      return 0;
    }
    return count;
  }, [rows, findValue, targetColumn, matchMode, source.headers]);

  // Execute Bulk Find & Replace
  const handleBulkReplace = () => {
    if (!findValue) {
      toast.error('Please enter a search value');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus(`Searching and replacing values across ${targetColumn === 'ALL' ? 'all columns' : targetColumn}...`);

    setTimeout(() => {
      try {
        recordHistory();
        let replacedCount = 0;
        const targets = targetColumn === 'ALL' ? source.headers : [targetColumn];
        const regex = matchMode === 'regex' ? new RegExp(findValue, 'g') : null;

        const newRows = rows.map(row => {
          let modified = false;
          const updatedRow = { ...row };

          targets.forEach(col => {
            const val = String(row[col] ?? '');
            let shouldReplace = false;
            let nextVal = val;

            if (matchMode === 'exact') {
              if (val === findValue) {
                shouldReplace = true;
                nextVal = replaceValue;
              }
            } else if (matchMode === 'case_insensitive') {
              if (val.toLowerCase() === findValue.toLowerCase()) {
                shouldReplace = true;
                nextVal = replaceValue;
              }
            } else if (matchMode === 'contains') {
              if (val.includes(findValue)) {
                shouldReplace = true;
                nextVal = val.split(findValue).join(replaceValue);
              }
            } else if (regex && regex.test(val)) {
              shouldReplace = true;
              nextVal = val.replace(regex, replaceValue);
            }

            if (shouldReplace) {
              updatedRow[col] = nextVal;
              modified = true;
              replacedCount++;
            }
          });

          return modified ? updatedRow : row;
        });

        setRows(newRows);
        updateSourceRows(source.id, newRows);
        toast.success(`Successfully replaced ${replacedCount} value(s)!`);
      } catch (err: any) {
        toast.error(`Replacement error: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Auto-Deduplicate Strategy
  const handleDeduplicate = (strategy: 'keep_first' | 'keep_last' | 'append_suffix') => {
    const col = selectedColumn || source.headers[0];
    if (!col) return;

    setIsProcessing(true);
    setProcessingStatus(`Resolving duplicates on [${col}]...`);

    setTimeout(() => {
      try {
        recordHistory();
        let newRows: any[] = [];
        const seen = new Map<string, number>();

        if (strategy === 'keep_first') {
          const visited = new Set<string>();
          rows.forEach(r => {
            const val = String(r[col] ?? '');
            if (val === '' || !visited.has(val)) {
              if (val !== '') visited.add(val);
              newRows.push(r);
            }
          });
        } else if (strategy === 'keep_last') {
          const reverse = [...rows].reverse();
          const visited = new Set<string>();
          const temp: any[] = [];
          reverse.forEach(r => {
            const val = String(r[col] ?? '');
            if (val === '' || !visited.has(val)) {
              if (val !== '') visited.add(val);
              temp.push(r);
            }
          });
          newRows = temp.reverse();
        } else if (strategy === 'append_suffix') {
          newRows = rows.map(r => {
            const val = String(r[col] ?? '');
            if (val !== '') {
              const count = seen.get(val) || 0;
              seen.set(val, count + 1);
              if (count > 0) {
                return { ...r, [col]: `${val}_dup${count}` };
              }
            }
            return r;
          });
        }

        const removedCount = rows.length - newRows.length;
        setRows(newRows);
        updateSourceRows(source.id, newRows);
        
        if (strategy === 'append_suffix') {
          toast.success(`Appended unique identifiers to duplicate records in [${col}]!`);
        } else {
          toast.success(`Removed ${removedCount} duplicate rows based on [${col}]!`);
        }
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // 1-Click Trim Whitespace
  const handleTrimWhitespace = () => {
    setIsProcessing(true);
    setProcessingStatus('Trimming leading and trailing whitespace...');

    setTimeout(() => {
      try {
        recordHistory();
        const targets = selectedColumn ? [selectedColumn] : source.headers;
        let trimmedCount = 0;

        const newRows = rows.map(r => {
          const row = { ...r };
          targets.forEach(col => {
            if (typeof row[col] === 'string') {
              const original = row[col];
              const trimmed = original.trim();
              if (original !== trimmed) {
                row[col] = trimmed;
                trimmedCount++;
              }
            }
          });
          return row;
        });

        setRows(newRows);
        updateSourceRows(source.id, newRows);
        toast.success(`Trimmed whitespace across ${trimmedCount} cell(s)!`);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // 1-Click Fill Nulls / Missing
  const handleFillNulls = () => {
    const col = selectedColumn || source.headers[0];
    if (!col) return;

    setIsProcessing(true);
    setProcessingStatus(`Filling missing values in [${col}]...`);

    setTimeout(() => {
      try {
        recordHistory();
        let filled = 0;
        const newRows = rows.map(r => {
          const val = r[col];
          if (val === null || val === undefined || String(val).trim() === '') {
            filled++;
            return { ...r, [col]: nullFillValue };
          }
          return r;
        });

        setRows(newRows);
        updateSourceRows(source.id, newRows);
        toast.success(`Filled ${filled} missing/null cell(s) in [${col}] with "${nullFillValue}"!`);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // 1-Click Normalize Booleans (yes/no/1/0 -> true/false)
  const handleNormalizeBooleans = () => {
    const col = selectedColumn || source.headers[0];
    if (!col) return;

    setIsProcessing(true);
    setProcessingStatus(`Standardizing booleans in [${col}]...`);

    setTimeout(() => {
      try {
        recordHistory();
        let normalized = 0;
        const newRows = rows.map(r => {
          const raw = String(r[col] ?? '').trim().toLowerCase();
          let replacement: string | null = null;
          if (['1', 'true', 't', 'yes', 'y'].includes(raw)) replacement = 'true';
          else if (['0', 'false', 'f', 'no', 'n'].includes(raw)) replacement = 'false';

          if (replacement !== null && replacement !== r[col]) {
            normalized++;
            return { ...r, [col]: replacement };
          }
          return r;
        });

        setRows(newRows);
        updateSourceRows(source.id, newRows);
        toast.success(`Normalized ${normalized} boolean value(s) in [${col}]!`);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // 1-Click Normalize Dates to ISO (YYYY-MM-DD)
  const handleNormalizeDates = () => {
    const col = selectedColumn || source.headers[0];
    if (!col) return;

    setIsProcessing(true);
    setProcessingStatus(`Standardizing dates in [${col}]...`);

    setTimeout(() => {
      try {
        recordHistory();
        let converted = 0;
        const newRows = rows.map(r => {
          const raw = String(r[col] ?? '').trim();
          if (raw) {
            const timestamp = Date.parse(raw);
            if (!isNaN(timestamp)) {
              const iso = new Date(timestamp).toISOString().split('T')[0];
              if (iso !== raw) {
                converted++;
                return { ...r, [col]: iso };
              }
            }
          }
          return r;
        });

        setRows(newRows);
        updateSourceRows(source.id, newRows);
        toast.success(`Standardized ${converted} date(s) in [${col}] to YYYY-MM-DD!`);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // 1-Click Casing Transform
  const handleConvertCasing = (mode: 'UPPER' | 'LOWER' | 'TITLE') => {
    const col = selectedColumn || source.headers[0];
    if (!col) return;

    setIsProcessing(true);
    setProcessingStatus(`Transforming casing to ${mode} in [${col}]...`);

    setTimeout(() => {
      try {
        recordHistory();
        let updated = 0;
        const newRows = rows.map(r => {
          const raw = String(r[col] ?? '');
          let nextVal = raw;
          if (mode === 'UPPER') nextVal = raw.toUpperCase();
          else if (mode === 'LOWER') nextVal = raw.toLowerCase();
          else if (mode === 'TITLE') {
            nextVal = raw.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
          }

          if (nextVal !== raw) {
            updated++;
            return { ...r, [col]: nextVal };
          }
          return r;
        });

        setRows(newRows);
        updateSourceRows(source.id, newRows);
        toast.success(`Converted casing for ${updated} row(s) in [${col}]!`);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Undo last modification
  const handleUndo = () => {
    if (history.length === 0) return;
    setIsProcessing(true);
    setProcessingStatus('Reverting previous modification...');

    setTimeout(() => {
      try {
        const previous = history[history.length - 1];
        setHistory(prev => prev.slice(0, prev.length - 1));
        setRows(previous);
        updateSourceRows(source.id, previous);
        toast.info('Reverted previous change');
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Save inline cell edit
  const handleSaveCellEdit = (actualRowIndex: number, column: string) => {
    if (editingCell) {
      recordHistory();
      const newRows = [...rows];
      newRows[actualRowIndex] = {
        ...newRows[actualRowIndex],
        [column]: editValue
      };
      setRows(newRows);
      updateSourceRows(source.id, newRows);
      setEditingCell(null);
      toast.success('Cell updated');
    }
  };

  // Export current rows as CSV
  const handleExportCSV = () => {
    setIsProcessing(true);
    setProcessingStatus('Generating CSV blob export...');

    setTimeout(() => {
      try {
        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `cleaned_${source.fileName}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV exported successfully');
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  // Handle Sort Toggle
  const handleSort = (header: string) => {
    if (sortColumn === header) {
      if (sortDirection === 'ASC') setSortDirection('DESC');
      else if (sortDirection === 'DESC') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(header);
      setSortDirection('ASC');
    }
  };

  const activeColProfile = selectedColumn ? source.profiles[selectedColumn] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 lg:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-[95vw] h-[94vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Processing Spinner Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-3 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-bold text-white tracking-tight">{processingStatus || 'Applying database operation...'}</h4>
              <p className="text-xs text-slate-400 mt-1">Processing dataset rows asynchronously...</p>
            </div>
          </div>
        )}

        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">{source.fileName}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-500/20">
                  {rows.length.toLocaleString()} rows • {source.headers.length} columns
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Data Migration Diagnostics & Conflict Resolution Suite</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {history.length > 0 && (
              <button
                onClick={handleUndo}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                title="Undo last change"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo ({history.length})</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowCleaningTools(!showCleaningTools);
                setShowBulkReplace(false);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border shadow-sm ${
                showCleaningTools 
                  ? 'bg-amber-600 text-white border-amber-600' 
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Smart Fix & Cleaning Tools</span>
            </button>

            <button
              onClick={() => {
                setShowBulkReplace(!showBulkReplace);
                setShowCleaningTools(false);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border shadow-sm ${
                showBulkReplace 
                  ? 'bg-emerald-600 text-white border-emerald-600' 
                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
              }`}
            >
              <Replace className="w-3.5 h-3.5" />
              <span>Bulk Edit / Replace</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Clean CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1-Click Smart Cleaning Tools Panel */}
        {showCleaningTools && (
          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center">
                  <Wand2 className="w-4 h-4 mr-1.5 text-amber-600" />
                  Conflict Resolution Actions:
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  Target: {selectedColumn ? selectedColumn : 'All Columns'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Deduplicate */}
                <div className="flex items-center bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 p-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Deduplicate:</span>
                  <button
                    onClick={() => handleDeduplicate('keep_first')}
                    className="px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors"
                    title="Keep the first occurrence of each unique key, remove subsequent duplicates"
                  >
                    Keep First
                  </button>
                  <button
                    onClick={() => handleDeduplicate('keep_last')}
                    className="px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors"
                    title="Keep the last occurrence of each unique key"
                  >
                    Keep Last
                  </button>
                  <button
                    onClick={() => handleDeduplicate('append_suffix')}
                    className="px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors"
                    title="Append sequential suffix to duplicate keys (e.g. key_2, key_3)"
                  >
                    Auto-Suffix Key
                  </button>
                </div>

                {/* Fill Nulls */}
                <div className="flex items-center bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 p-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Fill Blank:</span>
                  <input
                    type="text"
                    value={nullFillValue}
                    onChange={(e) => setNullFillValue(e.target.value)}
                    className="w-20 px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none text-slate-800 dark:text-slate-200"
                    placeholder="Value"
                  />
                  <button
                    onClick={handleFillNulls}
                    className="ml-1 px-2.5 py-1 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-500 rounded transition-colors"
                  >
                    Apply Fill
                  </button>
                </div>

                {/* Normalizers */}
                <button
                  onClick={handleTrimWhitespace}
                  className="px-3 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold transition-colors"
                  title="Trim leading and trailing whitespace and tabs"
                >
                  Trim Whitespace
                </button>

                <button
                  onClick={handleNormalizeDates}
                  className="px-3 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold transition-colors"
                  title="Convert various date formats into standard YYYY-MM-DD ISO"
                >
                  ISO Dates (YYYY-MM-DD)
                </button>

                <button
                  onClick={handleNormalizeBooleans}
                  className="px-3 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold transition-colors"
                  title="Standardize booleans (yes/no/1/0 to true/false)"
                >
                  Booleans (true/false)
                </button>

                {/* Casing Dropdown */}
                <div className="flex items-center bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 p-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Casing:</span>
                  <button onClick={() => handleConvertCasing('UPPER')} className="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-mono">UPPER</button>
                  <button onClick={() => handleConvertCasing('LOWER')} className="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-mono">lower</button>
                  <button onClick={() => handleConvertCasing('TITLE')} className="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-mono">Title</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Find & Replace Bar */}
        {showBulkReplace && (
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/40 shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center">
                  <Replace className="w-4 h-4 mr-1 text-emerald-600 dark:text-emerald-400" />
                  Target Column:
                </span>
                <select
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-md py-1 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">All Columns</option>
                  {source.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2 flex-1 min-w-[260px]">
                <input
                  type="text"
                  placeholder="Find value (e.g. value1)"
                  value={findValue}
                  onChange={(e) => setFindValue(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="text-xs text-slate-400 font-bold">→</span>
                <input
                  type="text"
                  placeholder="Replace with (e.g. value2)"
                  value={replaceValue}
                  onChange={(e) => setReplaceValue(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-bold text-emerald-700 dark:text-emerald-300 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={matchMode}
                  onChange={(e) => setMatchMode(e.target.value as any)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md py-1.5 px-2 text-xs text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="exact">Exact Match</option>
                  <option value="case_insensitive">Case Insensitive</option>
                  <option value="contains">Contains Substring</option>
                  <option value="regex">Regular Expression (Regex)</option>
                </select>

                <button
                  onClick={handleBulkReplace}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold transition-all text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-950/30 cursor-pointer"
                >
                  <Replace className="w-4 h-4 mr-1" />
                  <span>Apply Replacement</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diagnostic Anomaly Filter Chips */}
        <div className="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 overflow-x-auto py-0.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center">
              <Filter className="w-3 h-3 mr-1 text-slate-400" />
              Diagnostics:
            </span>

            <button
              onClick={() => handleAnomalyFilterSwitch('ALL')}
              disabled={switchingAnomalyFilter !== null}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer ${
                anomalyFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {switchingAnomalyFilter === 'ALL' && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              <span>All Records ({rows.length.toLocaleString()})</span>
            </button>

            <button
              onClick={() => handleAnomalyFilterSwitch('DUPLICATES')}
              disabled={switchingAnomalyFilter !== null}
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                anomalyFilter === 'DUPLICATES'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30'
              }`}
            >
              {switchingAnomalyFilter === 'DUPLICATES' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
              <span>Duplicates in [{anomalySummary.activeCol}]: {anomalySummary.totalDuplicates}</span>
            </button>

            <button
              onClick={() => handleAnomalyFilterSwitch('NULLS')}
              disabled={switchingAnomalyFilter !== null}
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                anomalyFilter === 'NULLS'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              }`}
            >
              {switchingAnomalyFilter === 'NULLS' ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
              <span>Missing/Nulls: {anomalySummary.totalNulls}</span>
            </button>

            <button
              onClick={() => handleAnomalyFilterSwitch('TYPE_MISMATCH')}
              disabled={switchingAnomalyFilter !== null}
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                anomalyFilter === 'TYPE_MISMATCH'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40 hover:bg-purple-50 dark:hover:bg-purple-950/30'
              }`}
            >
              {switchingAnomalyFilter === 'TYPE_MISMATCH' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
              <span>Type Mismatches: {anomalySummary.totalTypeMismatches}</span>
            </button>

            <button
              onClick={() => handleAnomalyFilterSwitch('WHITESPACE')}
              disabled={switchingAnomalyFilter !== null}
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                anomalyFilter === 'WHITESPACE'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-950/30'
              }`}
            >
              {switchingAnomalyFilter === 'WHITESPACE' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Type className="w-3 h-3" />}
              <span>Dirty Whitespace: {anomalySummary.totalWhitespaceIssues}</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Found <span className="font-bold text-slate-800 dark:text-slate-200">{filteredAndSortedRows.length.toLocaleString()}</span> matching rows
          </div>
        </div>

        {/* Search & Custom Column Filter Bar */}
        <div className="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Quick search rows..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 w-56 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            {/* Custom Condition Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Rule:</span>
              <select
                value={columnFilter}
                onChange={(e) => { setColumnFilter(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-semibold outline-none"
              >
                <option value="ALL">All Columns</option>
                {source.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>

              <select
                value={filterOperator}
                onChange={(e) => { setFilterOperator(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-xs text-slate-500 dark:text-slate-400 outline-none border-l border-slate-200 dark:border-slate-700 pl-1.5"
              >
                <option value="contains">contains</option>
                <option value="equals">equals (=)</option>
                <option value="not_equals">not equals (!=)</option>
                <option value="starts_with">starts with</option>
                <option value="ends_with">ends with</option>
                <option value="greater_than">&gt; (numeric)</option>
                <option value="less_than">&lt; (numeric)</option>
              </select>

              <input
                type="text"
                placeholder="Condition value..."
                value={filterTargetVal}
                onChange={(e) => { setFilterTargetVal(e.target.value); setCurrentPage(1); }}
                className="w-32 px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200 outline-none"
              />

              {filterTargetVal && (
                <button
                  onClick={() => setFilterTargetVal('')}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Active column badge / stats & Enum/Values Manager Button */}
          {selectedColumn && activeColProfile && (
            <div className="flex items-center space-x-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shrink-0">
              <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center">
                <span className="text-slate-400 uppercase text-[9px] mr-1.5">Column:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">{selectedColumn}</span>
              </div>
              <div className="h-3 w-px bg-slate-300 dark:bg-slate-700"></div>
              <div className="text-slate-600 dark:text-slate-400">
                Type: <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">{activeColProfile.detectedType}</span>
              </div>
              <div className="h-3 w-px bg-slate-300 dark:bg-slate-700"></div>
              <div className="text-slate-600 dark:text-slate-400">
                Unique: <span className="font-semibold text-slate-800 dark:text-slate-200">{activeColProfile.uniqueCount.toLocaleString()}</span>
              </div>
              <div className="h-3 w-px bg-slate-300 dark:bg-slate-700"></div>
              <div className="text-slate-600 dark:text-slate-400">
                Nulls: <span className={`font-semibold ${activeColProfile.nullCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{activeColProfile.nullCount.toLocaleString()}</span>
              </div>

              {/* Show Distinct / Enum Values Button */}
              <button
                onClick={() => setShowDistinctValuesModal(true)}
                className="ml-2 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
                title="View and edit all unique values/enums for this column across all rows"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>View & Edit Values ({distinctValuesList.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Data Grid Table */}
        <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/40">
          <table className="w-full text-left text-xs border-collapse min-w-max">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 shadow-sm">
              <tr>
                <th className="px-3 py-2.5 font-bold uppercase text-[10px] tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 text-center w-12 sticky left-0 z-20">
                  #
                </th>
                {source.headers.map((header) => {
                  const isSelected = selectedColumn === header;
                  const isSorted = sortColumn === header;
                  const profile = source.profiles[header];
                  const Icon = profile?.detectedType === 'number' ? Hash : 
                               profile?.detectedType === 'date' ? Calendar : Type;

                  return (
                    <th
                      key={header}
                      onClick={() => setSelectedColumn(header)}
                      className={`px-4 py-2.5 font-bold cursor-pointer select-none transition-colors border-r border-slate-200 dark:border-slate-800 ${
                        isSelected 
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-b-2 border-b-emerald-500' 
                          : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between space-x-2">
                        <div className="flex items-center space-x-1.5">
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                          <span className="truncate">{header}</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSort(header);
                            }}
                            className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 ${isSorted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                            title="Sort column"
                          >
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                          <span className="text-[9px] font-mono font-normal opacity-70 px-1 py-0.2 bg-black/5 dark:bg-white/5 rounded">
                            {profile?.detectedType}
                          </span>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900/60 font-mono">
              {currentRows.length === 0 ? (
                <tr>
                  <td colSpan={source.headers.length + 1} className="p-12 text-center text-slate-500 font-sans italic">
                    <div className="max-w-md mx-auto flex flex-col items-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                      <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No matching records found</p>
                      <p className="text-xs text-slate-400 mt-1">If filtering by anomalies (duplicates, nulls, mismatches), that means no issues were detected!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentRows.map((row, rowIdx) => {
                  const globalRowIndex = (currentPage - 1) * pageSize + rowIdx;
                  return (
                    <tr 
                      key={globalRowIndex} 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-3 py-2 text-center text-[10px] text-slate-400 bg-slate-50/80 dark:bg-slate-950/60 border-r border-slate-200 dark:border-slate-800 font-sans sticky left-0 z-10">
                        {globalRowIndex + 1}
                      </td>
                      {source.headers.map((header) => {
                        const isSelected = selectedColumn === header;
                        const isEditing = editingCell?.rowIndex === globalRowIndex && editingCell?.column === header;
                        const val = row[header];
                        const anomalies = checkCellAnomaly(val, header);

                        return (
                          <td
                            key={header}
                            onDoubleClick={() => {
                              setEditingCell({ rowIndex: globalRowIndex, column: header });
                              setEditValue(val === null || val === undefined ? '' : String(val));
                            }}
                            className={`px-4 py-2 border-r border-slate-100 dark:border-slate-800/60 relative group ${
                              isSelected ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                            } ${
                              anomalies.isDuplicate ? 'bg-rose-50/40 dark:bg-rose-950/20' : 
                              anomalies.isNull ? 'bg-amber-50/30 dark:bg-amber-950/10' :
                              anomalies.isTypeMismatch ? 'bg-purple-50/30 dark:bg-purple-950/10' : ''
                            }`}
                          >
                            {isEditing ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCellEdit(globalRowIndex, header);
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full px-2 py-0.5 bg-emerald-50 dark:bg-slate-800 border border-emerald-500 rounded text-xs outline-none text-slate-900 dark:text-slate-100"
                                />
                                <button
                                  onClick={() => handleSaveCellEdit(globalRowIndex, header)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingCell(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5 truncate">
                                  {anomalies.isDuplicate && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Duplicate value" />
                                  )}
                                  {anomalies.isTypeMismatch && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" title="Type mismatch" />
                                  )}
                                  <span className={`truncate max-w-[200px] ${
                                    anomalies.isNull ? 'text-amber-500/80 italic text-[11px]' : 
                                    anomalies.isDuplicate ? 'text-rose-700 dark:text-rose-300 font-semibold' :
                                    'text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {anomalies.isNull ? 'NULL' : String(val)}
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingCell({ rowIndex: globalRowIndex, column: header });
                                    setEditValue(val === null || val === undefined ? '' : String(val));
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 ml-1 transition-opacity"
                                  title="Edit cell (Double click)"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(filteredAndSortedRows.length, (currentPage - 1) * pageSize + 1)}</span> to{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(filteredAndSortedRows.length, currentPage * pageSize)}</span> of{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredAndSortedRows.length.toLocaleString()}</span> rows
            {filteredAndSortedRows.length !== rows.length && ` (filtered from ${rows.length.toLocaleString()})`}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 px-2">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Column Distinct Values & Enum-like Editor Modal */}
      {showDistinctValuesModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    Column Values & Enum Manager: <span className="text-emerald-600 dark:text-emerald-400 font-mono">[{selectedColumn}]</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Edit any value once to instantly update all matching rows across the dataset (e.g. changing all 500 "pending" to "active").
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowDistinctValuesModal(false);
                  setEditingDistinctVal(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: List of Unique Values */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex justify-between px-2">
                <span>Unique Value ({distinctValuesList.length} distinct)</span>
                <span>Frequency & Row Count</span>
              </div>

              {distinctValuesList.map((item, idx) => {
                const isEditing = editingDistinctVal === (item.isNull ? '__NULL__' : item.value);

                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-4 transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex items-center space-x-2">
                        <input
                          type="text"
                          autoFocus
                          value={newDistinctVal}
                          onChange={(e) => setNewDistinctVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleReplaceDistinctValue(item.value, newDistinctVal, item.isNull);
                            }
                            if (e.key === 'Escape') setEditingDistinctVal(null);
                          }}
                          placeholder="New value to replace with..."
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-500 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 outline-none"
                        />
                        <button
                          onClick={() => handleReplaceDistinctValue(item.value, newDistinctVal, item.isNull)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-colors shadow-sm flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          <span>Update All ({item.count})</span>
                        </button>
                        <button
                          onClick={() => setEditingDistinctVal(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center space-x-3 truncate">
                          <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-mono flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span className={`text-xs font-bold font-mono truncate max-w-[280px] ${
                            item.isNull ? 'text-amber-500 italic' : 'text-slate-800 dark:text-slate-200'
                          }`}>
                            {item.isNull ? 'NULL / Empty' : item.value}
                          </span>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
                              {item.count.toLocaleString()} rows ({item.percentage}%)
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setEditingDistinctVal(item.isNull ? '__NULL__' : item.value);
                              setNewDistinctVal(item.isNull ? '' : item.value);
                            }}
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors shadow-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            <span>Edit All</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Total Rows in file: <span className="font-semibold text-slate-800 dark:text-slate-200">{rows.length.toLocaleString()}</span>
              </span>
              <button
                onClick={() => setShowDistinctValuesModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
