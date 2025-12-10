'use client';

import { useWorkspaceProject } from '../hooks/use-workspace-project';
import { DrawToolsSection } from './draw-tools-section';
import { GenerationSettingsSection } from './generation-settings-section';
import { ProjectInfoSection } from './project-info-section';
import { PromptInputSection } from './prompt-input-section';
import { SlideUploadSection } from './slide-upload-section';
import { TipsSection } from './tips-section';

export function ControlPanel() {
  const { project, updateProject } = useWorkspaceProject();

  const handleRename = (nextName: string) => {
    const trimmed = nextName.trim();
    updateProject({
      name: trimmed.length ? trimmed : 'Untitled project',
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
      <SlideUploadSection hasSlide={Boolean(project.slideImage)} />
      <DrawToolsSection />
      <PromptInputSection />
      <GenerationSettingsSection />
      <TipsSection />
    </aside>
  );
}
