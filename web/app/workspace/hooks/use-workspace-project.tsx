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
  WorkspaceGenerationResult,
  WorkspaceProject,
  createDefaultWorkspaceProject,
  loadWorkspaceProject,
  persistWorkspaceProject,
} from '@/lib/workspace-storage';

type WorkspaceProjectContextValue = {
  project: WorkspaceProject;
  isHydrated: boolean;
  updateProject: (updates: Partial<WorkspaceProject>) => void;
  updatePrompt: (prompt: string) => void;
  setAutosaveStatus: (status: WorkspaceProject['autosaveStatus']) => void;
  appendGenerationResults: (results: WorkspaceGenerationResult[]) => void;
  setGenerationState: (state: WorkspaceProject['generationStatus'], error?: string | null) => void;
  setPendingSlots: (count: number) => void;
};

const WorkspaceProjectContext = createContext<WorkspaceProjectContextValue | undefined>(undefined);

export function WorkspaceProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<WorkspaceProject>(() => createDefaultWorkspaceProject());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadWorkspaceProject();
    const resetState: WorkspaceProject = {
      ...loaded,
      generationStatus: 'idle',
      generationError: null,
    };
    setProject(resetState);
    persistWorkspaceProject(resetState);
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

  const updatePrompt = useCallback((prompt: string) => {
    setProject((prev) => {
      const next = {
        ...prev,
        prompt,
        updatedAt: new Date().toISOString(),
      };
      persistWorkspaceProject(next);
      return next;
    });
  }, []);

  const setAutosaveStatus = useCallback((status: WorkspaceProject['autosaveStatus']) => {
    setProject((prev) => {
      const next = {
        ...prev,
        autosaveStatus: status,
      };
      return next;
    });
  }, []);

  const appendGenerationResults = useCallback((results: WorkspaceGenerationResult[]) => {
    setProject((prev) => {
      const nextResults = [...(prev.results ?? []), ...results].slice(-12);
      const next = {
        ...prev,
        results: nextResults,
        generationError: null,
        updatedAt: new Date().toISOString(),
        pendingSlots: Math.max(prev.pendingSlots - results.length, 0),
      };
      persistWorkspaceProject(next);
      return next;
    });
  }, []);

  const setGenerationState = useCallback(
    (state: WorkspaceProject['generationStatus'], error: string | null = null) => {
      setProject((prev) => {
        const next = {
          ...prev,
          generationStatus: state,
          generationError: error,
          updatedAt: new Date().toISOString(),
        };
        persistWorkspaceProject(next);
        return next;
      });
    },
    [],
  );

  const setPendingSlots = useCallback((count: number) => {
    setProject((prev) => {
      const next = {
        ...prev,
        pendingSlots: count,
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
      updatePrompt,
      setAutosaveStatus,
      appendGenerationResults,
      setGenerationState,
      setPendingSlots,
    }),
    [
      project,
      isHydrated,
      updateProject,
      updatePrompt,
      setAutosaveStatus,
      appendGenerationResults,
      setGenerationState,
      setPendingSlots,
    ],
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
