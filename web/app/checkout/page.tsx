'use client';

import Link from 'next/link';
import Script from 'next/script';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { getAuthProfile, getAuthToken, type AuthProfile } from '@/lib/workspace-storage';

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: Record<string, unknown>) => void;
    };
  }
}

type Plan = {
  id: 'starter' | 'pro' | 'premium';
  name: string;
  price: number;
  description: string;
  features: string[];
};

type Confirmation = {
  id: string;
  planName: string;
  amount: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    company?: string;
  };
  createdAt: string;
};

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 89000,
    description: 'Cocok untuk proyek personal ringan dan pekerjaan bersih-bersih cepat.',
    features: [
      'Background Remover: 3x per day',
      'Visual generation: 15 images per day',
      '3 active projects at a time',
      'Save and reuse prompts',
      'Side panel extension access',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199000,
    description: 'Untuk pembuat slide yang sering butuh output lebih cepat dan lebih banyak opsi.',
    features: [
      'Everything in Starter',
      'Background Remover: 15x per day',
      'Visual generation: 20 images per day',
      'Up to 3 variants per prompt',
      '10 active projects at a time',
      'Priority processing queue',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 359000,
    description: 'Untuk workflow produksi berat yang butuh output dan kecepatan lebih tinggi.',
    features: [
      'Everything in Pro',
      'Background Remover: 40x per day',
      'Visual generation: 40 images per day',
      'Up to 5 variants per prompt',
      'Highest priority queue',
    ],
  },
];

const formatIdr = (value: number) => `Rp${value.toLocaleString('id-ID')}`;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

