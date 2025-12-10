'use client';

import { useWorkspaceProject } from '../hooks/use-workspace-project';

export function DrawToolsSection() {
  const { project, updateSelection } = useWorkspaceProject();
  const selection = project.selection;

  const handleClear = () => {
    updateSelection(undefined);
  };

  const selectionLabel = selection
    ? `${Math.round(selection.width)} × ${Math.round(selection.height)} px`
    : 'No area selected';

  return (
    <section className="border-b border-gray-200 px-6 py-6">
      <header className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Draw area</p>
        <button
          type="button"
          onClick={selection ? handleClear : undefined}
          disabled={!selection}
          className="text-xs font-semibold text-red-600 disabled:text-gray-400 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:hover:text-gray-400"
        >
          Clear selection
        </button>
      </header>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-gray-600">
          Click and drag directly on the slide preview to draw a rectangle. Use the handles to resize.
        </p>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs	font-semibold uppercase tracking-[0.2em] text-gray-400">Selection</p>
          <p className="mt-1 text-sm text-gray-600">{selectionLabel}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Snapping</p>
          <p className="mt-1 text-sm text-gray-600">Snapping info will appear once ratio detection is enabled.</p>
        </div>
      </div>
    </section>
  );
}
