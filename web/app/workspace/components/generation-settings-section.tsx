import { useState } from 'react';
import { useWorkspaceProject } from '../hooks/use-workspace-project';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

type ApiGeneratedResult = {
  id: string;
  image_url: string;
  description: string;
  created_at: string;
};

type ApiGenerateResponse = {
  results: ApiGeneratedResult[];
};

export function GenerationSettingsSection() {
  const { project, appendGenerationResults, setGenerationState } = useWorkspaceProject();
  const [formError, setFormError] = useState<string | null>(null);

  const isGenerating = project.generationStatus === 'generating';

  const handleGenerate = async () => {
    if (!project.slideImage) {
      setFormError('Upload a slide screenshot first.');
      return;
    }
    if (!project.selection) {
      setFormError('Draw a rectangle on the slide to define the visual area.');
      return;
    }
    if (!API_BASE_URL) {
      setFormError('Server URL missing. Set NEXT_PUBLIC_API_BASE_URL in .env.');
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
          selection: project.selection,
          variant_count: 3,
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
          imageUrl: result.image_url,
          description: result.description,
          createdAt: result.created_at,
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
            {isGenerating ? 'Generating mock visuals...' : 'Results will appear on the right. Expect 4-8 seconds per batch.'}
          </p>
        )}
      </div>
    </section>
  );
}
