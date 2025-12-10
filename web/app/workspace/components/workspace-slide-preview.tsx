'use client';

import { useWorkspaceProject } from '../hooks/use-workspace-project';

export function WorkspaceSlidePreview() {
  const { project } = useWorkspaceProject();
  const hasSlide = Boolean(project.slideImage);

  return (
    <div className="aspect-video w-full rounded-xl border border-gray-200 bg-gray-50">
      {hasSlide ? (
        <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.slideImage}
            alt="Slide preview"
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">
          Upload a slide screenshot to preview it here
        </div>
      )}
    </div>
  );
}
