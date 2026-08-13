import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, WorkspaceSnapshot } from './types';

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      
      savedWorkspaces: [],
      
      project: null,
      sources: [],
      targetTables: [],
      columnMappings: [],
      transformations: [],

      loadWorkspace: (id) => {
        const ws = get().savedWorkspaces.find(w => w.project.id === id);
        if (ws) {
          set({
            project: ws.project,
            sources: ws.sources,
            targetTables: ws.targetTables,
            columnMappings: ws.columnMappings,
            transformations: ws.transformations
          });
        }
      },

      saveCurrentWorkspace: () => {
        const state = get();
        if (!state.project) return;
        
        const snapshot: WorkspaceSnapshot = {
          project: state.project,
          sources: state.sources,
          targetTables: state.targetTables,
          columnMappings: state.columnMappings,
          transformations: state.transformations,
          updatedAt: Date.now()
        };

        set((s) => {
          const existingIndex = s.savedWorkspaces.findIndex(w => w.project.id === s.project!.id);
          if (existingIndex >= 0) {
            const newWorkspaces = [...s.savedWorkspaces];
            newWorkspaces[existingIndex] = snapshot;
            return { savedWorkspaces: newWorkspaces };
          } else {
            return { savedWorkspaces: [...s.savedWorkspaces, snapshot] };
          }
        });
      },

      deleteWorkspace: (id) => set((s) => ({
        savedWorkspaces: s.savedWorkspaces.filter(w => w.project.id !== id),
        ...(s.project?.id === id ? {
          project: null,
          sources: [],
          targetTables: [],
          columnMappings: [],
          transformations: []
        } : {})
      })),

      setProject: (project) => set({ project }),
      addSource: (data) => set((state) => ({ sources: [...state.sources, data] })),
      removeSource: (id) => set((state) => ({
        sources: state.sources.filter(s => s.id !== id),
        columnMappings: state.columnMappings.filter(m => m.sourceId !== id),
        transformations: state.transformations.filter(t => t.sourceId !== id)
      })),
      
      addTargetTable: (table) => set((state) => ({ targetTables: [...state.targetTables, table] })),
      updateTargetTable: (table) => set((state) => ({
        targetTables: state.targetTables.map(t => t.id === table.id ? table : t)
      })),
      removeTargetTable: (tableId) => set((state) => ({
        targetTables: state.targetTables.filter(t => t.id !== tableId),
        columnMappings: state.columnMappings.filter(m => m.targetTableId !== tableId)
      })),
      
      addColumnMapping: (mapping) => set((state) => {
        const filtered = state.columnMappings.filter(m => !(m.sourceId === mapping.sourceId && m.sourceHeader === mapping.sourceHeader && m.targetColumnId === mapping.targetColumnId));
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
        ...state,
        // Don't persist raw rows to avoid hitting localStorage limits
        sources: state.sources.map(s => ({ ...s, rawRows: undefined, sampleData: s.sampleData.slice(0, 10) })),
        savedWorkspaces: state.savedWorkspaces.map(ws => ({
          ...ws,
          sources: ws.sources.map(s => ({ ...s, rawRows: undefined, sampleData: s.sampleData.slice(0, 10) }))
        }))
      })
    }
  )
);
