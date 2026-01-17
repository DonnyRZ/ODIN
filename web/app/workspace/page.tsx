'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { getAuthToken } from '@/lib/workspace-storage';
import { ControlPanel } from './components/control-panel';
import { WorkspaceHeader } from './components/workspace-header';
import { WorkspaceSlidePreview } from './components/workspace-slide-preview';
import { GeneratedResultsSection } from './components/generated-results-section';
import { WorkspaceProjectProvider } from './hooks/use-workspace-project';

export default function WorkspacePage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/login?next=/workspace' as Route);
      return;
    }
    setIsCheckingAuth(false);
  }, [router]);

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500">
        Redirecting to login...
      </div>
    );
  }

  return (
    <WorkspaceProjectProvider>
      <div className="h-screen bg-white text-gray-900">
        <div className="flex h-screen flex-col overflow-hidden">
          <WorkspaceHeader />
          <div className="flex flex-1 overflow-hidden">
            <div className="flex h-full w-[360px] min-h-0 flex-col overflow-y-auto border-r border-gray-200 bg-white">
              <ControlPanel />
            </div>
            <main className="flex-1 overflow-y-auto bg-white">
              <section className="border-b border-gray-200 px-10 py-8">
              <div className="mx-auto max-w-4xl">
                <header className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Slide preview</p>
                    <p className="text-sm text-gray-500">16:9 canvas preview of your uploaded slide</p>
                  </div>
                  <div className="flex items-center gap-2" />
                </header>
                <WorkspaceSlidePreview />
              </div>
            </section>
              <GeneratedResultsSection />
            </main>
          </div>
        </div>
      </div>
    </WorkspaceProjectProvider>
  );
}
