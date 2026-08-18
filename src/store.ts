import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, WorkspaceSnapshot } from './types';
import { toast } from 'sonner';
import { 
  saveSourceToDB, 
  getAllSourcesFromDB, 
  deleteSourceFromDB, 
  saveWorkspaceToDB, 
  deleteWorkspaceFromDB,
  getAllWorkspacesFromDB 
} from './lib/db';

const getEnvPassword = () => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_PASSWORD) {
      // @ts-ignore
      return import.meta.env.VITE_APP_PASSWORD;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_APP_PASSWORD) {
      return process.env.NEXT_PUBLIC_APP_PASSWORD;
    }
  } catch {}
  return "Password@123";
};

const APP_PASSWORD = getEnvPassword();

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      isAuthenticated: false,
      login: (password: string) => {
        if (password === APP_PASSWORD) {
          set({ isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => {
        set({ isAuthenticated: false });
        toast.info('Session locked. Password required.');
      },
      
      savedWorkspaces: [],
      
      project: null,
      sources: [],
      targetTables: [],
      columnMappings: [],
      transformations: [],

      // Initialize from IndexedDB SQLite-like backing
      initDatabase: async () => {
        try {
          const dbSources = await getAllSourcesFromDB();
          const dbWorkspaces = await getAllWorkspacesFromDB();

          set((state) => {
            let updatedSources = [...state.sources];
            // Merge IndexedDB sources with memory
            if (dbSources && dbSources.length > 0) {
              const dbMap = new Map(dbSources.map(s => [s.id, s]));
              updatedSources = updatedSources.map(s => {
                const fullDb = dbMap.get(s.id);
                return fullDb ? { ...s, rawRows: fullDb.rawRows || s.rawRows } : s;
              });
              
              // Add any missing
              dbSources.forEach(s => {
                if (!updatedSources.some(existing => existing.id === s.id)) {
                  updatedSources.push(s);
                }
              });
            }

            return {
              sources: updatedSources,
              savedWorkspaces: dbWorkspaces && dbWorkspaces.length > 0 ? dbWorkspaces : state.savedWorkspaces
            };
          });
        } catch (e) {
          console.warn('Database initialization warning:', e);
        }
      },

      loadWorkspace: (id) => {
        const ws = get().savedWorkspaces.find(w => w.project?.id === id);
        if (ws) {
          set({
            project: ws.project,
            sources: ws.sources,
            targetTables: ws.targetTables,
            columnMappings: ws.columnMappings,
            transformations: ws.transformations
          });
          toast.success(`Loaded workspace "${ws.project.name}"`);
        }
      },

      saveCurrentWorkspace: () => {
        const state = get();
        if (!state.project) {
          toast.error('No project active to save');
          return;
        }
        
        const snapshot: WorkspaceSnapshot = {
          project: state.project,
          sources: state.sources,
          targetTables: state.targetTables,
          columnMappings: state.columnMappings,
          transformations: state.transformations,
          updatedAt: Date.now()
        };

        // Save to IndexedDB database store
        saveWorkspaceToDB({
          id: state.project.id,
          ...snapshot
        });

        // Also save sources to DB
        state.sources.forEach(source => {
          saveSourceToDB(source);
        });

        set((s) => {
          const existingIndex = s.savedWorkspaces.findIndex(w => w.project?.id === s.project!.id);
          if (existingIndex >= 0) {
            const newWorkspaces = [...s.savedWorkspaces];
            newWorkspaces[existingIndex] = snapshot;
            return { savedWorkspaces: newWorkspaces };
          } else {
            return { savedWorkspaces: [...s.savedWorkspaces, snapshot] };
          }
        });
        toast.success(`Workspace "${state.project.name}" saved to Database!`);
      },

      deleteWorkspace: (id) => {
        deleteWorkspaceFromDB(id);
        set((s) => ({
          savedWorkspaces: s.savedWorkspaces.filter(w => w.project?.id !== id),
          ...(s.project?.id === id ? {
            project: null,
            sources: [],
            targetTables: [],
            columnMappings: [],
            transformations: []
          } : {})
        }));
        toast.info('Workspace deleted');
      },

      setProject: (project) => set({ project }),
      
      addSource: (data) => {
        saveSourceToDB(data);
        set((state) => ({ sources: [...state.sources, data] }));
      },

      updateSource: (source) => {
        saveSourceToDB(source);
        set((state) => ({
          sources: state.sources.map(s => s.id === source.id ? source : s)
        }));
      },

      updateSourceRows: (sourceId, rows) => set((state) => {
        const source = state.sources.find(s => s.id === sourceId);
        if (!source || rows.length === 0) return state;

        const headers = source.headers;
        const profiles: Record<string, any> = {};

        headers.forEach(header => {
          let nullCount = 0;
          const uniqueValues = new Set();
          let typeCounts = { string: 0, number: 0, boolean: 0, date: 0 };
          const sampleValues: any[] = [];

          for (let i = 0; i < Math.min(rows.length, 10000); i++) {
            const val = rows[i][header];
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

          let detectedType: any = 'string';
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

        const updatedSource = {
          ...source,
          rowCount: rows.length,
          profiles,
          sampleData: rows.slice(0, 500),
          rawRows: rows
        };

        // Persist full dataset to IndexedDB database
        saveSourceToDB(updatedSource);

        return {
          sources: state.sources.map(s => s.id === sourceId ? updatedSource : s)
        };
      }),

      removeSource: (id) => {
        deleteSourceFromDB(id);
        set((state) => ({
          sources: state.sources.filter(s => s.id !== id),
          columnMappings: state.columnMappings.filter(m => m.sourceId !== id),
          transformations: state.transformations.filter(t => t.sourceId !== id)
        }));
      },
      
      addTargetTable: (table) => set((state) => ({ targetTables: [...state.targetTables, table] })),
      updateTargetTable: (table) => set((state) => ({
        targetTables: state.targetTables.map(t => t.id === table.id ? table : t)
      })),
      removeTargetTable: (tableId) => set((state) => ({
        targetTables: state.targetTables.filter(t => t.id !== tableId),
        columnMappings: state.columnMappings.filter(m => m.targetTableId !== tableId)
      })),
      
      addColumnMapping: (mapping) => set((state) => {
        const filtered = state.columnMappings.filter(m => !(m.sourceId === mapping.sourceId && m.sourceHeader === mapping.sourceHeader));
        return { columnMappings: [...filtered, mapping] };
      }),
      removeColumnMapping: (mappingId) => set((state) => ({
        columnMappings: state.columnMappings.filter(m => m.id !== mappingId)
      })),
      
      addTransformation: (transformation) => set((state) => {
        const existing = state.transformations.findIndex(t => t.sourceId === transformation.sourceId && t.sourceHeader === transformation.sourceHeader);
        if (existing >= 0) {
          const newTrans = [...state.transformations];
          newTrans[existing] = transformation;
          return { transformations: newTrans };
        }
        return { transformations: [...state.transformations, transformation] };
      }),
      updateTransformation: (transformation) => set((state) => ({
        transformations: state.transformations.map(t => t.id === transformation.id ? transformation : t)
      })),
    }),
    {
      name: 'data-migrator-storage',
      partialize: (state) => ({
        theme: state.theme,
        isAuthenticated: state.isAuthenticated,
        project: state.project,
        targetTables: state.targetTables,
        columnMappings: state.columnMappings,
        transformations: state.transformations,
        // Store metadata in localStorage without rawRows payload
        sources: state.sources.map(s => ({
          id: s.id,
          fileName: s.fileName,
          rowCount: s.rowCount,
          headers: s.headers,
          profiles: s.profiles,
          sampleData: s.sampleData.slice(0, 50)
        })),
        savedWorkspaces: state.savedWorkspaces.map(ws => ({
          project: ws.project,
          targetTables: ws.targetTables,
          columnMappings: ws.columnMappings,
          transformations: ws.transformations,
          updatedAt: ws.updatedAt,
          sources: ws.sources.map(s => ({
            id: s.id,
            fileName: s.fileName,
            rowCount: s.rowCount,
            headers: s.headers,
            profiles: s.profiles,
            sampleData: s.sampleData.slice(0, 50)
          }))
        }))
      })
    }
  )
);
