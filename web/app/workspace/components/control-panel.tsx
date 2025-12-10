import { DrawToolsSection } from './draw-tools-section';
import { GenerationSettingsSection } from './generation-settings-section';
import { ProjectInfoSection } from './project-info-section';
import { PromptInputSection } from './prompt-input-section';
import { SlideUploadSection } from './slide-upload-section';
import { TipsSection } from './tips-section';

export function ControlPanel() {
  return (
    <aside className="flex h-full flex-col overflow-y-auto bg-white">
      <ProjectInfoSection />
      <SlideUploadSection />
      <DrawToolsSection />
      <PromptInputSection />
      <GenerationSettingsSection />
      <TipsSection />
    </aside>
  );
}
