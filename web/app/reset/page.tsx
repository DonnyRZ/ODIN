'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

type ResetState = 'idle' | 'loading' | 'success' | 'error';

function ResetPageContent() {
  const [password, setPassword] = useState('');
  const [state, setState] = useState<ResetState>('idle');
  const [message, setMessage] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    if (!token) {
      setState('error');
      setMessage('Reset token missing.');
      return;
    }

    setState('loading');
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
    });

    if (!response.ok) {
      const text = await response.text();
      setState('error');
      setMessage(text || 'Unable to reset password.');
      return;
    }

    setState('success');
    setMessage('Password updated. You can now log in.');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10 text-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter a new password for your ODIN account.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-gray-700" htmlFor="new-password">
            New password
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
            />
          </label>
          {message && (
            <p
              className={`text-xs font-semibold ${
                state === 'success' ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={state === 'loading'}
            className="w-full rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {state === 'loading' ? 'Updating...' : 'Update password'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => router.push('/login' as Route)}
          className="mt-4 w-full rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700 hover:border-gray-300"
        >
          Back to login
        </button>
      </div>
    </main>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ResetPageContent />
    </Suspense>
  );
}
