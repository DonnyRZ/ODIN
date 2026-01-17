## 1) Pastikan paham: Sandbox itu terpisah dari Production

- **Sandbox** untuk transaksi uji (tidak real) dan bisa disimulasikan lewat **Sandbox Simulator**. ([Midtrans Documentation][1])
- **API key Sandbox dan Production berbeda**. Jangan dicampur. ([Midtrans Documentation][1])

---

## 2) Buat akun & ambil API Keys (di Sandbox)

1. Login ke dashboard Midtrans, pilih environment **Sandbox** dari dropdown Environment. ([Midtrans Documentation][1])
2. Masuk **Settings → Access Keys** untuk mengambil:

   - **Client Key** (boleh dipakai di frontend)
   - **Server Key** (wajib disimpan rahasia di backend) ([Midtrans Documentation][1])

**Catatan keamanan penting:** Server Key itu “kunci” untuk request API dari backend; jangan pernah taruh di browser/client. ([Midtrans Documentation][1])

---

## 3) Siapkan konfigurasi di web app (disarankan via ENV)

Contoh variabel environment:

```bash
MIDTRANS_ENV=sandbox
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
```

Alasannya: supaya gampang pindah environment tanpa ubah kode, dan menghindari Server Key bocor. ([Midtrans Documentation][1])

---

## 4) (Jika pakai Snap) Backend: buat transaksi & ambil Snap Token

Di Snap flow, langkah backend adalah **request ke Snap API untuk dapat `token`**. ([Midtrans Documentation][2])

### 4A) Manual HTTP request (paling universal)

Endpoint Sandbox untuk create transaksi Snap: ([Midtrans Documentation][2])

```bash
POST https://app.sandbox.midtrans.com/snap/v1/transactions
```

Midtrans pakai **Basic Auth**: username = Server Key, password kosong (encode base64 `ServerKey:`). ([Midtrans Documentation][2])

Contoh (cURL):

```bash
curl -X POST https://app.sandbox.midtrans.com/snap/v1/transactions \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic <base64(ServerKey:)> " \
  -d '{
    "transaction_details": {
      "order_id": "ORDER-12345",
      "gross_amount": 10000
    },
    "credit_card": { "secure": true }
  }'
```

**Wajib diperhatikan:**

- `order_id` harus **unik** dan ada batas karakter yang diperbolehkan. ([Midtrans Documentation][2])

Respons akan mengembalikan `token` (dan biasanya juga ada `redirect_url`, tergantung metode/opsi). Token inilah yang kamu kirim ke frontend. ([Midtrans Documentation][2])

### 4B) Pakai library resmi (contoh Node.js)

Repo resmi Midtrans menunjukkan konfigurasi `isProduction: false` untuk Sandbox. ([GitHub][3])

```js
let snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});
```

---

## 5) Frontend: tampilkan UI pembayaran Snap (snap.js Sandbox)

Di halaman checkout kamu, include `snap.js` Sandbox + Client Key: ([Midtrans Documentation][4])

```html
<script
  type="text/javascript"
  src="https://app.sandbox.midtrans.com/snap/snap.js"
  data-client-key="SET_YOUR_CLIENT_KEY_HERE"
></script>
```

Lalu saat user klik “Bayar”, panggil:

```html
<button id="pay-button">Bayar</button>
<script>
  document.getElementById("pay-button").addEventListener("click", async () => {
    // 1) Minta snapToken ke backend kamu (endpoint internal kamu sendiri)
    const res = await fetch("/api/payments/midtrans/token", { method: "POST" });
    const { token } = await res.json();

    // 2) Tampilkan Snap
    window.snap.pay(token, {
      onSuccess: function (result) {
        console.log("success", result);
      },
      onPending: function (result) {
        console.log("pending", result);
      },
      onError: function (result) {
        console.log("error", result);
      },
      onClose: function () {
        console.log("customer closed the popup");
      },
    });
  });
</script>
```

Snap memang mendukung **callback JS** seperti `onSuccess/onPending/onError/onClose`. ([Midtrans Documentation][5])

> Praktik yang benar: hasil callback JS boleh dipakai untuk UX (tampilkan pesan), tapi **status final pembayaran tetap harus kamu validasi dari webhook/notification atau status API**.

---

## 6) Siapkan Webhook/Notification (ini yang paling sering dilupakan)

Midtrans akan mengirim **HTTP(S) POST notification/webhook** saat pembayaran selesai atau status berubah. ([Midtrans Documentation][6])

### 6A) Set Notification URL di Dashboard (Sandbox)

Bisa di-set lewat menu **Payment Settings / Configuration** di dashboard. ([Midtrans Documentation][7])

