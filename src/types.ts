export type Project = {
  id: string;
  name: string;
  description: string;
};

export type SourceColumnProfile = {
  name: string;
  detectedType: 'string' | 'number' | 'date' | 'boolean';
  uniqueCount: number;
  nullCount: number;
  sampleValues: any[];
};

export type SourceData = {
  id: string;
  fileName: string;
  rowCount: number;
  headers: string[];
  profiles: Record<string, SourceColumnProfile>;
  sampleData: Record<string, any>[]; // First 100 rows for preview
  rawRows?: any[]; // Full data for client-side generation
};

export type TargetColumn = {
  id: string;
  name: string;
  type: 'uuid' | 'varchar' | 'text' | 'integer' | 'bigint' | 'boolean' | 'date' | 'timestamp' | 'timestamptz' | 'serial' | 'bigserial' | 'json' | 'jsonb' | 'numeric' | 'real' | 'double precision' | 'enum';
  isPrimaryKey?: boolean;
  nullable?: boolean;
  references?: {
    tableId: string;
    columnId: string;
  };
  isImported?: boolean;
};

export type TargetTable = {
  id: string;
  name: string;
  columns: TargetColumn[];
  isImported?: boolean;
};

export type ColumnMapping = {
  id: string;
  sourceId: string;
  sourceHeader: string;
  targetTableId: string;
  targetColumnId: string;
};

export type Transformation = {
  id: string;
  sourceId: string;
  sourceHeader: string;
  type: 'REPLACE'; // Expandable to LOOKUP, ID_MAP, DEFAULT, FORMAT
  mappings: Record<string, string | number>; // originalValue -> newValue
};

export type WorkspaceSnapshot = {
  project: Project;
  sources: SourceData[];
  targetTables: TargetTable[];
  columnMappings: ColumnMapping[];
  transformations: Transformation[];
  updatedAt: number;
};

export type AppState = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;

  savedWorkspaces: WorkspaceSnapshot[];

  project: Project | null;
  sources: SourceData[];
  targetTables: TargetTable[];
  columnMappings: ColumnMapping[];
  transformations: Transformation[];
  
  // Actions
  initDatabase: () => Promise<void>;
  loadWorkspace: (id: string) => void;
  saveCurrentWorkspace: () => void;
  deleteWorkspace: (id: string) => void;

  setProject: (project: Project) => void;
  addSource: (data: SourceData) => void;
  updateSource: (source: SourceData) => void;
  updateSourceRows: (sourceId: string, rows: any[]) => void;
  removeSource: (id: string) => void;
  addTargetTable: (table: TargetTable) => void;
  updateTargetTable: (table: TargetTable) => void;
  removeTargetTable: (tableId: string) => void;
  addColumnMapping: (mapping: ColumnMapping) => void;
  removeColumnMapping: (mappingId: string) => void;
  addTransformation: (transformation: Transformation) => void;
  updateTransformation: (transformation: Transformation) => void;
};
