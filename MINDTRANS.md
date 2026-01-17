## 1) Kapabilitas akun Individu/Perorangan (yang realistis buat web app)

### Paket awal yang “paling aman” untuk individu

- Midtrans “Starter Pack” untuk **Individu** mencakup **Bank Transfer, GoPay, dan QRIS**, dan dokumen yang diminta adalah **KTP (WNI)** atau **Passport + KITAS (WNA)**. ([Midtrans][1])
- Jika mau tambah **pembayaran kartu**, untuk **Individu** butuh **NPWP** (di luar KTP/Passport+KITAS). ([Midtrans][1])
- Midtrans juga menyatakan kamu bisa **daftar hanya perlu KTP untuk aktivasi GoPay, QRIS, dan bank transfer** (ini selaras dengan Starter Pack). ([Midtrans][2])

### Keterbatasan metode pembayaran untuk akun perorangan

Tidak semua payment method tersedia untuk akun perorangan. Midtrans membandingkan ketersediaan metode pembayaran berdasarkan tipe akun, dan terlihat ada metode yang “tidak tersedia” untuk perorangan (mis. beberapa VA/OTC tertentu, dll).

> Implikasi praktis: untuk web app, biasanya mulai dari **Snap + Starter Pack (VA/Bank Transfer + GoPay/QRIS)** dulu. Kartu bisa menyusul jika dokumen/aktivasi sudah beres.

---

## 2) Best practice flow integrasi Midtrans untuk Web App (akun Individu)

### Kenapa pilih “Snap” untuk web app?

Snap adalah flow “hosted checkout UI” (popup/redirect) yang paling cepat dan minim risiko karena UI pembayaran dikelola Midtrans; kamu cukup membuat **Snap token di backend** lalu memunculkannya via **snap.js** di frontend. Flow ini memang yang dijelaskan Midtrans di “Snap Integration Guide”. ([Midtrans Documentation][3])

---

## 3) Flow end-to-end yang disarankan (dengan alasan keamanan)

### A. Siapkan konfigurasi dasar di Dashboard

1. Set **Payment Notification URL** (webhook) + **Finish/Unfinish/Error Redirect URL** di Dashboard. Midtrans mensyaratkan prefix `http://` atau `https://` dan **merekomendasikan HTTPS**. ([Midtrans Documentation][4])
2. Untuk redirect setelah pembayaran, Midtrans juga menekankan pengaturan **Finish/Unfinish/Error URL** agar pelanggan balik ke halaman kamu dengan benar. ([Midtrans Documentation][3])

---

### B. Buat Order di sistem kamu dulu (sebelum panggil Midtrans)

- Saat user klik “Bayar”, buat record order di DB kamu dengan status misalnya `CREATED/PENDING_PAYMENT`.
- Generate `order_id` **unik** (jangan pernah reuse).

  - Midtrans menyebut `order_id` **hanya boleh dipakai sekali**, ada batas karakter yang diizinkan, dan max 50 char. ([Midtrans Documentation][3])

> Praktik bagus: jadikan `order_id` sebagai kunci idempotensi internal kamu (kalau user refresh/klik bayar berkali-kali, kamu tidak bikin transaksi ganda).

---

### C. Backend kamu meminta Snap Token (WAJIB dari server, bukan browser)

1. Backend memanggil endpoint Snap:

- Sandbox: `https://app.sandbox.midtrans.com/snap/v1/transactions`
- Production: `https://app.midtrans.com/snap/v1/transactions` ([Midtrans Documentation][3])

2. Auth pakai **Basic Auth** dengan **Server Key sebagai username** dan password kosong (Server Key harus rahasia). ([Midtrans Documentation][3])

3. Minimal payload berisi:

- `order_id`
- `gross_amount`
- (opsional tapi disarankan) `customer_details`, dsb. ([Midtrans Documentation][3])

**Catatan keamanan penting:** Midtrans juga menegaskan jangan memanggil endpoint yang butuh Server Key dari frontend (selain alasan keamanan, biasanya kena CORS). ([Midtrans Documentation][5])

---

### D. Frontend menampilkan UI pembayaran (Snap Popup atau Redirect)

#### Opsi 1 — Popup (umumnya paling enak untuk web app)

- Include `snap.js` + `data-client-key`, lalu panggil:

  - `window.snap.pay('TRANSACTION_TOKEN_HERE')` ([Midtrans Documentation][3])

