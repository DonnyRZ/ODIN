'use client';

import { useWorkspaceProject } from '../hooks/use-workspace-project';

const downloadImage = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyImage = async (dataUrl: string) => {
  if (!navigator.clipboard || !window.ClipboardItem) {
    await navigator.clipboard.writeText(dataUrl);
    return;
  }
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
};

export function GeneratedResultsSection() {
  const { project } = useWorkspaceProject();
  const isGenerating = project.generationStatus === 'generating';
  const hasResults = project.results.length > 0;
  const hasError = project.generationStatus === 'error' && project.generationError;

  return (
    <section className="px-10 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Generated results</p>
            <p className="text-sm text-gray-500">
              {isGenerating ? 'Generating visuals...' : 'Three flat/minimal options tailored to your chosen ratio'}
            </p>
          </div>
          <button
            type="button"
            disabled={isGenerating}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            Refresh
          </button>
        </header>
        {hasError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {project.generationError}
          </div>
        )}
        {hasResults ? (
          <div className="grid gap-6 md:grid-cols-3">
            {project.results
              .slice(-3)
              .reverse()
              .map((result) => (
                <article
                  key={result.id}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                >
                  <div className="aspect-square border-b border-gray-100 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.imageUrl}
                      alt={result.description}
                      className="h-full w-full rounded-t-xl object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 px-4 py-4">
                    <button
                     type="button"
                      onClick={() => copyImage(result.imageUrl)}
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadImage(result.imageUrl, `odin-visual-${result.id}.png`)}
                      className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                    >
                      Download PNG
                    </button>
                  </div>
                </article>
              ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center text-sm text-gray-500">
            {isGenerating ? 'Generating visuals...' : 'Click Generate to see visuals appear here.'}
          </div>
        )}
      </div>
    </section>
  );
}
