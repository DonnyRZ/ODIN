import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

type GenerationResult = {
  id: string;
  imageUrl: string;
  description: string;
  createdAt: string;
};

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

const copyImage = async (dataUrl: string) => {
  if (!navigator.clipboard || !window.ClipboardItem) {
    await navigator.clipboard.writeText(dataUrl);
    return;
  }
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('Ready');
  const [formError, setFormError] = useState<string | null>(null);
  const [slideImage, setSlideImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'square' | 'portrait_9x16' | 'landscape_16x9'>('square');
  const [variantCount, setVariantCount] = useState(3);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [pendingSlots, setPendingSlots] = useState(0);
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const projectName = useMemo(() => 'Extension Project', []);

  useEffect(() => {
    const storage = (window as { chrome?: any }).chrome?.storage?.sync;
    if (!storage) {
      setApiBaseUrl(DEFAULT_API_BASE_URL);
      return;
    }
    storage.get({ apiBaseUrl: DEFAULT_API_BASE_URL }, (result: { apiBaseUrl?: string }) => {
      setApiBaseUrl(result.apiBaseUrl || DEFAULT_API_BASE_URL);
    });
  }, []);

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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setFormError('Only PNG or JPG images are supported.');
      return;
    }
    setFormError(null);
    setIsUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSlideImage(dataUrl);
    } catch {
      setFormError('Unable to read the selected image.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!slideImage) {
      setFormError('Upload a slide screenshot first.');
      return;
    }

    setFormError(null);
    setStatus('Generating...');
    setPendingSlots(variantCount);

    try {
      const response = await fetch(`${apiBaseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_name: projectName,
          prompt: prompt || '',
          slide_context: prompt || '',
          slide_image_base64: slideImage,
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
            setResults((prev) =>
              [
                ...prev,
                {
                  id: payload.id,
                  imageUrl: `data:image/png;base64,${payload.image_base64}`,
                  description: payload.description,
                  createdAt: payload.created_at,
                },
              ].slice(-12),
            );
            setPendingSlots((prev) => Math.max(prev - 1, 0));
          } else if (parsed.event === 'error') {
            const payload = JSON.parse(parsed.data) as { message?: string };
            const message = payload.message || 'Unknown error';
            setFormError(`Unable to generate visuals: ${message}`);
            reader.cancel();
            setStatus('Ready');
            setPendingSlots(0);
            return;
          } else if (parsed.event === 'done') {
            reader.cancel();
            setStatus('Ready');
            setPendingSlots(0);
            return;
          }
        }
      }
      setStatus('Ready');
      setPendingSlots(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setFormError(`Unable to generate visuals: ${message}`);
      setStatus('Ready');
      setPendingSlots(0);
    }
  };

  return (
    <div className="panel">
      <header className="panel__header">
        <div className="brand">
          <img className="brand__logo" src="logo.png" alt="ODIN logo" />
          <div>
            <p className="brand__name">ODIN</p>
            <p className="brand__status">Project: {projectName}</p>
          </div>
        </div>
        <button className="ghost-button" type="button">
          {status}
        </button>
      </header>

      <section className="panel__section">
        <p className="panel__eyebrow">Slide</p>
        <div className="upload">
          <div className="upload__preview">
            {slideImage ? (
              <img className="upload__image" src={slideImage} alt="Slide preview" />
            ) : (
              <div className="upload__placeholder">
                {isUploading ? 'Uploading...' : 'Drop slide screenshot'}
              </div>
            )}
          </div>
          <div className="upload__actions">
            <label className="pill pill--file">
              Browse
              <input type="file" accept="image/png,image/png" onChange={handleFileChange} />
            </label>
            <button className="pill pill--ghost" type="button">
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="panel__section">
        <p className="panel__eyebrow">Slide text</p>
        <textarea
          className="input input--area"
          rows={5}
          placeholder="Paste title + bullets..."
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </section>

      <section className="panel__section">
        <p className="panel__eyebrow">Generate</p>
        <div className="row">
          <label className="field">
            Aspect ratio
            <select
              className="input"
              value={aspectRatio}
              onChange={(event) =>
                setAspectRatio(event.target.value as 'square' | 'portrait_9x16' | 'landscape_16x9')
              }
            >
              <option value="square">Square (1:1)</option>
              <option value="portrait_9x16">Portrait (9:16)</option>
              <option value="landscape_16x9">Landscape (16:9)</option>
            </select>
          </label>
          <label className="field">
            Variants
            <select
              className="input"
              value={variantCount}
              onChange={(event) => setVariantCount(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5].map((count) => (
                <option value={count} key={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="cta"
          type="button"
          onClick={handleGenerate}
        >
          Generate visuals
        </button>
        {formError ? (
          <p className="panel__error">{formError}</p>
        ) : (
        <p className="panel__subtext">API: {apiBaseUrl}</p>
        )}
      </section>

      <section className="panel__section panel__section--results">
        <div className="results__header">
          <div>
            <p className="panel__eyebrow">Results</p>
            <p className="panel__subtext">Latest visuals appear here.</p>
          </div>
          <button className="ghost-button" type="button">
            Clear
          </button>
        </div>
        <div className="results__grid">
          {Array.from({ length: pendingSlots }).map((_, index) => (
            <div className="result-card" key={`pending-${index}`}>
              <div className="result-card__image result-card__image--loading" />
              <button className="pill" type="button" disabled>
                Loading
              </button>
            </div>
          ))}
          {results.map((result) => (
            <div className="result-card" key={result.id}>
              <img className="result-card__image" src={result.imageUrl} alt={result.description} />
              <button
                className="pill"
                type="button"
                onClick={() => handleCopy(result.id, result.imageUrl)}
              >
                {copiedId === result.id ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
