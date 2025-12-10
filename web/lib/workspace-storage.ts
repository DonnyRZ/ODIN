export type WorkspaceSelection = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkspaceProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  autosaveStatus: 'ready' | 'saving';
  slideImage?: string;
  prompt?: string;
  selection?: WorkspaceSelection;
};

const PROJECT_STORAGE_KEY = 'odin.workspace.project';

const isBrowser = () => typeof window !== 'undefined';

export const createDefaultWorkspaceProject = (): WorkspaceProject => {
  const now = new Date().toISOString();

  return {
    id: 'local-project',
    name: 'Untitled project',
    createdAt: now,
    updatedAt: now,
    autosaveStatus: 'ready',
  };
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
