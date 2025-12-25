export type WorkspaceGenerationResult = {
  id: string;
  imageUrl: string;
  description: string;
  createdAt: string;
  source?: 'mock' | 'api';
};

export type WorkspaceProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  autosaveStatus: 'ready' | 'saving';
  slideImage?: string;
  prompt?: string;
  results: WorkspaceGenerationResult[];
  generationStatus: 'idle' | 'generating' | 'error';
  generationError?: string | null;
  pendingSlots: number;
};

const PROJECT_STORAGE_KEY = 'odin.workspace.project';
const OWNER_STORAGE_KEY = 'odin.workspace.owner';
const ACTIVE_PROJECT_KEY = 'odin.workspace.active_project';
const AUTH_TOKEN_KEY = 'odin.workspace.auth_token';

const isBrowser = () => typeof window !== 'undefined';

export const createDefaultWorkspaceProject = (): WorkspaceProject => {
  const now = new Date().toISOString();

  return {
    id: 'local-project',
    name: 'Untitled project',
    createdAt: now,
    updatedAt: now,
    autosaveStatus: 'ready',
    results: [],
    generationStatus: 'idle',
    generationError: null,
    pendingSlots: 0,
  };
};

export const getOwnerId = (): string => {
  if (!isBrowser()) {
    return 'local';
  }

  const existing = window.localStorage.getItem(OWNER_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = window.crypto?.randomUUID?.() ?? `owner-${Date.now()}`;
  window.localStorage.setItem(OWNER_STORAGE_KEY, created);
  return created;
};

export const setActiveProjectId = (projectId: string) => {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
};

export const clearActiveProjectId = () => {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
};

export const getActiveProjectId = (): string | null => {
  if (!isBrowser()) {
    return null;
  }
  return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
};

export const setAuthToken = (token: string) => {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const getAuthToken = (): string | null => {
  if (!isBrowser()) {
    return null;
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

export const clearAuthToken = () => {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const loadWorkspaceProject = (): WorkspaceProject => {
  if (!isBrowser()) {
    return createDefaultWorkspaceProject();
  }

  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) {
      return createDefaultWorkspaceProject();
    }

    const parsed = JSON.parse(raw) as WorkspaceProject;
    return {
      ...createDefaultWorkspaceProject(),
      ...parsed,
      pendingSlots: parsed.pendingSlots ?? 0,
    };
  } catch {
    return createDefaultWorkspaceProject();
  }
};

export const persistWorkspaceProject = (project: WorkspaceProject) => {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Swallow quota errors for now; future work can surface UI toasts.
  }
};

export const updateWorkspaceProject = (updates: Partial<WorkspaceProject>) => {
  const next = {
    ...loadWorkspaceProject(),
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  persistWorkspaceProject(next);
  return next;
};

export const clearWorkspaceProject = () => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(PROJECT_STORAGE_KEY);
};
