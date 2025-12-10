import { ControlPanel } from './components/control-panel';

export default function WorkspacePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="flex min-h-screen flex-col">
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
                <p className="text-sm font-semibold text-gray-900">Untitled project</p>
                <p className="text-xs text-gray-500">Autosave ready</p>
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
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[360px] border-r border-gray-200 bg-white">
            <ControlPanel />
          </div>
          <main className="flex-1 overflow-y-auto bg-white">
            <section className="border-b border-gray-200 px-10 py-8">
              <div className="mx-auto max-w-4xl">
                <header className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Slide preview</p>
                    <p className="text-sm text-gray-500">16:9 canvas with selection overlay</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                    >
                      Fit
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                    >
                      100%
                    </button>
                  </div>
                </header>
                <div className="aspect-video w-full rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    Slide preview placeholder
                  </div>
                </div>
              </div>
            </section>
            <section className="px-10 py-8">
              <div className="mx-auto max-w-4xl">
                <header className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Generated results</p>
                    <p className="text-sm text-gray-500">Three flat/minimal options sized to your selection</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    Refresh
                  </button>
                </header>
                <div className="grid gap-6 md:grid-cols-3">
                  {[1, 2, 3].map((card) => (
                    <article
                      key={card}
                      className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                    >
                      <div className="aspect-square border-b border-gray-100 bg-gray-50">
                        <div className="flex h-full items-center justify-center text-xs text-gray-500">
                          Result {card}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
                        <button
                          type="button"
                          className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                        >
                          Download PNG
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
