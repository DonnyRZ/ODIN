export function GenerationSettingsSection() {
  return (
    <section className="border-b border-gray-200 px-6 py-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Generate</p>
      </header>
      <div className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-gray-700" htmlFor="ratio">
          Aspect ratio
          <select
            id="ratio"
            name="ratio"
            defaultValue="auto"
            className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
          >
            <option value="auto">Auto (match selection)</option>
            <option value="square">Square</option>
            <option value="widescreen">16:9</option>
          </select>
        </label>
        <label className="flex items-center gap-3 text-sm text-gray-600">
          <input
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          Lock to detected colors
        </label>
        <button
          type="button"
          className="w-full rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          Generate 3 visuals
        </button>
        <p className="text-xs text-gray-500">Results will appear on the right. Expect 4-8 seconds per batch.</p>
      </div>
    </section>
  );
}
