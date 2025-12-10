export function DrawToolsSection() {
  return (
    <section className="border-b border-gray-200 px-6 py-6">
      <header className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Draw area</p>
        <button
          type="button"
          className="text-xs font-semibold text-red-600 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          Clear selection
        </button>
      </header>
      <div className="mt-4 space-y-4">
        <button
          type="button"
          className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          Draw rectangle
        </button>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Selection</p>
          <p className="mt-1 text-sm text-gray-600">No area selected</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Snapping</p>
          <p className="mt-1 text-sm text-gray-600">Square &amp; 16:9 snapping shown here once a selection exists.</p>
        </div>
      </div>
    </section>
  );
}
