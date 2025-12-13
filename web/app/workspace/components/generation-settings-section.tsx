import { useState } from 'react';
import { useWorkspaceProject } from '../hooks/use-workspace-project';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8800';

type ApiGeneratedResult = {
  id: string;
  image_base64: string;
  description: string;
  created_at: string;
};

type ApiGenerateResponse = {
  results: ApiGeneratedResult[];
};

export function GenerationSettingsSection() {
  const { project, appendGenerationResults, setGenerationState } = useWorkspaceProject();
  const [formError, setFormError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'square' | 'portrait_9x16' | 'landscape_16x9'>('square');

  const isGenerating = project.generationStatus === 'generating';

  const handleGenerate = async () => {
    if (!project.slideImage) {
      setFormError('Upload a slide screenshot first.');
      return;
    }

    setFormError(null);
    setGenerationState('generating');

    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_name: project.name,
          prompt: project.prompt ?? '',
          slide_context: project.prompt ?? '',
          slide_image_base64: project.slideImage,
          variant_count: 3,
          creativity: 0.5,
          aspect_ratio: aspectRatio,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiGenerateResponse;
      appendGenerationResults(
        payload.results.map((result) => ({
          id: result.id,
          imageUrl: `data:image/png;base64,${result.image_base64}`,
          description: result.description,
          createdAt: result.created_at,
          source: 'api',
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setGenerationState('error', message);
      setFormError(`Unable to generate visuals: ${message}`);
    }
  };

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
            value={aspectRatio}
            onChange={(event) =>
              setAspectRatio(event.target.value as 'square' | 'portrait_9x16' | 'landscape_16x9')
            }
            className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
          >
            <option value="square">Square (1:1)</option>
            <option value="portrait_9x16">9:16 (Story/Portrait)</option>
            <option value="landscape_16x9">16:9 (Widescreen)</option>
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
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:bg-red-300"
        >
          {isGenerating ? 'Generating...' : 'Generate 3 visuals'}
        </button>
        {formError ? (
          <p className="text-xs font-semibold text-red-600">{formError}</p>
        ) : (
          <p className="text-xs text-gray-500">
            {isGenerating ? 'Generating visuals...' : 'Results will appear on the right. Expect 4-8 seconds per batch.'}
          </p>
        )}
      </div>
    </section>
  );
}
