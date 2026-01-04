'use client';

import { useState } from 'react';
import { useWorkspaceProject } from '../hooks/use-workspace-project';
import { GenerationSettingsSection } from './generation-settings-section';
import { ProjectInfoSection } from './project-info-section';
import { PromptInputSection } from './prompt-input-section';
import { SlideUploadSection } from './slide-upload-section';
import { getAuthToken } from '@/lib/workspace-storage';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8800';

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export function ControlPanel() {
  const { project, updateProject, renameProject } = useWorkspaceProject();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleRename = async (nextName: string) => {
    const trimmed = nextName.trim();
    const name = trimmed.length ? trimmed : 'Untitled project';
    try {
      await renameProject(name);
    } catch {
      updateProject({ name });
    }
  };

  const handleSlideUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Only PNG or JPG images are supported.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('File too large. Max size is 10MB.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateProject({
        slideImage: dataUrl,
      });
      const authToken = getAuthToken();
      if (!authToken) {
        return;
      }
      const response = await fetch(`${API_BASE_URL}/projects/${project.id}/slide-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ slide_image_base64: dataUrl }),
      });
      if (!response.ok) {
        return;
      }
      await response.json();
    } catch {
      setUploadError('Could not load the selected image. Try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSlideClear = () => {
    setUploadError(null);
    updateProject({
      slideImage: undefined,
    });
    const authToken = getAuthToken();
    if (authToken) {
      void fetch(`${API_BASE_URL}/projects/${project.id}/slide-image`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    }
  };

  return (
    <aside className="space-y-0 bg-white">
      <ProjectInfoSection
        name={project.name}
        autosaveStatus={project.autosaveStatus}
        createdAt={project.createdAt}
        onRename={handleRename}
      />
      <SlideUploadSection
        slideImage={project.slideImage}
        isUploading={isUploading}
        uploadError={uploadError}
        onSelectFile={handleSlideUpload}
        onClearSlide={handleSlideClear}
      />
      <PromptInputSection />
      <GenerationSettingsSection />
    </aside>
  );
}
