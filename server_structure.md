# Struktur Server Multi-Aplikasi (Best Practice)

Dokumen ini merangkum pola folder, layanan, dan deploy yang aman untuk banyak aplikasi dalam satu VPS.

## Prinsip Utama
- Pisahkan backend dari web root agar tidak terekspos langsung.
- Isolasi dependensi (venv per app / node per app).
- Satu domain/subdomain = satu konfigurasi Nginx.
- Satu aplikasi = satu service systemd.

## Struktur Folder yang Disarankan

```
/opt/
  odin/
    backend/        # source backend + .venv
    data/           # db, images, uploads
    logs/           # log app (opsional)
  fly-odin/
    backend/        # jika ada API
    .venv/          # jika Python

/var/www/
  odinlabs-staging/ # frontend static (Next export)
  fly-odin/         # frontend static (game build)
```

## Catatan Implementasi ODIN
- Backend saat ini berada di /opt/odin/backend (sebelumnya /opt/odin/server).

## Nginx (Satu Vhost per App)
- `staging.odinlabs.id` -> `/var/www/odinlabs-staging`
- `fly-odin.odinlabs.id` -> `/var/www/fly-odin`
- Backend di-proxy ke port lokal masing-masing (contoh `127.0.0.1:8000`, `127.0.0.1:9000`).

## Systemd (Satu Service per Backend)
- `odin-backend.service` -> `/opt/odin/backend`
- `fly-odin.service` -> `/opt/fly-odin/backend` (jika ada server)

## Deploy (Ringkas)
Frontend static:
1. Build di lokal.
2. Upload ke `/var/www/<app>`.
3. Extract dan reload Nginx.

Backend:
1. Upload source ke `/opt/<app>/backend`.
2. `pip install -e .` di venv app.
3. `systemctl restart <app>.service`.

## Catatan Keamanan
- Jalankan backend sebagai user non-root.
- Aktifkan firewall (UFW) + rate limit SSH.
- Nonaktifkan `PermitRootLogin` jika sudah pakai user sudo.
- Gunakan permission web root minimal `755`.

---
Versi singkat ini bisa kamu tempel sebagai acuan awal dan disesuaikan dengan kebutuhan masing-masing app.

