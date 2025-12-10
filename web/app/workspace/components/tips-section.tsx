export function TipsSection() {
  return (
    <section className="px-6 py-6">
      <header className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Tips</p>
        <button
          type="button"
          className="text-xs font-semibold text-red-600 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          Collapse
        </button>
      </header>
      <ul className="mt-4 space-y-3 text-sm text-gray-600">
        <li className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          Use high-resolution screenshots to avoid blurry previews.
        </li>
        <li className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          Keep bullet points concise so ODIN knows what the visual should convey.
        </li>
        <li className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          Selections snap to squares or 16:9 when within 5% tolerance.
        </li>
      </ul>
    </section>
  );
}
