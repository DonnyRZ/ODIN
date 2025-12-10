'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  WorkspaceProject,
  WorkspaceSelection,
  createDefaultWorkspaceProject,
  loadWorkspaceProject,
  persistWorkspaceProject,
} from '@/lib/workspace-storage';

type WorkspaceProjectContextValue = {
  project: WorkspaceProject;
  isHydrated: boolean;
  updateProject: (updates: Partial<WorkspaceProject>) => void;
  updateSelection: (selection: WorkspaceSelection | undefined) => void;
};

const WorkspaceProjectContext = createContext<WorkspaceProjectContextValue | undefined>(undefined);

export function WorkspaceProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<WorkspaceProject>(() => createDefaultWorkspaceProject());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setProject(loadWorkspaceProject());
    setIsHydrated(true);
  }, []);

  const updateProject = useCallback((updates: Partial<WorkspaceProject>) => {
    setProject((prev) => {
      const next = {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      persistWorkspaceProject(next);
      return next;
    });
  }, []);

  const updateSelection = useCallback((selection: WorkspaceSelection | undefined) => {
    setProject((prev) => {
      const next = {
        ...prev,
        selection,
        updatedAt: new Date().toISOString(),
      };
      persistWorkspaceProject(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      project,
      isHydrated,
      updateProject,
      updateSelection,
    }),
    [project, isHydrated, updateProject, updateSelection],
  );

  return <WorkspaceProjectContext.Provider value={value}>{children}</WorkspaceProjectContext.Provider>;
}

export function useWorkspaceProject() {
  const context = useContext(WorkspaceProjectContext);
  if (!context) {
    throw new Error('useWorkspaceProject must be used within WorkspaceProjectProvider');
  }
  return context;
}