- Kamu boleh pakai callback `onSuccess/onPending/onError/onClose`, tapi **anggap ini hanya UX helper**, bukan sumber kebenaran pembayaran. ([Midtrans Documentation][3])

#### Opsi 2 — Redirect

- Pakai `redirect_url` dari response Snap token untuk lempar user ke halaman pembayaran Midtrans. ([Midtrans Documentation][3])

---

### E. Setelah user bayar: jangan “menganggap lunas” dari frontend

Midtrans menjelaskan: ketika status transaksi berubah, user akan diarahkan ke Redirect URL dan Midtrans akan mengirim **HTTP notification (webhook)** ke server merchant untuk update status secara aman. ([Midtrans Documentation][3])

Dan Midtrans sangat tegas soal ini:

- **Data dari luar** (termasuk callback frontend Snap.js) bisa dimodifikasi user; kamu **harus verifikasi** ke Midtrans sebelum ambil aksi finansial (mis. kirim barang). ([Midtrans Documentation][4])

---

## 4) Webhook handling yang benar (inti best practice)

### A. Verifikasi keaslian notifikasi (WAJIB)

Midtrans merekomendasikan 2 cara:

1. **Verifikasi `signature_key`** (SHA512):

- `SHA512(order_id+status_code+gross_amount+ServerKey)` ([Midtrans Documentation][4])

2. Atau **verifikasi dengan GET Status API** (paling straightforward):

- Midtrans menyebut verifikasi bisa dilakukan via **GET Status API** dan responsnya akan sama dengan notifikasi. ([Midtrans Documentation][4])

### B. Update status order di DB kamu (mapping yang aman)

Midtrans memberi panduan field yang sebaiknya dicek untuk menyatakan transaksi sukses:

- `status_code` harus `200`
- `fraud_status` (jika ada) harus `accept`
- `transaction_status` harus `settlement` atau `capture` ([Midtrans Documentation][4])

Mapping praktis:

- `settlement` / `capture` ⇒ **PAID**
- `pending` ⇒ **WAITING_PAYMENT**
- `expire` / `cancel` / `deny` ⇒ **FAILED/EXPIRED**
- `refund` / `partial_refund` ⇒ **REFUNDED** ([Midtrans Documentation][4])

### C. Pastikan webhook endpoint kamu “ramah Midtrans”

- Midtrans minta endpoint kamu balas **HTTP 200** agar dianggap sukses; ada aturan retry jika kamu balas status lain. ([Midtrans Documentation][4])
- Best practice: **HTTPS**, port standar (80/443), dan **idempotent** (Midtrans bisa kirim notifikasi ganda untuk event yang sama; gunakan `order_id` sebagai kunci). ([Midtrans Documentation][4])

---

## 5) GET Status API untuk “recheck” (sering dipakai di halaman Finish)

Endpoint status (contoh sandbox):

- `GET https://api.sandbox.midtrans.com/v2/[ORDER_ID]/status` ([Midtrans Documentation][6])
  Auth:
- `Authorization: Basic base64(ServerKey+":")` ([Midtrans Documentation][6])

**Catatan penting untuk Snap:** status bisa belum ada/404 kalau user belum memilih metode pembayaran di halaman Snap. Ini normal dan dijelaskan Midtrans. ([Midtrans Documentation][4])

---

## 6) Hardening tambahan (opsional tapi recommended)

### IP whitelist untuk webhook (kalau server kamu ketat)

Kalau kamu mem-filter inbound traffic, Midtrans memberi daftar blok IP yang perlu di-whitelist (production & sandbox). ([Midtrans Documentation][7])

---

[1]: https://midtrans.com/id/passport "Passport | Midtrans"
[2]: https://midtrans.com/ "Midtrans | Solusi Payment Gateway Indonesia Terlengkap"
[3]: https://docs.midtrans.com/docs/snap-snap-integration-guide "Integration Guide"
[4]: https://docs.midtrans.com/docs/https-notification-webhooks "HTTP(S) Notification / Webhooks"
[5]: https://docs.midtrans.com/docs/technical-faq "Technical FAQ"
[6]: https://docs.midtrans.com/docs/get-status-api-requests "GET Status API Requests"
[7]: https://docs.midtrans.com/docs/why-did-i-not-receive-any-http-notification-from-midtrans-system "Why did I not receive any HTTP notification from Midtrans’ system?"
