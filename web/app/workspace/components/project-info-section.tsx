export function ProjectInfoSection() {
  return (
    <section className="border-b border-gray-200 px-6 py-6">
      <header className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Project</p>
        <button
          type="button"
          className="text-xs font-semibold text-red-600 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          Rename
        </button>
      </header>
      <div className="mt-4 space-y-1">
        <p className="text-lg font-semibold text-gray-900">Untitled project</p>
        <p className="text-sm text-gray-600">Autosave ready</p>
        <p className="text-xs text-gray-400">Created just now</p>
      </div>
    </section>
  );
}
