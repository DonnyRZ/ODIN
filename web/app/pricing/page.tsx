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

function PricingPageContent() {
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

  useEffect(() => {
    if (authToken && nextRedirect) {
      router.push(nextRedirect as Route);
    }
  }, [authToken, nextRedirect, router]);

  const resolvePlanHref = (planId: string) => {
    if (authToken) {
      return `/checkout?plan=${planId}`;
    }
    const nextPath = `/checkout?plan=${planId}`;
    return `/login?next=${encodeURIComponent(nextPath)}`;
  };

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
        if (nextRedirect) {
          router.push(nextRedirect as Route);
        }
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
            {authToken ? (
              <>
                <span className="nav-user">{authProfile?.email ?? 'Akun aktif'}</span>
                <button className="nav-link" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <Link className="nav-link" href="/login">
                Login
              </Link>
            )}
          </div>
        </div>

        <section className="hero">
          <h1>Pilih plan yang paling pas untuk workflow slide Anda.</h1>
          <p>Mulai dari yang sederhana, lalu naikkan limit harian dan kecepatan generate saat tim Anda berkembang.</p>
        </section>

        <section className="pricing-grid">
          <article className="plan-card">
            <h2 className="plan-title">Starter</h2>
            <p className="plan-price">
              Rp89.000 <span>/ bulan</span>
            </p>
            <p className="plan-desc">Cocok untuk proyek personal ringan dan pekerjaan bersih-bersih cepat.</p>
            <Link className="cta-btn cta-btn--ghost" href={resolvePlanHref('starter') as Route}>
              Pilih paket
            </Link>
            <ul className="feature-list">
              <li>Background Remover: 3x per day</li>
              <li>Visual generation: 15 images per day</li>
              <li>3 active projects at a time</li>
              <li>Save and reuse prompts</li>
              <li>Side panel extension access</li>
            </ul>
            <p className="plan-meta">Best for solo creators getting started.</p>
          </article>

          <article className="plan-card plan-card--featured">
            <h2 className="plan-title">Pro</h2>
            <p className="plan-price">
              Rp199.000 <span>/ bulan</span>
            </p>
            <p className="plan-desc">Untuk pembuat slide yang sering butuh output lebih cepat dan lebih banyak opsi.</p>
            <Link className="cta-btn" href={resolvePlanHref('pro') as Route}>
              Pilih paket
            </Link>
            <ul className="feature-list">
              <li>Everything in Starter</li>
              <li>Background Remover: 15x per day</li>
              <li>Visual generation: 20 images per day</li>
              <li>Up to 3 variants per prompt</li>
              <li>10 active projects at a time</li>
              <li>Priority processing queue</li>
            </ul>
            <p className="plan-meta">Paling populer untuk freelancer dan tim.</p>
          </article>

          <article className="plan-card">
            <h2 className="plan-title">Premium</h2>
            <p className="plan-price">
              Rp359.000 <span>/ bulan</span>
            </p>
            <p className="plan-desc">Untuk workflow produksi berat yang butuh output dan kecepatan lebih tinggi.</p>
            <Link className="cta-btn cta-btn--ghost" href={resolvePlanHref('premium') as Route}>
              Pilih paket
            </Link>
            <ul className="feature-list">
              <li>Everything in Pro</li>
              <li>Background Remover: 40x per day</li>
              <li>Visual generation: 40 images per day</li>
              <li>Up to 5 variants per prompt</li>
              <li>Highest priority queue</li>
            </ul>
            <p className="plan-meta">Terbaik untuk agensi dan tim produksi.</p>
          </article>
        </section>

        <section className="auth-section" id="login">
          <div className="auth-copy">
            <h2>Login cepat (opsional)</h2>
            <p>
              Jika sudah punya akun, Anda bisa login langsung di sini tanpa pindah halaman.
              Jika belum login, klik paket akan membawa Anda ke halaman login khusus.
            </p>
            {nextRedirect ? (
              <p className="auth-next">
                Setelah login, Anda akan diarahkan ke halaman checkout.
              </p>
            ) : null}
          </div>
          <div className="auth-card">
            {authToken ? (
              <div className="auth-signed-in">
                <p className="auth-label">Login sebagai</p>
                <p className="auth-identity">{authProfile?.email ?? 'akun Anda'}</p>
                {nextRedirect ? (
                  <button
                    type="button"
                    className="cta-btn"
                    onClick={() => router.push(nextRedirect as Route)}
                  >
                    Lanjutkan ke checkout
                  </button>
                ) : (
                  <p className="auth-helper">Pilih paket di atas untuk melanjutkan checkout.</p>
                )}
                <button type="button" className="auth-link" onClick={handleLogout}>
                  Logout dan ganti akun
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="auth-form">
                <label htmlFor="pricing-email">
                  Email
                  <input
                    id="pricing-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@perusahaan.com"
                    required
                  />
                </label>
                {authMode === 'register' ? (
                  <label htmlFor="pricing-username">
                    Username
                    <input
                      id="pricing-username"
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Nama pengguna"
                      required
                    />
                  </label>
                ) : null}
                {authMode !== 'forgot' ? (
                  <label htmlFor="pricing-password">
                    Password
                    <input
                      id="pricing-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimal 8 karakter"
                      required
                    />
                  </label>
                ) : null}
                {authNotice ? <p className="auth-note">{authNotice}</p> : null}
                {authError ? <p className="auth-error">{authError}</p> : null}
                <button type="submit" className="cta-btn" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Memproses...'
                    : authMode === 'register'
                      ? 'Daftar akun'
                      : authMode === 'forgot'
                        ? 'Kirim reset password'
                        : 'Login'}
                </button>
                <div className="auth-switch">
                  {authMode === 'forgot' ? (
                    <button type="button" className="auth-link" onClick={() => switchAuthMode('login')}>
                      Kembali ke login
                    </button>
                  ) : (
                    <>
                      <span>
                        {authMode === 'register' ? 'Sudah punya akun?' : 'Belum punya akun?'}
                      </span>
                      <button
                        type="button"
                        className="auth-link"
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
                  <button type="button" className="auth-link" onClick={() => switchAuthMode('forgot')}>
                    Lupa password?
                  </button>
                ) : null}
              </form>
            )}
          </div>
        </section>

        <footer className="pricing-footer">
          <div className="pricing-footer-inner">
            <p>Butuh bantuan? Hubungi donnyrp@odinlabs.id atau 082120998792.</p>
            <div className="pricing-footer-links">
              <Link href="/terms">Syarat dan Ketentuan</Link>
              <Link href="/refund">Kebijakan Refund</Link>
              <Link href="/contact">Kontak</Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <PricingPageContent />
    </Suspense>
  );
}
