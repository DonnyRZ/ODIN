'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuthToken } from '@/lib/workspace-storage';

type PaymentStatus = {
  order_id: string;
  status: string;
  transaction_status?: string | null;
  fraud_status?: string | null;
  status_code?: string | null;
  gross_amount?: number | null;
  currency?: string | null;
  updated_at?: string | null;
};

type StatusCopy = {
  title: string;
  helper: string;
  pill: string;
};

const STATUS_COPY: Record<string, StatusCopy> = {
  paid: {
    title: 'Pembayaran berhasil',
    helper: 'Pembayaran telah diterima. Tim kami akan memproses akses Anda.',
    pill: 'Berhasil',
  },
  pending: {
    title: 'Menunggu pembayaran',
    helper: 'Pembayaran belum selesai. Silakan lanjutkan sesuai instruksi Midtrans.',
    pill: 'Pending',
  },
  failed: {
    title: 'Pembayaran gagal',
    helper: 'Pembayaran tidak berhasil atau dibatalkan. Silakan coba ulang.',
    pill: 'Gagal',
  },
  refunded: {
    title: 'Pembayaran direfund',
    helper: 'Transaksi ini sudah direfund. Jika ada pertanyaan, hubungi tim kami.',
    pill: 'Refund',
  },
  unknown: {
    title: 'Status pembayaran belum tersedia',
    helper: 'Kami belum menerima status final. Silakan cek kembali beberapa saat lagi.',
    pill: 'Diproses',
  },
};

const formatOptional = (value?: string | null) => {
  if (!value) {
    return 'N/A';
  }
  return value;
};

const formatTimestamp = (value?: string | null) => {
  if (!value) {
    return 'N/A';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatIdr = (value: number) => `Rp${value.toLocaleString('id-ID')}`;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

export default function PaymentStatusClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id') ?? '';
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(0);

  const mappedStatus = useMemo(() => {
    const key = (status?.status ?? 'unknown').toLowerCase();
    if (key in STATUS_COPY) {
      return key;
    }
    return 'unknown';
  }, [status?.status]);

  const copy = STATUS_COPY[mappedStatus];

  useEffect(() => {
    if (!orderId) {
      setError('Order ID tidak ditemukan.');
      return;
    }
    const authToken = getAuthToken();
    if (!authToken) {
      setError('Silakan login terlebih dahulu untuk melihat status pembayaran.');
      return;
    }
    let isMounted = true;
    setLoading(true);
    fetch(`${API_BASE_URL}/payments/midtrans/status?order_id=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.detail ?? 'Gagal mengambil status pembayaran.');
        }
        if (isMounted) {
          setStatus(data);
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (mappedStatus !== 'paid') {
      setRedirectCountdown(0);
      return;
    }
    setRedirectCountdown(3);
    const timer = window.setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = '/workspace';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mappedStatus]);

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
          <Link className="nav-link" href="/home">
            Kembali ke home
          </Link>
        </div>

        <section className="card">
          <span className="status-pill" data-status={mappedStatus}>
            {copy.pill}
          </span>
          <h1 className="headline">{copy.title}</h1>
          <p className="helper">{copy.helper}</p>

          {loading ? <p className="helper">Memuat status terbaru...</p> : null}
          {error ? <p className="helper">{error}</p> : null}

          {status ? (
            <div className="summary">
              <div>
                <strong>Order ID:</strong> {status.order_id}
              </div>
              {status.gross_amount ? (
                <div>
                  <strong>Total:</strong> {formatIdr(status.gross_amount)}
                </div>
              ) : null}
              <div>
                <strong>Status transaksi:</strong> {formatOptional(status.transaction_status)}
              </div>
              <div>
                <strong>Fraud status:</strong> {formatOptional(status.fraud_status)}
              </div>
              <div>
                <strong>Updated:</strong> {formatTimestamp(status.updated_at)}
              </div>
            </div>
          ) : null}

          <div className="cta-row">
            {mappedStatus === 'paid' ? (
              <Link className="btn" href="/workspace">
                Buka workspace
              </Link>
            ) : null}
            <Link className="btn" href="/pricing">
              Lihat pricing
            </Link>
            <Link className="btn secondary" href="/contact">
              Hubungi kami
            </Link>
          </div>
          {mappedStatus === 'paid' && redirectCountdown > 0 ? (
            <p className="helper">
              Anda akan dialihkan ke workspace dalam {redirectCountdown} detik.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
