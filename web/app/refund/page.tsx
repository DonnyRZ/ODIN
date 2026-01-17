import Link from 'next/link';
import '../legal/legal.css';

export default function RefundPage() {
  return (
    <main className="legal-page page">
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
          <h1 className="title">Kebijakan Refund ODIN</h1>
          <p className="subtitle">
            Kebijakan ini menjelaskan ketentuan pengembalian dana untuk layanan ODIN Labs. Kami berkomitmen menjaga
            transparansi dan kenyamanan pelanggan.
          </p>

          <div className="section">
            <h2>1. Masa pengajuan refund</h2>
            <p>Permohonan refund dapat diajukan maksimal 7 hari sejak pembayaran berhasil.</p>
          </div>

          <div className="section">
            <h2>2. Syarat refund</h2>
            <ul>
              <li>Refund tersedia jika layanan belum digunakan atau terjadi kendala teknis signifikan.</li>
              <li>Permohonan refund diproses setelah verifikasi aktivitas penggunaan akun.</li>
              <li>Biaya transaksi pihak ketiga dapat mempengaruhi nilai refund yang diterima.</li>
            </ul>
          </div>

          <div className="section">
            <h2>3. Proses refund</h2>
            <ul>
              <li>Ajukan refund melalui email donnyrp@odinlabs.id dengan subjek "Refund ODIN".</li>
              <li>Tim kami akan merespons dalam 1-3 hari kerja.</li>
              <li>Pengembalian dana diproses maksimal 7-14 hari kerja setelah disetujui.</li>
            </ul>
          </div>

          <div className="section">
            <h2>4. Kontak</h2>
            <p>Untuk pertanyaan terkait refund, hubungi donnyrp@odinlabs.id atau 082120998792.</p>
          </div>

          <p className="subtitle">Terakhir diperbarui: Januari 2026.</p>
        </section>

        <footer className="footer">
          <div className="footer-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/terms">Syarat dan Ketentuan</Link>
            <Link href="/contact">Kontak</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
