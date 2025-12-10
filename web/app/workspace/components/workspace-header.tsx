'use client';

import { useWorkspaceProject } from '../hooks/use-workspace-project';

export function WorkspaceHeader() {
  const { project } = useWorkspaceProject();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-8 py-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Back
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-900">{project.name}</p>
            <p className="text-xs text-gray-500">
              {project.autosaveStatus === 'saving' ? 'Saving changes...' : 'Autosave ready'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            className="rounded-full border border-gray-200 px-4 py-2 font-medium text-gray-700 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Share
          </button>
          <button
            type="button"
            className="rounded-full border border-gray-200 px-4 py-2 font-medium text-gray-700 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Download
          </button>
          <button
            type="button"
            className="rounded-full border border-gray-200 px-4 py-2 font-medium text-gray-700 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </header>
  );
}
