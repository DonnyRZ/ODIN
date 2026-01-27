'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkspaceProject } from '../hooks/use-workspace-project';

const downloadImage = async (imageUrl: string, filename: string) => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(imageUrl, '_blank', 'noopener');
  }
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
  const { project, updateProject } = useWorkspaceProject();
  const isGenerating = project.generationStatus === 'generating';
  const visibleResults = [...project.results].slice(-12).reverse();
  const placeholders = Array.from({ length: project.pendingSlots });
  const hasResults = visibleResults.length > 0;
  const hasError = project.generationStatus === 'error' && project.generationError;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async (id: string, imageUrl: string) => {
    try {
      await copyImage(imageUrl);
      setCopiedId(id);
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setCopiedId(null);
        resetTimerRef.current = null;
      }, 3000);
    } catch {
      // No-op: keep label as "Copy" if clipboard fails.
    }
  };

  return (
    <section className="px-10 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Generated results</p>
            <p className="text-sm text-gray-500">
              {isGenerating
                ? 'Generating visuals sequentially...'
                : 'New flat/minimal options appear here as soon as they are ready.'}
            </p>
          </div>
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => {
              updateProject({
                results: [],
                pendingSlots: 0,
                generationStatus: 'idle',
                generationError: null,
              });
            }}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            Clear results
          </button>
        </header>
        {hasError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {project.generationError}
          </div>
        )}
        {hasResults || placeholders.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3">
            {placeholders.map((_, index) => (
              <article
                key={`placeholder-${index}`}
                className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
              >
                <div className="aspect-square border-b border-gray-100 bg-gray-50">
                  <div className="flex h-full w-full items-center justify-center rounded-t-xl">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-red-500" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-4 py-4">
                  <div className="h-10 w-full rounded-full bg-gray-200/70" />
                  <div className="h-10 w-full rounded-full bg-gray-100" />
                </div>
              </article>
            ))}
            {visibleResults.map((result) => (
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
                    onClick={() => handleCopy(result.id, result.imageUrl)}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    {copiedId === result.id ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void downloadImage(result.imageUrl, `odin-visual-${result.id}.png`);
                    }}
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
