export function PromptInputSection() {
  return (
    <section className="border-b border-gray-200 px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Slide text</p>
          <p className="text-sm text-gray-500">Paste title + bullets so ODIN understands context.</p>
        </div>
      </header>
      <div className="mt-4 space-y-3">
        <textarea
          name="slide-text"
          placeholder="e.g. Title: Q4 metrics. Bullets: Revenue up 32%, CAC down 11%..."
          rows={6}
          className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
        />
        <footer className="flex items-center justify-between text-xs text-gray-500">
          <p>Optional but highly recommended for precise visuals.</p>
          <button
            type="button"
            className="font-semibold text-red-600 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Insert sample text
          </button>
        </footer>
      </div>
    </section>
  );
}
