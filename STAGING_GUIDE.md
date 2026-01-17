# ODIN Staging Guide (staging.odinlabs.id)

Goal: ship a minimal staging site that only exposes onboarding and pricing pages.

Scope for staging:
- /home (onboarding)
- /pricing (pricing)
- CTA checkout is disabled (no checkout flow yet)
- Everything else returns 404

Domain and server:
- Domain: staging.odinlabs.id
- VPS IP: 103.74.5.214 (Jetorbit)

Recommended approach: static export of the Next.js app and serve it with Nginx.

---

## 0) Preflight checklist (local)

1) Confirm the pages exist:
- `web/app/home/page.tsx`
- `web/app/pricing/page.tsx`

2) Confirm CTA checkout is disabled on pricing page.
- File: `web/app/pricing/page.tsx`
- Buttons already use `disabled` attribute. Keep it for staging.

3) Confirm assets are in `web/public`:
- `web/public/logo.png` (or .jpg/.svg)
- `web/public/onboarding/*`

---

## 1) DNS (staging.odinlabs.id -> VPS)

Create a DNS A record:
- Name: `staging`
- Type: `A`
- Value: `103.74.5.214`
- TTL: default (300 or 600 is fine)

Verify propagation from your machine:
```bash
nslookup staging.odinlabs.id
```
Expected: returns `103.74.5.214`.

If `nslookup` is not available:
```bash
ping -n 1 staging.odinlabs.id
```

---

## 2) Make Next.js exportable (static)

This staging only needs static HTML/JS/CSS. We will export the app to `web/out`.

Edit `web/next.config.mjs` and merge these settings:
```js
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
```

Notes:
- `output: 'export'` makes `npm run build` produce `web/out`.
- `trailingSlash: true` ensures `/home/` and `/pricing/` map to `index.html`.
- `images.unoptimized` is required for Next Image when exporting static.

---

## 3) Build locally

From the repo root:
```bash
cd web
npm ci
npm run build
```

Confirm output exists:
```bash
dir out
```

Expected paths:
- `web/out/home/index.html`
- `web/out/pricing/index.html`
- `web/out/_next/`

Optional local preview:
```bash
npx serve out
```
Then open `http://localhost:3000/home/` and `http://localhost:3000/pricing/`.

---

## 4) Prepare the VPS

SSH to the VPS:
```bash
ssh user@103.74.5.214
```

Install Nginx:
```bash
sudo apt update
sudo apt install -y nginx
```

Create the web root:
```bash
sudo mkdir -p /var/www/odinlabs-staging
sudo chown -R $USER:$USER /var/www/odinlabs-staging
```

---

## 5) Upload the build

From your local machine:
```bash
rsync -avz web/out/ user@103.74.5.214:/var/www/odinlabs-staging/
```

If `rsync` is not available, use `scp`:
```bash
scp -r web/out/* user@103.74.5.214:/var/www/odinlabs-staging/
```

---

## 6) Nginx config (only /home and /pricing)

Create a server block at `/etc/nginx/sites-available/odinlabs-staging`:
```nginx
server {
  server_name staging.odinlabs.id;
  root /var/www/odinlabs-staging;
  index index.html;

  # Only allow the onboarding and pricing flows
  location = / { return 302 /home/; }
  location /home/ { try_files $uri $uri/ /home/index.html; }
  location /pricing/ { try_files $uri $uri/ /pricing/index.html; }

  # Static assets
  location /_next/ { try_files $uri =404; }
  location /onboarding/ { try_files $uri =404; }
  location ~* \.(css|js|png|jpg|jpeg|webp|svg|gif|mp4|ico|woff2?)$ { try_files $uri =404; }

  # Everything else returns 404 during staging
  location / { return 404; }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/odinlabs-staging /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7) SSL with Lets Encrypt

Install certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

Issue cert:
```bash
sudo certbot --nginx -d staging.odinlabs.id
```

Verify renewal:
```bash
sudo certbot renew --dry-run
```

---

## 8) Smoke test (must pass)

1) Redirect:
```bash
curl -I https://staging.odinlabs.id/
```
Expect: `302` to `/home/`.

2) Pages:
- `https://staging.odinlabs.id/home/`
- `https://staging.odinlabs.id/pricing/`

3) Assets:
- `https://staging.odinlabs.id/logo.png`
- `https://staging.odinlabs.id/onboarding/meme-1.jpeg` (or any existing asset)

4) Unused routes:
- `https://staging.odinlabs.id/workspace` should return 404.

---

## 9) Update flow (future changes)

When you update the UI:
1) Rebuild locally (step 3)
2) Rsync the new `web/out` to the VPS (step 5)
3) Reload Nginx if needed (usually not necessary)

Optional safer release flow:
- Upload to a timestamped folder: `/var/www/odinlabs-staging/releases/2026-01-14-2100/`
- Update a symlink `/var/www/odinlabs-staging/current` to point to latest
- Set `root /var/www/odinlabs-staging/current;` in Nginx

---

## 10) Common issues and fixes

1) 404 on `/home` or `/pricing`
- Ensure `trailingSlash: true` in `web/next.config.mjs`
- Ensure the output paths exist: `web/out/home/index.html`

2) 404 on assets like `/onboarding/...`
- Ensure assets are in `web/public/onboarding/`
- Ensure Nginx `location /onboarding/` is present

3) SSL failing
- DNS not propagated yet, recheck `nslookup staging.odinlabs.id`
- Port 80 and 443 must be open on the VPS firewall

4) Mixed content
- Ensure all asset URLs are relative (they are in current code)

---

## 11) Optional: Basic auth for staging

If you want to hide staging from the public:
```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd youruser
```

Then add to the server block:
```nginx
auth_basic "Restricted";
auth_basic_user_file /etc/nginx/.htpasswd;
```

Reload Nginx:
```bash
sudo systemctl reload nginx
```

---

## 12) Notes for later phases (checkout and app)

When checkout is ready:
- Add a dedicated `/checkout` route in the Next app
- Remove the Nginx 404 guard for `/checkout`
- Switch from static export to full Next server (or keep static + external checkout link)
- Add Midtrans scripts on checkout page only

