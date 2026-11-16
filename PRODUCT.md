# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 (App Router) fullstack, TypeScript, `better-sqlite3` sebagai local DB,
Google OAuth 2.0 (`gmail.readonly` scope), `googleapis` SDK. Deploy localhost
first via `npm run dev`; hosting target production ditunda sampai flow lokal
matang. Pilihan direkam di interview (operator pilih dari 4 opsi: Next.js
fullstack, Vite+Fastify split, Astro+islands, delegated).

## Users

Satu operator — pemilik Sociofy Agent — yang menjalankan batch create account
Instagram dari laptop lokal atau RDP Windows. Operator butuh auto-OTP supaya
flow signup tidak berhenti menunggu kode email. Dia sudah terbiasa dengan
`RisetAutoCheckOTP_Email` yang ada di repo Sociofy; AuthFleet adalah upgrade
UI + arsitektur, bukan tool baru untuk audience berbeda.

Tidak ada signup publik, tidak ada multi-tenant, tidak ada team workspace.

## Product Purpose

Auto-OTP service: terima Gmail OAuth grants, pantau inbox lewat Gmail API,
ekstrak 6/8-digit OTP (Instagram/Meta), serve lewat HTTP endpoint dengan
API-key auth. Sociofy Agent memanggil endpoint ini saat signup berjalan dan
butuh kode email masuk — tanpa manual copy-paste.

Beda dari `RisetAutoCheckOTP_Email`: folder-based grouping (satu OAuth client
+ N Gmail accounts + M API keys dalam satu container, bukan flat profile list),
sehingga operator bisa rotate API key tanpa invalidate seluruh integrasi, dan
audit per key yang lebih bersih.

## Positioning

Redesign + reframe dari layer yang Sociofy sudah pakai hari ini, menjadi web
app berdiri sendiri dengan arsitektur folder-centric. Sociofy Agent tetap bisa
pakai `RisetAutoCheckOTP_Email` yang lama — AuthFleet hidup paralel dan
membuktikan nilainya lewat UX, bukan lewat memaksa migrasi.

Repo terpisah: `https://github.com/zainpewpewpew/AuthFleet.git`.

## Operating Context

- Running di laptop operator atau RDP Windows (port dev 3000).
- Operator setup Google Cloud project OAuth client sekali per folder: buat
  OAuth client "Web application", paste `client_id` + `client_secret` ke
  AuthFleet saat buat folder baru.
- Google Cloud OAuth consent: External Testing (refresh token 7 hari) atau
  Production (permanent). Operator pilih sendiri — AuthFleet tidak memaksa.
- Gmail OAuth scope: `gmail.readonly` saja. Tidak akses kalendar, kontak, atau
  scope lain.
- Sociofy Agent memanggil `POST /api/v1/otp/wait` dengan API key di header
  `Authorization: Bearer afk_live_xxx` saat batch signup berjalan.
- Database SQLite di `./data/authfleet.sqlite`, token Gmail terenkripsi
  AES-256-GCM, key dari env.

## Capabilities and Constraints

**Capabilities (confirmed):**

- Login page: operator-only session (password, HttpOnly cookie).
- Folders: list / create / edit / delete. Setiap folder adalah 1 OAuth client
  (client_id + client_secret) + metadata (label, warna).
- Dalam folder: connect multiple Gmails via Google OAuth consent flow.
  Disconnect per Gmail. Reauthorize per Gmail kalau refresh token revoked.
- API keys per folder: generate (returns `afk_live_xxx` sekali saja),
  revoke, edit label. Multiple keys per folder OK (untuk rotasi).
- OTP endpoint: `POST /api/v1/otp/wait` (long-poll, 180s default) +
  `GET /api/v1/otp/latest` (idempotent latest). API key dalam Authorization
  header.
- Audit log: last N (default 200) API calls per key dengan timestamp +
  outcome, tanpa menyimpan kode OTP permanen.
- Scopes OTP extraction: 6 digit (Instagram signup), 8 digit (Meta/Accounts
  Center 2FA), spaced format `123 456`.

**Constraints:**

- Single operator (no multi-tenant).
- Localhost first; production hosting belum diputuskan.
- No SMS, no other providers — Gmail only.
- Refresh token expiry governed oleh Google (7 hari di Testing); operator's
  responsibility untuk graduate ke Production kalau dipakai lama.
- OAuth client credentials (client_id/secret) disimpan terenkripsi di DB.

**Undecided (recorded for later):**

- Session auth method: v1 pakai password + HttpOnly cookie. Passkey/WebAuthn
  sebagai enhancement setelah v1 stabil.
- Rate limit per API key: default initial TBD saat endpoint selesai.
- Gmail history-push notifications: v1 pakai polling; subscribe webhook adalah
  future improvement.

## Brand Commitments

- **Nama**: "AuthFleet" (binding).
- **Visual direction**: "Gen-Z style" (binding). Interpretasi spesifik
  (palette, typography, motion) diputuskan di new-work berdasarkan brief ini.
- **Repo**: `https://github.com/zainpewpewpew/AuthFleet.git` (binding, terpisah
  dari Sociofy monorepo).
- **Tone**: Indonesian default (sama dengan Sociofy Dream world); toggle
  English sebagai nice-to-have, bukan v1 commit.

## Evidence on Hand

- Working reference implementation di `../Riset_WarmUp_Instagram6/RisetAutoCheckOTP_Email/`:
  OAuth flow (`src/oauth.js`), multi-profile registry (`src/oauthProfiles.js`),
  AES-256-GCM token store (`src/tokenStore.js`), OTP parser (`src/otpParser.js`),
  long-poll wait (`src/otpWait.js`), Gmail API client (`src/gmailService.js`).
  Modul-modul ini terbukti jalan di production operator setiap hari.
- Sociofy Agent's existing OTP calls: `../Riset_WarmUp_Instagram6/src/otpApiClient.js`,
  dipanggil dari `src/cloudPhoneIgSignup.js:467` dan `src/signupInstagram.js`.
- Tidak ada testimonial, benchmark, atau pricing — ini internal tooling.

## Product Principles

1. **Folder adalah unit integrasi.** Satu folder = satu OAuth client +
   N Gmails + M API keys. Operator bisa rotate keys atau ganti OAuth client
   tanpa mengganggu folder lain.
2. **Credentials never leave the operator's machine.** Localhost default;
   kalau nanti di-host, encryption at rest wajib dan tidak ada export
   endpoint untuk raw refresh tokens atau client secrets.
3. **One API call, one OTP.** API design optimized untuk Sociofy pattern:
   Agent tahu email target + window waktu, panggil `wait`, dapat satu kode
   atau timeout. No streaming, no webhook di v1.
4. **Gen-Z aesthetic sebagai brand signature.** Dashboard harus terasa
   segar dan personal, tidak corporate — tapi tetap scannable karena
   operator pakai setiap hari (Operate mode).
5. **Coexist, bukan rewrite.** Sociofy tetap bisa pakai
   `RisetAutoCheckOTP_Email` yang lama. AuthFleet buktikan nilainya lewat UX.

## Accessibility & Inclusion

Single-operator app yang dipakai harian; keyboard navigation + visible focus
rings adalah floor. Bahasa Indonesia default (operator bilingual, primary ID).
WCAG AA contrast ratio target untuk semua text.