**Syarat penting:**

- URL harus bisa diakses dari **public internet** (Midtrans tidak bisa kirim ke localhost, URL di balik VPN, port aneh, dsb). ([Midtrans Documentation][6])
- Kalau masih develop di lokal, gunakan alat seperti **ngrok** untuk expose endpoint webhook. ([Midtrans Documentation][6])

### 6B) Implement endpoint webhook di backend kamu

Saat menerima notification, lakukan minimal ini:

1. Parse JSON body.
2. **Verifikasi signature_key** (untuk memastikan notifikasi benar dari Midtrans). ([Midtrans Documentation][8])
   Rumus signature yang dicantumkan Midtrans:

   - `SHA512(order_id + status_code + gross_amount + serverkey)` ([Midtrans Documentation][8])

3. Update status transaksi di database kamu berdasarkan `transaction_status`.

---

## 7) Testing di Sandbox (tanpa uang asli)

### 7A) Gunakan Midtrans Payment Simulator

Simulator resmi: bisa mensimulasikan skenario pembayaran untuk berbagai metode. ([Midtrans Payment Simulator][9])
**Jangan pernah pakai kredensial/uang asli di Sandbox.** ([Midtrans Payment Simulator][9])

### 7B) Tes kartu (contoh yang umum dipakai)

Untuk Snap, contoh kredensial test card yang disebutkan di guide: ([Midtrans Documentation][4])

- Card Number: `4811 1111 1111 1114`
- CVV: `123`
- Exp: bulan apa saja, tahun future
- OTP/3DS: `112233`

Dokumentasi juga menyediakan banyak nomor kartu untuk skenario deny/RC tertentu, dll. ([Midtrans Documentation][10])

---

## 8) (Opsional tapi berguna) Cek status transaksi via Status API

Kalau kamu ingin polling/validasi status, Midtrans menyediakan endpoint status seperti: ([Midtrans Documentation][11])

```bash
GET https://api.sandbox.midtrans.com/v2/{ORDER_ID}/status
```

Auth-nya tetap Basic Auth menggunakan Server Key. ([Midtrans Documentation][11])

---

## 9) Checklist cepat sebelum dianggap “Sandbox integration OK”

- [ ] Backend bisa create transaksi dan dapat **Snap token**. ([Midtrans Documentation][2])
- [ ] Frontend berhasil load `snap.js` Sandbox dan bisa membuka UI pembayaran. ([Midtrans Documentation][4])
- [ ] Webhook endpoint **public** dan menerima notifikasi dari Midtrans. ([Midtrans Documentation][6])
- [ ] Kamu memverifikasi **signature_key** sebelum update database. ([Midtrans Documentation][8])
- [ ] Kamu bisa simulate pembayaran via **Sandbox Simulator** / test credentials. ([Midtrans Payment Simulator][9])

---

## 10) Nanti kalau pindah Production (gambaran singkat)

Saat go-live, Midtrans menyarankan:

- Ganti domain dengan menghapus `.sandbox` (mis. `app.sandbox.midtrans.com` → `app.midtrans.com`) dan ganti keys ke Production. ([Midtrans Documentation][12])
- Untuk Snap: ganti script menjadi `https://app.midtrans.com/snap/snap.js` + Client Key production. ([Midtrans Documentation][12])

---

[1]: https://docs.midtrans.com/docs/midtrans-account "Account Overview"
[2]: https://docs.midtrans.com/docs/snap-snap-integration-guide "Integration Guide"
[3]: https://github.com/Midtrans/midtrans-nodejs-client?utm_source=chatgpt.com "Official Midtrans Payment API Client for Node JS"
[4]: https://docs.midtrans.com/docs/snap-snap-integration-guide?utm_source=chatgpt.com "Integration Guide"
[5]: https://docs.midtrans.com/docs/snap-advanced-feature?utm_source=chatgpt.com "Advanced Feature"
[6]: https://docs.midtrans.com/docs/https-notification-webhooks "HTTP(S) Notification / Webhooks"
[7]: https://docs.midtrans.com/docs/payment-settings "Payment Settings"
[8]: https://docs.midtrans.com/reference/handle-notifications?utm_source=chatgpt.com "Handle Notifications"
[9]: https://simulator.sandbox.midtrans.com/ "Midtrans Payment Simulator"
[10]: https://docs.midtrans.com/docs/testing-payment-on-sandbox "Testing Payment on Sandbox"
[11]: https://docs.midtrans.com/docs/get-status-api-requests "GET Status API Requests"
[12]: https://docs.midtrans.com/docs/switching-to-production-mode?utm_source=chatgpt.com "Switching to Production Mode"
