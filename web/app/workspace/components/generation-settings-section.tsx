import { useState } from 'react';
import { useWorkspaceProject } from '../hooks/use-workspace-project';
import { getAuthToken } from '@/lib/workspace-storage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

type SseEvent = {
  event: string;
  data: string;
};

const parseSseEvent = (chunk: string): SseEvent => {
  const lines = chunk.split('\n');
  let eventName = 'message';
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      eventName = line.replace('event:', '').trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.replace('data:', '').trim());
    }
  });

  return {
    event: eventName,
    data: dataLines.join('\n'),
  };
};

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const resolveSlideImage = async (slideImage: string, authToken: string) => {
  if (slideImage.startsWith('data:')) {
    return slideImage;
  }
  const response = await fetch(slideImage, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Unable to load slide image.');
  }
  const blob = await response.blob();
  return toDataUrl(blob);
};

export function GenerationSettingsSection() {
  const { project, appendGenerationResults, setGenerationState, setPendingSlots } = useWorkspaceProject();
  const [formError, setFormError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'square' | 'portrait_9x16' | 'landscape_16x9'>('square');
  const [variantCount, setVariantCount] = useState(3);

  const isGenerating = project.generationStatus === 'generating';

  const handleGenerate = async () => {
    if (!project.slideImage) {
      setFormError('Upload a slide screenshot first.');
      return;
    }

    setFormError(null);
    setGenerationState('generating');
    setPendingSlots(variantCount);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        setGenerationState('error', 'Authentication required.');
        setFormError('Please log in to generate visuals.');
        setPendingSlots(0);
        return;
      }
      const slideImageBase64 = await resolveSlideImage(project.slideImage, authToken);
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          project_name: project.name,
          prompt: project.prompt ?? '',
          slide_context: project.prompt ?? '',
          slide_image_base64: slideImageBase64,
          variant_count: variantCount,
          creativity: 0.7,
          aspect_ratio: aspectRatio,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');
          if (!rawEvent) {
            continue;
          }
          const parsed = parseSseEvent(rawEvent);
          if (parsed.event === 'result') {
            const payload = JSON.parse(parsed.data) as {
              id: string;
              image_base64: string;
              description: string;
              created_at: string;
            };
            appendGenerationResults([
              {
                id: payload.id,
                imageUrl: `data:image/png;base64,${payload.image_base64}`,
                description: payload.description,
                createdAt: payload.created_at,
                source: 'api',
              },
            ]);
          } else if (parsed.event === 'error') {
            const payload = JSON.parse(parsed.data) as { message?: string };
            const message = payload.message || 'Unknown error';
            setGenerationState('error', message);
            setFormError(`Unable to generate visuals: ${message}`);
            reader.cancel();
            return;
          } else if (parsed.event === 'done') {
            setGenerationState('idle');
            setPendingSlots(0);
            reader.cancel();
            return;
          }
        }
      }
      setGenerationState('idle');
      setPendingSlots(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setGenerationState('error', message);
      setFormError(`Unable to generate visuals: ${message}`);
      setPendingSlots(0);
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
        <label className="block text-sm font-medium text-gray-700" htmlFor="variant-count">
          Number of visuals
          <select
            id="variant-count"
            name="variant-count"
            value={variantCount}
            onChange={(event) => setVariantCount(Number(event.target.value))}
            className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value} {value === 1 ? 'visual' : 'visuals'}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:bg-red-300"
        >
          {isGenerating ? 'Generating...' : `Generate ${variantCount} ${variantCount === 1 ? 'visual' : 'visuals'}`}
        </button>
        {formError ? (
          <p className="text-xs font-semibold text-red-600">{formError}</p>
        ) : (
          <p className="text-xs text-gray-500">
            {isGenerating
              ? 'Generating visuals sequentially...'
              : 'Results appear one by one as soon as they are ready.'}
          </p>
        )}
      </div>
    </section>
  );
}
