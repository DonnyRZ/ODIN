'use client';

import Link from 'next/link';
import { Suspense, type FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import {
  clearAuthToken,
  getAuthProfile,
  getAuthToken,
  setAuthProfile,
  setAuthToken,
  type AuthProfile,
} from '@/lib/workspace-storage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

type AuthMode = 'login' | 'register' | 'forgot';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [authProfile, setAuthProfileState] = useState<AuthProfile | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextParam = searchParams.get('next');
  const nextRedirect = nextParam && nextParam.startsWith('/') ? nextParam : null;

  useEffect(() => {
    const token = getAuthToken();
    const profile = getAuthProfile();
    setAuthTokenState(token);
    setAuthProfileState(profile);
    if (profile?.email) {
      setEmail(profile.email);
    }
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    setAuthTokenState(null);
    setAuthProfileState(null);
    setAuthError(null);
    setAuthNotice(null);
    setPassword('');
  };

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthNotice(null);
    if (mode !== 'login') {
      setPassword('');
    }
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

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
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
        setAuthProfileState({
          email: payload.email,
          username: payload.username,
          userId: payload.user_id,
        });
        setPassword('');
        router.push((nextRedirect ?? '/pricing') as Route);
        return;
      }

      if (authMode === 'register') {
        setAuthNotice('Akun berhasil dibuat. Silakan login untuk lanjut.');
        setAuthMode('login');
        setPassword('');
        return;
      }

      setAuthNotice('Jika akun terdaftar, link reset sudah dikirim ke email Anda.');
      setAuthMode('login');
    } catch {
      setAuthError('Tidak bisa menghubungi server. Coba lagi sebentar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page">
      <div className="container">
        <div className="nav">
          <div className="brand">
            <div className="brand-mark">
              <img src="/logo.png" alt="ODIN logo" />
            </div>
            <span>ODIN</span>
          </div>
          <div className="nav-actions">
            <Link className="nav-link" href="/home">
              Kembali ke overview
            </Link>
            <Link className="nav-link" href="/pricing">
              Pricing
            </Link>
          </div>
        </div>

        <section className="login-grid">
          <div className="login-copy">
            <h1>Login untuk lanjut checkout</h1>
            <p>
              Checkout membutuhkan akun agar status pembayaran dan paket Anda tercatat otomatis. Login
              atau buat akun baru sebelum melanjutkan pembayaran.
            </p>
            {nextRedirect ? (
              <div className="login-next">
                Setelah login, Anda akan diarahkan ke checkout.
              </div>
            ) : null}
            <div className="login-hint">
              <span>Butuh bantuan?</span> Hubungi donnyrp@odinlabs.id atau 082120998792.
            </div>
          </div>

          <div className="login-card">
            {authToken ? (
              <div className="login-signed">
                <p className="login-label">Sudah login sebagai</p>
                <p className="login-identity">{authProfile?.email ?? 'akun Anda'}</p>
                <button
                  type="button"
                  className="cta-btn"
                  onClick={() => router.push((nextRedirect ?? '/pricing') as Route)}
                >
                  {nextRedirect ? 'Lanjutkan ke checkout' : 'Kembali ke pricing'}
                </button>
                <button type="button" className="login-link" onClick={handleLogout}>
                  Logout dan ganti akun
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="login-form">
                <label htmlFor="login-email">
                  Email
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@perusahaan.com"
                    required
                  />
                </label>
                {authMode === 'register' ? (
                  <label htmlFor="login-username">
                    Username
                    <input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Nama pengguna"
                      required
                    />
                  </label>
                ) : null}
                {authMode !== 'forgot' ? (
                  <label htmlFor="login-password">
                    Password
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimal 8 karakter"
                      required
                    />
                  </label>
                ) : null}
                {authNotice ? <p className="login-note">{authNotice}</p> : null}
                {authError ? <p className="login-error">{authError}</p> : null}
                <button type="submit" className="cta-btn" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Memproses...'
                    : authMode === 'register'
                      ? 'Daftar akun'
                      : authMode === 'forgot'
                        ? 'Kirim reset password'
                        : 'Login'}
                </button>
                <div className="login-switch">
                  {authMode === 'forgot' ? (
                    <button type="button" className="login-link" onClick={() => switchAuthMode('login')}>
                      Kembali ke login
                    </button>
                  ) : (
                    <>
                      <span>
                        {authMode === 'register' ? 'Sudah punya akun?' : 'Belum punya akun?'}
                      </span>
                      <button
                        type="button"
                        className="login-link"
                        onClick={() =>
                          switchAuthMode(authMode === 'register' ? 'login' : 'register')
                        }
                      >
                        {authMode === 'register' ? 'Login' : 'Daftar'}
                      </button>
                    </>
                  )}
                </div>
                {authMode === 'login' ? (
                  <button type="button" className="login-link" onClick={() => switchAuthMode('forgot')}>
                    Lupa password?
                  </button>
                ) : null}
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginPageContent />
    </Suspense>
  );
}
