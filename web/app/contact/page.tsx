import Link from 'next/link';
import '../legal/legal.css';

export default function ContactPage() {
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
          <h1 className="title">Kontak ODIN Labs</h1>
          <p className="subtitle">
            Kami siap membantu kebutuhan Anda terkait ODIN. Silakan hubungi melalui kontak resmi di bawah ini.
          </p>

          <div className="section">
            <h2>Email</h2>
            <p>donnyrp@odinlabs.id</p>
          </div>

          <div className="section">
            <h2>Telepon / WhatsApp</h2>
            <p>082120998792</p>
          </div>

          <div className="section">
            <h2>Alamat</h2>
            <p>Tanah Kusir, Jakarta Selatan</p>
          </div>

          <div className="section">
            <h2>Jam operasional</h2>
            <p>Senin - Jumat, 09:00 - 18:00 WIB</p>
          </div>
        </section>

        <footer className="footer">
          <div className="footer-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/terms">Syarat dan Ketentuan</Link>
            <Link href="/refund">Kebijakan Refund</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