function CheckoutPageContent() {
  const midtransClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '';
  const snapScriptUrl = 'https://app.sandbox.midtrans.com/snap/snap.js';
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get('plan');
  const defaultPlanId = plans.some((plan) => plan.id === planParam) ? (planParam as Plan['id']) : 'pro';
  const [selectedPlanId, setSelectedPlanId] = useState<Plan['id']>(defaultPlanId);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [agree, setAgree] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snapReady, setSnapReady] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [authProfile, setAuthProfileState] = useState<AuthProfile | null>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? plans[1],
    [selectedPlanId],
  );
  const checkoutPath = useMemo(() => {
    if (planParam && plans.some((plan) => plan.id === planParam)) {
      return `/checkout?plan=${planParam}`;
    }
    return '/checkout';
  }, [planParam]);
  const authMissing = hasCheckedAuth && !authToken;

  useEffect(() => {
    const token = getAuthToken();
    const profile = getAuthProfile();
    setAuthTokenState(token);
    setAuthProfileState(profile);
    if (profile?.email) {
      setEmail(profile.email);
    }
    setHasCheckedAuth(true);
  }, []);

  useEffect(() => {
    if (window.snap?.pay) {
      setSnapReady(true);
    }
  }, []);

  useEffect(() => {
    if (hasCheckedAuth && !authToken) {
      router.replace(`/login?next=${encodeURIComponent(checkoutPath)}` as Route);
    }
  }, [authToken, checkoutPath, hasCheckedAuth, router]);

  const handleLoginRedirect = () => {
    router.push(`/login?next=${encodeURIComponent(checkoutPath)}` as Route);
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    if (!authToken) {
      setFormError('Silakan login terlebih dahulu untuk melanjutkan pembayaran.');
      return;
    }
    const resolvedEmail = (authProfile?.email ?? email).trim();
    if (!fullName.trim() || !resolvedEmail || !phone.trim()) {
      setFormError('Mohon lengkapi nama, email, dan nomor telepon.');
      return;
    }
    if (!agree) {
      setFormError('Mohon setujui Syarat dan Ketentuan serta Kebijakan Refund.');
      return;
    }
    if (!midtransClientKey) {
      setFormError('Midtrans client key belum diatur. Hubungi admin untuk melanjutkan.');
      return;
    }
    const snap = window.snap;
    if (!snap) {
      setFormError('Snap belum siap. Silakan coba lagi dalam beberapa detik.');
      return;
    }
    if (!snapReady) {
      setSnapReady(true);
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      plan_id: selectedPlan.id,
      name: fullName.trim(),
      email: resolvedEmail,
      phone: phone.trim(),
      company: company.trim() || undefined,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/payments/midtrans/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(data?.detail ?? 'Gagal memulai pembayaran. Coba lagi sebentar.');
        return;
      }
      const orderId = data?.order_id as string | undefined;
      const token = data?.token as string | undefined;
      if (!orderId || !token) {
        setFormError('Response Midtrans tidak lengkap. Silakan coba lagi.');
        return;
      }

      setConfirmation({
        id: orderId,
        planName: selectedPlan.name,
        amount: selectedPlan.price,
        customer: {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          company: payload.company,
        },
        createdAt: new Date().toISOString(),
      });

      snap.pay(token, {
        onSuccess: () => {
          window.location.href = `/payment/finish?order_id=${encodeURIComponent(orderId)}`;
        },
        onPending: () => {
          window.location.href = `/payment/unfinish?order_id=${encodeURIComponent(orderId)}`;
        },
        onError: () => {
          window.location.href = `/payment/error?order_id=${encodeURIComponent(orderId)}`;
        },
        onClose: () => {
          setFormError('Pembayaran ditutup sebelum selesai. Silakan coba lagi.');
        },
      });
    } catch (error) {
      setFormError('Tidak dapat menghubungi server pembayaran. Coba lagi sebentar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page">
      {midtransClientKey ? (
        <Script
          src={snapScriptUrl}
          data-client-key={midtransClientKey}
          strategy="afterInteractive"
          onLoad={() => setSnapReady(true)}
        />
      ) : null}
      <div className="container">
        <div className="nav">
          <div className="brand">
            <div className="brand-mark">
              <img src="/logo.png" alt="ODIN logo" />
            </div>
            <span>ODIN</span>
          </div>
          <Link className="nav-link" href="/pricing">
            Kembali ke pricing
          </Link>
        </div>

        <section className="hero">
          <h1>Checkout ODIN</h1>
          <p>
            Lengkapi detail pemesanan di bawah ini. Pembayaran dilakukan via Midtrans (sandbox).
          </p>
        </section>

        <section className="checkout-grid">
          <div className="card">
            <div className="form-grid">
              {authMissing ? (
                <div className="auth-gate">
                  <p>Untuk lanjut ke pembayaran, silakan login dulu.</p>
                  <button className="cta-btn" type="button" onClick={handleLoginRedirect}>
                    Login
                  </button>
                </div>
              ) : null}
              <div>
                <p className="summary-title">Pilih paket</p>
                <p className="summary-meta">Anda bisa ganti paket langsung di halaman ini.</p>
                <div className="plan-options">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className="plan-option"
                      data-active={selectedPlanId === plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <span className="plan-option-title">{plan.name}</span>
                      <span className="plan-option-price">{formatIdr(plan.price)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label htmlFor="full-name">
                Nama lengkap
                <input
                  id="full-name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nama sesuai invoice"
                />
              </label>

              <label htmlFor="email">
                Email (akun login)
                <input
                  id="email"
                  type="email"
                  value={email}
                  readOnly={!!authProfile?.email}
                  data-locked={!!authProfile?.email}
                  onChange={(event) => {
                    if (!authProfile?.email) {
                      setEmail(event.target.value);
                    }
                  }}
                  placeholder="email@perusahaan.com"
                />
              </label>

              <label htmlFor="phone">
                Nomor telepon / WhatsApp
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </label>

              <label htmlFor="company">
                Nama perusahaan (opsional)
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Nama perusahaan"
                />
              </label>

              <label className="legal-check" htmlFor="agree">
                <input
                  id="agree"
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                />
                <span>
                  Saya setuju dengan{' '}
                  <Link href="/terms">Syarat dan Ketentuan</Link> serta{' '}
                  <Link href="/refund">Kebijakan Refund</Link>.
                </span>
              </label>

              {formError ? <p className="form-error">{formError}</p> : null}

              <button
                className="cta-btn"
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || authMissing}
              >
                {isSubmitting ? 'Memproses...' : 'Lanjut ke pembayaran'}
              </button>
              <p className="cta-footnote">
                Transaksi ini menggunakan sandbox Midtrans untuk uji coba. Status final diverifikasi lewat sistem.
              </p>

              {confirmation ? (
                <div className="confirmation">
                  <h3>Konfirmasi pesanan</h3>
                  <p>
                    Pesanan Anda sudah tercatat. Selesaikan pembayaran lewat popup Midtrans.
                  </p>
                  <ul>
                    <li>Order ID: {confirmation.id}</li>
                    <li>Paket: {confirmation.planName}</li>
                    <li>Total: {formatIdr(confirmation.amount)}</li>
                    <li>Email: {confirmation.customer.email}</li>
                    <li>Telepon: {confirmation.customer.phone}</li>
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="card">
            <h2 className="summary-title">Ringkasan pesanan</h2>
            <p className="summary-meta">{selectedPlan.description}</p>
            <ul className="summary-list">
              {selectedPlan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <div className="summary-total">
              <span>Total</span>
              <span>{formatIdr(selectedPlan.price)}</span>
            </div>
            <p className="summary-meta">
              Harga sudah termasuk akses web app dan side panel extension sesuai paket.
            </p>
          </aside>
        </section>

        <footer className="footer">
          <div>Butuh bantuan? Hubungi kami di donnyrp@odinlabs.id atau 082120998792.</div>
          <div className="footer-links">
            <Link href="/terms">Syarat dan Ketentuan</Link>
            <Link href="/refund">Kebijakan Refund</Link>
            <Link href="/contact">Kontak</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="checkout-page" />}>
      <CheckoutPageContent />
    </Suspense>
  );
}
