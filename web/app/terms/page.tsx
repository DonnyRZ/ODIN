import Link from 'next/link';
import '../legal/legal.css';

export default function TermsPage() {
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
          <h1 className="title">Syarat dan Ketentuan ODIN</h1>
          <p className="subtitle">
            Dokumen ini menjelaskan syarat penggunaan layanan ODIN Labs. Dengan menggunakan layanan ini, Anda dianggap
            menyetujui ketentuan berikut.
          </p>

          <div className="section">
            <h2>1. Deskripsi layanan</h2>
            <p>
              ODIN adalah layanan yang membantu membuat visual untuk slide presentasi berdasarkan konteks slide Anda.
              Layanan tersedia melalui web app dan side panel pada editor desain yang didukung.
            </p>
          </div>

          <div className="section">
            <h2>2. Akun dan penggunaan</h2>
            <ul>
              <li>Anda bertanggung jawab atas informasi yang Anda masukkan dan menjaga keamanan akun Anda.</li>
              <li>Dilarang menggunakan layanan untuk konten ilegal, berbahaya, atau melanggar hak pihak lain.</li>
            </ul>
          </div>

          <div className="section">
            <h2>3. Pembayaran dan langganan</h2>
            <ul>
              <li>Harga layanan dinyatakan dalam Rupiah (IDR) dan dapat berubah sewaktu-waktu.</li>
              <li>Pembayaran akan diproses melalui payment gateway setelah aktivasi layanan selesai.</li>
              <li>Langganan berlaku sesuai paket yang dipilih dan diaktifkan setelah pembayaran terkonfirmasi.</li>
            </ul>
          </div>

          <div className="section">
            <h2>4. Hak kekayaan intelektual</h2>
            <p>
              Seluruh merek, logo, dan materi promosi ODIN merupakan milik ODIN Labs. Visual yang dihasilkan dapat
              digunakan untuk kebutuhan Anda sesuai paket yang dibeli.
            </p>
          </div>

          <div className="section">
            <h2>5. Batasan tanggung jawab</h2>
            <p>
              ODIN Labs tidak bertanggung jawab atas kerugian tidak langsung yang timbul dari penggunaan layanan,
              termasuk gangguan bisnis atau kehilangan data akibat faktor di luar kendali kami.
            </p>
          </div>

          <div className="section">
            <h2>6. Perubahan layanan</h2>
            <p>
              ODIN Labs dapat memperbarui fitur atau kebijakan kapan saja. Perubahan penting akan diinformasikan melalui
              situs atau email resmi.
            </p>
          </div>

          <div className="section">
            <h2>7. Kontak</h2>
            <p>Hubungi kami di donnyrp@odinlabs.id atau 082120998792 untuk pertanyaan lebih lanjut.</p>
          </div>

          <p className="subtitle">Terakhir diperbarui: Januari 2026.</p>
        </section>

        <footer className="footer">
          <div className="footer-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/refund">Kebijakan Refund</Link>
            <Link href="/contact">Kontak</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
