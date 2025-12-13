'use client';

import { useState } from 'react';
import { useWorkspaceProject } from '../hooks/use-workspace-project';
import { GenerationSettingsSection } from './generation-settings-section';
import { ProjectInfoSection } from './project-info-section';
import { PromptInputSection } from './prompt-input-section';
import { SlideUploadSection } from './slide-upload-section';
import { TipsSection } from './tips-section';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export function ControlPanel() {
  const { project, updateProject } = useWorkspaceProject();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleRename = (nextName: string) => {
    const trimmed = nextName.trim();
    updateProject({
      name: trimmed.length ? trimmed : 'Untitled project',
    });
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
      <TipsSection />
    </aside>
  );
}
