import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DataMigratorDB extends DBSchema {
  sources: {
    key: string;
    value: {
      id: string;
      fileName: string;
      rowCount: number;
      headers: string[];
      profiles: Record<string, any>;
      sampleData: any[];
      rawRows: any[];
      updatedAt: number;
    };
  };
  workspaces: {
    key: string;
    value: {
      id: string;
      project: any;
      sources: any[];
      targetTables: any[];
      columnMappings: any[];
      transformations: any[];
      updatedAt: number;
    };
  };
}

const DB_NAME = 'DataMigrator_SQLite_Store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DataMigratorDB>> | null = null;

export const getDatabase = () => {
  if (!dbPromise) {
    dbPromise = openDB<DataMigratorDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sources')) {
          db.createObjectStore('sources', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workspaces')) {
          db.createObjectStore('workspaces', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

// Source Data CRUD (Handles millions of rows without LocalStorage limits)
export const saveSourceToDB = async (source: any) => {
  try {
    const db = await getDatabase();
    await db.put('sources', {
      ...source,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error('Failed to save source to IndexedDB:', err);
  }
};

export const getSourceFromDB = async (id: string) => {
  try {
    const db = await getDatabase();
    return await db.get('sources', id);
  } catch (err) {
    console.error('Failed to fetch source from IndexedDB:', err);
    return null;
  }
};

export const getAllSourcesFromDB = async () => {
  try {
    const db = await getDatabase();
    return await db.getAll('sources');
  } catch (err) {
    console.error('Failed to fetch all sources from IndexedDB:', err);
    return [];
  }
};

export const deleteSourceFromDB = async (id: string) => {
  try {
    const db = await getDatabase();
    await db.delete('sources', id);
  } catch (err) {
    console.error('Failed to delete source from IndexedDB:', err);
  }
};

// Workspace snapshots
export const saveWorkspaceToDB = async (workspace: any) => {
  try {
    const db = await getDatabase();
    await db.put('workspaces', {
      ...workspace,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error('Failed to save workspace to IndexedDB:', err);
  }
};

export const getAllWorkspacesFromDB = async () => {
  try {
    const db = await getDatabase();
    return await db.getAll('workspaces');
  } catch (err) {
    console.error('Failed to get workspaces from IndexedDB:', err);
    return [];
  }
};

export const deleteWorkspaceFromDB = async (id: string) => {
  try {
    const db = await getDatabase();
    await db.delete('workspaces', id);
  } catch (err) {
    console.error('Failed to delete workspace from IndexedDB:', err);
  }
};
