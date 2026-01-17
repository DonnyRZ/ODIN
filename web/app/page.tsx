'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import {
  clearAuthToken,
  getAuthToken,
  setActiveProjectId,
  setAuthProfile,
  setAuthToken,
} from '@/lib/workspace-storage';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

type ProjectSummary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  generation_count: number;
};


const steps: Array<[string, string]> = [
  ['Drop a slide', "Upload a PNG/JPG of the slide you're editing - ODIN ingests it instantly."],
  ['Choose the aspect ratio', 'Pick square, 9:16, or 16:9 so ODIN matches your slide layout.'],
  ['Describe the slide', 'Paste the title/body copy so ODIN captures the intent and language.'],
  ['Paste the result', 'Pick your favorite visual, copy to clipboard, and drop it straight into your PPT.']
];

function HomePageContent() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const nextRedirect = nextParam && nextParam.startsWith('/') ? nextParam : null;

  useEffect(() => {
    const storedToken = getAuthToken();
    setAuthTokenState(storedToken);
    if (!storedToken) {
      setIsAuthOpen(true);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('auth') === '1') {
      setIsAuthOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authToken) {
      setProjects([]);
      return;
    }
    const loadProjects = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { projects: ProjectSummary[] };
        setProjects(payload.projects.slice(0, 6));
      } catch {
        // Ignore failures and keep the empty state.
      }
    };

    loadProjects();
  }, [authToken]);

  const handleLogout = () => {
    clearAuthToken();
    setAuthTokenState(null);
    setIsAuthOpen(true);
  };

  const readErrorMessage = async (response: Response) => {
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) {
        return payload.detail;
      }
    } catch {
      // Fall back to plain text.
    }
    return (await response.text()) || 'Unable to authenticate.';
  };

  const handleAuthSubmit = async () => {
    setAuthError(null);
    setAuthNotice(null);
    let endpoint = 'login';
    const body: Record<string, string> = {};

    if (authMode === 'register') {
      endpoint = 'register';
      body.email = email;
      body.username = username;
      body.password = password;
    } else if (authMode === 'forgot') {
      endpoint = 'forgot-password';
      body.email = email;
    } else {
      endpoint = 'login';
      body.email = email;
      body.password = password;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await readErrorMessage(response);
        setAuthError(text);
      return;
    }

      if (authMode === 'login') {
        const payload = (await response.json()) as {
          token: string;
          email: string;
          username?: string;
          user_id?: string;
        };
        setAuthToken(payload.token);
        setAuthProfile({
          email: payload.email,
          username: payload.username,
          userId: payload.user_id,
        });
        setAuthTokenState(payload.token);
        setIsAuthOpen(false);
        setPassword('');
        if (nextRedirect) {
          router.push(nextRedirect as Route);
        }
        return;
      }

    if (authMode === 'register') {
      setAuthNotice('Welcome to ODIN! Check your inbox for a welcome email.');
      setAuthMode('login');
      setPassword('');
      return;
      }

      setAuthNotice('If an account exists, a reset email has been sent.');
      setAuthMode('login');
    } catch {
      setAuthError('Unable to reach the server. Check API base URL and backend status.');
    }
  };

  const handleCreateProject = async () => {
    if (!authToken) {
      setAuthMode('login');
      setAuthError(null);
      setAuthNotice(null);
      setIsAuthOpen(true);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: `Project - ${new Date().toLocaleDateString()}`,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create project');
      }
      const payload = (await response.json()) as { id: string };
      setActiveProjectId(payload.id);
      router.push(`/workspace?project=${payload.id}`);
    } catch {
      router.push('/workspace');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex w-full items-center justify-between px-8 py-1">
          <div className="flex items-center gap-3 font-semibold tracking-wide text-gray-900">
            <Image src="/logo.png" width={70} height={70} alt="ODIN logo" priority className="odin-logo-spin" />
            <span>ODIN</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            {authToken ? (
              <>
                <span className="hidden md:inline">Signed in</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700 hover:border-gray-300"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                  setAuthNotice(null);
                  setIsAuthOpen(true);
                }}
                className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700 hover:border-gray-300"
              >
                Log in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="space-y-16 px-8 py-12">
        <section className="text-center">
          <p className="mx-auto inline-flex items-center rounded-md bg-red-50 px-4 py-1 text-sm font-medium text-red-600">
            AI assistant for Figma, Google Slides, & Canva
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold text-gray-900 md:text-5xl">
            Create pixel-perfect slide visuals in seconds
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Upload a slide screenshot, outline the empty space, and ODIN returns three visuals that match your copy, aspect ratio, and palette.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleCreateProject}
              className="rounded-xl bg-red-600 px-8 py-4 text-lg font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-red-700"
            >
              Start new project
            </button>
          </div>
        </section>

        <section aria-labelledby="recent-heading" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500">Recent</p>
              <h2 id="recent-heading" className="text-2xl font-semibold text-gray-900">
                Projects
              </h2>
            </div>
            <span className="text-red-600">View all (coming soon)</span>
          </div>
          {authToken ? (
            projects.length ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <article
                    key={project.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 p-5 transition hover:-translate-y-0.5 hover:border-red-500"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-widest text-gray-400">Recent</p>
                      <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500">
                      Updated {new Date(project.updated_at).toLocaleString()} - {project.generation_count} visuals
                    </p>
                    <Link
                      href={`/workspace?project=${project.id}`}
                      onClick={() => setActiveProjectId(project.id)}
                      className="inline-flex items-center rounded-md bg-red-50 px-4 py-2 text-sm font-semibold text-red-600"
                    >
                      Continue
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-500">
                No recent projects yet. Generate your first visual to see it here.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-500">
              Log in to see your saved projects.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-red-50 p-8" aria-labelledby="how-heading">
          <p className="text-xs uppercase tracking-widest text-gray-500">How it works</p>
          <h2 id="how-heading" className="mt-2 text-2xl font-semibold text-gray-900">
            The 1-minute ODIN flow
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(([title, copy]) => (
              <article key={title} className="rounded-xl border border-gray-200 bg-white p-4 text-left">
                <h3 className="text-lg font-semibold text-red-600">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} ODIN. All rights reserved.
      </footer>
      {isAuthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {authMode === 'register'
                  ? 'Create account'
                  : authMode === 'forgot'
                    ? 'Reset your password'
                    : 'Welcome back'}
              </h2>
              <button
                type="button"
                onClick={() => setIsAuthOpen(false)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700" htmlFor="email">
                Email
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                />
              </label>
              {authMode === 'register' && (
                <label className="block text-sm font-medium text-gray-700" htmlFor="username">
                  Username
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                  />
                </label>
              )}
              {authMode !== 'forgot' && (
                <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                  Password
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                  />
                </label>
              )}
              {authNotice && <p className="text-xs font-semibold text-emerald-600">{authNotice}</p>}
              {authError && <p className="text-xs font-semibold text-red-600">{authError}</p>}
              <button
                type="button"
                onClick={handleAuthSubmit}
                className="w-full rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
              >
                {authMode === 'register'
                  ? 'Sign up'
                  : authMode === 'forgot'
                    ? 'Send reset link'
                    : 'Log in'}
              </button>
            </div>
            <div className="mt-4 text-center text-sm text-gray-500">
              {authMode === 'forgot' ? (
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  Back to login
                </button>
              ) : (
                <>
                  {authMode === 'register' ? 'Already have an account?' : 'New here?'}
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}
                    className="ml-2 text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    {authMode === 'register' ? 'Log in' : 'Sign up'}
                  </button>
                </>
              )}
            </div>
            {authMode === 'login' && (
              <div className="mt-3 text-center text-xs text-gray-500">
                <button
                  type="button"
                  onClick={() => setAuthMode('forgot')}
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <HomePageContent />
    </Suspense>
  );
}
