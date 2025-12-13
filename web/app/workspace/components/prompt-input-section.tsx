'use client';

import { ChangeEvent, useState } from 'react';
import { useWorkspaceProject } from '../hooks/use-workspace-project';

export function PromptInputSection() {
  const { project, updatePrompt } = useWorkspaceProject();
  const [localPrompt, setLocalPrompt] = useState(project.prompt ?? '');

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setLocalPrompt(value);
    updatePrompt(value);
  };

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
          value={localPrompt}
          onChange={handleChange}
          rows={6}
          className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
        />
        <footer className="text-xs text-gray-500">
          <p>Optional but highly recommended for precise visuals.</p>
        </footer>
      </div>
    </section>
  );
}
