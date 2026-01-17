'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import { clearAuthToken, getAuthToken } from '@/lib/workspace-storage';

const logoSources = ['/logo.png', '/logo.jpg', '/logo.jpeg', '/logo.webp', '/logo.svg'];
const swatches = [
  { color: '#ffffff', label: 'White background' },
  { color: '#0f172a', label: 'Black background' },
  { color: '#2563eb', label: 'Blue background' },
  { color: '#c1121f', label: 'Red background' },
  { color: '#7c3aed', label: 'Purple background' },
];
function OnboardingPageContent() {
  const [logoIndex, setLogoIndex] = useState(0);
  const [bgColor, setBgColor] = useState(swatches[0].color);
  const [authToken, setAuthTokenState] = useState<string | null>(null);

  const logoSrc = logoSources[Math.min(logoIndex, logoSources.length - 1)];
  const handleLogoError = () => {
    setLogoIndex((prev) => (prev + 1 < logoSources.length ? prev + 1 : prev));
  };

  useEffect(() => {
    const storedToken = getAuthToken();
    setAuthTokenState(storedToken);
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    setAuthTokenState(null);
  };

  return (
    <div>
      <section className="hero">
        <div className="mosaic" aria-hidden="true"></div>
        <div className="hero-nav">
          <div className="brand">
            <div className="brand-mark">
              <img src={logoSrc} alt="ODIN logo" onError={handleLogoError} />
            </div>
            <div className="brand-text">ODIN</div>
          </div>
          <nav className="menu">
            <Link href="/pricing">Pricing</Link>
            <Link href="/terms">Syarat dan Ketentuan</Link>
            <Link href="/refund">Kebijakan Refund</Link>
            <Link href="/home#faq">FAQ</Link>
            <Link className="menu-link" href="/contact">
              Contact
            </Link>
            {authToken ? (
              <button className="menu-link" type="button" onClick={handleLogout}>
                Logout
              </button>
            ) : (
              <Link className="menu-link" href="/login">
                Login
              </Link>
            )}
          </nav>
        </div>
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="badge">AI Slide Assistant</div>
            <h1 className="hook">
              <span>Berhenti buang waktu berjam-jam mencari gambar untuk slide</span>
            </h1>
            <p className="hook-bridge">
              <span className="odin-emphasis-primary">ODIN</span> membuatnya untuk Anda dalam hitungan detik.
            </p>
            <p className="subcopy">
              <span className="odin-emphasis-secondary">ODIN</span> adalah desainer pribadi Anda, yang secara instan membuat
              visual berdasarkan slide PPT Anda
            </p>
            <ul className="bullets">
              <li>
                <span>01</span>
                <div>
                  <strong>AI yang Benar-Benar Ngerti Isi Slide</strong>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Visual Selalu Pas, Tanpa Edit Ulang</strong>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Tinggal Copy-Paste Kedalam Slide</strong>
                </div>
              </li>
            </ul>
          </div>
          <div className="cta-card">
            <h3>Mulai dengan ODIN</h3>
            <Link className="cta-btn" href="/pricing">
              Lanjut ke pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="below-hero">
        <div className="below-hero-inner">
          <div className="hook-contrast">
            <span className="hook-contrast-label">
              MASIH BEGINI CARA KALIAN 
              <br />
              BUAT GAMBAR PPT PAKE AI? 🤷‍♂️</span>
            <p className="hook-contrast-quote">&quot;BIARKAN SAYA MEMBUANG-BUANG WAKTU MENYUSUN PROMPT SEMPURNA&quot;</p>
          </div>
          <div className="meme-grid">
            <figure className="meme-card">
              <figcaption className="meme-label">Pengguna AI umum</figcaption>
              <img
                src="/onboarding/meme-1.jpeg"
                alt="Meme tentang proses prompt yang lambat dan menyiksa dengan AI umum."
              />
              <figcaption className="meme-caption">
                Esai prompt panjang, uji coba tanpa henti, dan waktu terbuang hanya untuk satu visual yang bisa dipakai.
              </figcaption>
            </figure>
            <figure className="meme-card">
              <figcaption className="meme-label">Pengguna ODIN</figcaption>
              <img src="/onboarding/meme-2.jpeg" alt="Meme tentang hasil cepat dan mudah dengan satu alur sederhana." />
              <figcaption className="meme-caption">
                Visual slide cepat dan akurat dengan prompt singkat dan usaha minimal.
              </figcaption>
            </figure>
          </div>
          <section className="proof-strip">
            <span className="proof-tag">Hanya Nano Banana Pro (tanpa ODIN)</span>
            <h3 className="proof-title">
              Anda berharap <span className="proof-emphasis">Nano Banana Pro</span> menghapus background dan membuat
              transparansi asli, tetapi yang muncul hanya <span className="proof-emphasis-blue">checkerboard pattern</span>,
              yang bukan transparansi asli.
            </h3>
            <p className="proof-caption">Ini hasil Nano Banana Pro tanpa ODIN yang menangani transparansi.</p>
            <div className="proof-row">
              <div className="proof-card">
                <p className="proof-label">Sebelum</p>
                <span className="proof-badge">Tanpa ODIN</span>
                <img src="/onboarding/meme-3.jpeg" alt="Gambar full scene sebelum background dihapus." />
              </div>
              <div className="proof-card">
                <p className="proof-label">Sesudah</p>
                <span className="proof-badge">Tanpa ODIN</span>
                <img
                  src="/onboarding/meme-4.jpeg"
                  alt="Gagal menghapus background, pola kotak-kotak tertanam di gambar."
                />
              </div>
            </div>
            <p className="proof-solution">
              ODIN membuat hasil akhir lebih bersih, generate lewat{' '}
              <span className="proof-key">Nano Banana Pro</span>, lanjutkan dengan background removal untuk{' '}
              <span className="proof-true">transparansi asli</span>.
            </p>
          </section>
        </div>
      </section>

      <section className="context-section">
        <div className="context-inner">
          <header className="context-header">
            <span className="context-kicker">Slide context aware</span>
            <h2 className="context-title">ODIN membaca slide Anda, lalu menulis ulang prompt Anda.</h2>
            <p className="context-subtitle">
              ODIN mengambil Topik, Tone, Colors, dan Style langsung dari screenshot slide sebelum membuat visual.
            </p>
          </header>
          <div className="context-steps">
            <div className="context-step">
              <div className="context-step-head">
                <span className="context-step-num">1</span>
                <span className="context-step-title">Ambil petunjuk dari slide</span>
              </div>
              <div className="context-extract">
                <div className="slide-card-mini">
                  <div className="slide-mini">Screenshot slide</div>
                </div>
                <div className="context-node">
                  <span className="context-node-title">ODIN mengambil</span>
                  <div className="context-chip-grid">
                    <span className="context-chip">Topic</span>
                    <span className="context-chip">Tone</span>
                    <span className="context-chip">Colors</span>
                    <span className="context-chip">Style</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="context-step">
              <div className="context-step-head">
                <span className="context-step-num">2</span>
                <span className="context-step-title">Perkaya prompt</span>
              </div>
              <div className="prompt-compare">
                <div className="prompt-card">
                  <div className="prompt-label">Prompt sederhana Anda</div>
                  <p className="prompt-text">
                    Buat seorang perempuan sangat bahagia, berambut pirang, anime artstyle. Dia sedang melawan serangan virus.
                  </p>
                </div>
                <div className="prompt-card">
                  <div className="prompt-label">Prompt yang diperkaya</div>
                  <p className="prompt-text">
                    Seorang perempuan berambut pirang yang sangat bahagia dalam anime artstyle yang halus, tertangkap dalam
                    pose aksi saat ia melawan virus digital bergaya; Style: karakter diterangi oleh motif energi biru dan
                    emas yang berkilau dan mencerminkan keamanan teknologi tinggi, dengan latar kota yang hancur dan
                    kacau di bawah langit gelap penuh badai serta kilatan petir. Bangunan runtuh dan puing-puing
                    berserakan di tanah retak, menciptakan adegan pertempuran yang dramatis dan penuh aksi.
                  </p>
                </div>
              </div>
            </div>
            <div className="context-step">
              <div className="context-step-head">
                <span className="context-step-num">3</span>
                <span className="context-step-title">Hasilkan visual siap pakai untuk slide</span>
              </div>
              <div className="result-grid">
                <div className="result-card">
                  <p className="result-label">Versi Asli</p>
                  <img src="/onboarding/blonde-1.jpeg" alt="Visual hasil generate dengan background penuh." />
                </div>
                <div className="result-card">
                  <p className="result-label">Background dihapus</p>
                  <div className="bg-demo" style={{ backgroundColor: bgColor }}>
                    <img src="/onboarding/blonde-2.png" alt="Visual hasil generate dengan background transparan." />
                  </div>
                  <div className="color-swatches" aria-label="Background color options">
                    {swatches.map((swatch) => (
                      <button
                        key={swatch.color}
                        className="color-swatch"
                        type="button"
                        style={{ '--swatch': swatch.color } as CSSProperties}
                        onClick={() => setBgColor(swatch.color)}
                        aria-label={swatch.label}
                      ></button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="side-panel-section">
        <div className="context-inner">
          <header className="context-header">
            <span className="context-kicker">Side panel workflow</span>
            <h2 className="context-title">Tetap di Canva, Slides, atau Figma</h2>
            <p className="context-subtitle">
              ODIN berada di side panel (panel samping), jadi Anda bisa membuat gambar tanpa meninggalkan slide editor-mu
            </p>
          </header>
          <div className="result-grid result-grid--single">
            <div className="result-card result-card--video">
              <p className="result-label">ODIN side panel</p>
              <video
                src="/onboarding/side-panel.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              ></video>
            </div>
          </div>
        </div>
      </section>

      <section className="side-panel-section">
        <div className="context-inner">
          <header className="context-header">
            <span className="context-kicker">Web app workflow</span>
            <h2 className="context-title">Lebih suka dashboard penuh? Gunakan ODIN Web App</h2>
            <p className="context-subtitle">
              Upload slide, generate visual, dan copy hasil langsung dari workspace ODIN.
            </p>
          </header>
          <div className="result-grid result-grid--single">
            <div className="result-card result-card--video">
              <p className="result-label">ODIN web app</p>
              <img src="/onboarding/web-app.png" alt="Tampilan workspace ODIN di web app." />
            </div>
          </div>
        </div>
      </section>

      <section className="comparison-section">
        <div className="context-inner">
          <header className="comparison-header">
            <h2>
              <strong>Perbandingan ODIN dengan generator visual lainnya</strong>
            </h2>
            <p>
              Kebanyakan tools dibuat untuk gambar umum. ODIN fokus pada visual slide yang cocok dengan layout, alur
              cerita, dan branding.
            </p>
          </header>
          <div className="comparison-grid">
            <article className="comparison-card">
              <div className="comparison-brand">
                <div className="comparison-logo">CG</div>
                <div>
                  <p className="comparison-name">GPT Image (ChatGPT)</p>
                  <p className="comparison-blurb">Bagus untuk ideasi, bukan untuk visual siap slide.</p>
                </div>
              </div>
              <ul className="comparison-list">
                <li className="is-negative">Prompt gambar umum tanpa konteks slide</li>
                <li className="is-negative">Tidak memahami layout slide</li>
                <li className="is-negative">Butuh resize manual untuk PPT</li>
                <li className="is-negative">Tidak ada prompt enhancement khusus slide</li>
              </ul>
            </article>

            <article className="comparison-card comparison-card--featured">
              <div className="comparison-brand">
                <div className="comparison-logo">OD</div>
                <div>
                  <p className="comparison-name">ODIN</p>
                  <p className="comparison-blurb">Dibuat khusus untuk slide PPT dan visual storytelling.</p>
                </div>
              </div>
              <ul className="comparison-list">
                <li>Memahami konteks slide dan batasan layout</li>
                <li>Menghasilkan visual sesuai rasio slide</li>
                <li>Prompt enhancement yang selaras dengan narasi PPT</li>
                <li>Asset drop-in lebih cepat dengan background removal</li>
              </ul>
            </article>

            <article className="comparison-card">
              <div className="comparison-brand">
                <div className="comparison-logo">NB</div>
                <div>
                  <p className="comparison-name">Nano Banana Pro (Gemini)</p>
                  <p className="comparison-blurb">Gambar berkualitas tinggi, tetapi tidak fokus untuk PPT.</p>
                </div>
              </div>
              <ul className="comparison-list">
                <li className="is-negative">Dibuat untuk output seni umum</li>
                <li className="is-negative">Tidak ada framing siap slide</li>
                <li className="is-negative">Perlu langkah ekstra agar pas di PPT</li>
                <li className="is-negative">Perlu bersih-bersih background manual</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="context-inner">
          <header className="faq-header">
            <h2>
              <strong>Pertanyaan Yang Sering Ditanyakan (FAQ)</strong>
            </h2>
            <p>Jawaban singkat untuk pertanyaan yang paling sering muncul tentang ODIN.</p>
          </header>
          <div className="faq-grid">
            <article className="faq-card">
              <h3>ODIN bisa dipakai di mana saja?</h3>
              <p>ODIN punya web app dan side panel untuk Canva, Google Slides, dan Figma.</p>
            </article>
            <article className="faq-card">
              <h3>Input apa saja untuk generate visual?</h3>
              <p>Screenshot slide dan teks slide (judul atau bullets).</p>
            </article>
            <article className="faq-card">
              <h3>Bisa pilih rasio visual?</h3>
              <p>Ya, tersedia Square (1:1), Portrait (9:16), dan Landscape (16:9).</p>
            </article>
            <article className="faq-card">
              <h3>Hasilnya bisa langsung dipakai di slide?</h3>
              <p>Ya, tinggal copy atau download PNG lalu drop ke slide.</p>
            </article>
            <article className="faq-card">
              <h3>Background bisa dihapus otomatis?</h3>
              <p>Bisa. ODIN punya background removal untuk transparansi asli.</p>
            </article>
            <article className="faq-card">
              <h3>Berapa banyak variasi gambar?</h3>
              <p>Di web app kamu bisa pilih 1–5 variants. Di side panel juga tersedia.</p>
            </article>
            <article className="faq-card">
              <h3>Apakah project dan hasil disimpan?</h3>
              <p>Di web app, hasil tersimpan di project. Side panel fokus ke generate cepat.</p>
            </article>
            <article className="faq-card">
              <h3>Apakah ODIN memahami branding?</h3>
              <p>ODIN menyesuaikan tone, colors, dan style dari konteks slide.</p>
            </article>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logo">
            <img src={logoSrc} alt="ODIN logo" onError={handleLogoError} />
          </div>
          <p className="footer-tagline">Visual slide siap pakai, tanpa ribet</p>
          <div className="footer-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/home#faq">FAQ</Link>
            <Link href="/terms">Syarat dan Ketentuan</Link>
            <Link href="/refund">Kebijakan Refund</Link>
            <Link className="menu-link" href="/contact">
              Contact
            </Link>
          </div>
          <p className="footer-meta">© 2026 ODIN Labs. All rights reserved.</p>
        </div>
      </footer>

      <Link className="menu-cta floating-cta" href="/pricing">
        Coba ODIN
      </Link>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <OnboardingPageContent />
    </Suspense>
  );
}

