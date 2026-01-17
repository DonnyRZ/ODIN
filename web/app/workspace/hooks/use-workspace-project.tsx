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
  getActiveProjectId,
  getAuthToken,
  loadWorkspaceProject,
  persistWorkspaceProject,
  setActiveProjectId,
} from '@/lib/workspace-storage';
import { useSearchParams } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

type WorkspaceProjectContextValue = {
  project: WorkspaceProject;
  isHydrated: boolean;
  updateProject: (updates: Partial<WorkspaceProject>) => void;
  updatePrompt: (prompt: string) => void;
  setAutosaveStatus: (status: WorkspaceProject['autosaveStatus']) => void;
  appendGenerationResults: (results: WorkspaceGenerationResult[]) => void;
  setGenerationState: (state: WorkspaceProject['generationStatus'], error?: string | null) => void;
  setPendingSlots: (count: number) => void;
  renameProject: (name: string) => Promise<void>;
};

const WorkspaceProjectContext = createContext<WorkspaceProjectContextValue | undefined>(undefined);

export function WorkspaceProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<WorkspaceProject>(() => createDefaultWorkspaceProject());
  const [isHydrated, setIsHydrated] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const authToken = getAuthToken();
    const projectIdFromUrl = searchParams.get('project') || getActiveProjectId();
    const fallback = loadWorkspaceProject();

    const hydrate = async () => {
      try {
        if (!authToken) {
          const resetState: WorkspaceProject = {
            ...fallback,
            generationStatus: 'idle',
            generationError: null,
          };
          setProject(resetState);
          persistWorkspaceProject(resetState);
          setIsHydrated(true);
          return;
        }

        const listResponse = await fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!listResponse.ok) {
          throw new Error('Failed to load projects');
        }
        const listPayload = (await listResponse.json()) as {
          projects: Array<{
            id: string;
            name: string;
            created_at: string;
            updated_at: string;
            last_prompt?: string;
          }>;
        };

        if (!listPayload.projects.length) {
          const resetState: WorkspaceProject = {
            ...fallback,
            generationStatus: 'idle',
            generationError: null,
          };
          setProject(resetState);
          persistWorkspaceProject(resetState);
          setIsHydrated(true);
          return;
        }

        const activeProject =
          listPayload.projects.find((entry) => entry.id === projectIdFromUrl) ?? listPayload.projects[0];
        const projectResponse = await fetch(
          `${API_BASE_URL}/projects/${activeProject.id}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );
        if (!projectResponse.ok) {
          throw new Error('Failed to load project');
        }
        const projectPayload = (await projectResponse.json()) as {
          project: {
            id: string;
            name: string;
            created_at: string;
            updated_at: string;
            last_prompt?: string;
            last_slide_context?: string;
            slide_image_path?: string | null;
          };
          generations: Array<{
            id: string;
            image_path: string;
            description: string;
            aspect_ratio: string;
            created_at: string;
          }>;
        };

        const results: WorkspaceGenerationResult[] = await Promise.all(
          projectPayload.generations.map(async (generation) => {
            const imageResponse = await fetch(
              `${API_BASE_URL}/generations/${generation.id}/image`,
              {
                headers: { Authorization: `Bearer ${authToken}` },
              },
            );
            if (!imageResponse.ok) {
              throw new Error('Failed to load image.');
            }
            const blob = await imageResponse.blob();
            const objectUrl = URL.createObjectURL(blob);
            return {
              id: generation.id,
              imageUrl: objectUrl,
              description: generation.description,
              createdAt: generation.created_at,
              source: 'api',
            };
          }),
        );

        let slideImage: string | undefined;
        if (projectPayload.project.slide_image_path) {
          try {
            const slideResponse = await fetch(
              `${API_BASE_URL}/projects/${projectPayload.project.id}/slide-image`,
              {
                headers: { Authorization: `Bearer ${authToken}` },
              },
            );
            if (slideResponse.ok) {
              const slideBlob = await slideResponse.blob();
              slideImage = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(slideBlob);
              });
            }
          } catch {
            slideImage = undefined;
          }
        }

        const hydrated: WorkspaceProject = {
          id: projectPayload.project.id,
          name: projectPayload.project.name,
          createdAt: projectPayload.project.created_at,
          updatedAt: projectPayload.project.updated_at,
          autosaveStatus: 'ready',
          prompt: projectPayload.project.last_prompt ?? '',
          slideImage,
          results,
          generationStatus: 'idle',
          generationError: null,
          pendingSlots: 0,
        };

        setProject(hydrated);
        persistWorkspaceProject(hydrated);
        setActiveProjectId(projectPayload.project.id);
        setIsHydrated(true);
      } catch {
        const resetState: WorkspaceProject = {
          ...fallback,
          generationStatus: 'idle',
          generationError: null,
        };
        setProject(resetState);
        persistWorkspaceProject(resetState);
        setIsHydrated(true);
      }
    };

    hydrate();
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

  const renameProject = useCallback(
    async (name: string) => {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('Authentication required.');
      }
      const response = await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name,
          prompt: project.prompt ?? '',
          slide_context: project.prompt ?? '',
        }),
      });
      if (!response.ok) {
        throw new Error('Unable to rename project.');
      }
      updateProject({ name });
    },
    [project.id, project.prompt, updateProject],
  );

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
      renameProject,
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
      renameProject,
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
