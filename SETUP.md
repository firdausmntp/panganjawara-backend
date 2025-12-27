# 🚀 SETUP GUIDE - Pangan Jawara API

Panduan lengkap untuk deploy API ke **Vercel** dengan database **Supabase PostgreSQL**.

---

## 📋 Prerequisites

- Node.js 18+ terinstall
- Git terinstall
- Akun [Vercel](https://vercel.com) (gratis)
- Akun [Supabase](https://supabase.com) (gratis)

---

## 🗄️ Step 1: Setup Supabase

### 1.1 Buat Project Baru

1. Login ke [supabase.com](https://supabase.com)
2. Klik **"New Project"**
3. Isi:
   - **Name**: `panganjawara` (atau nama lain)
   - **Database Password**: Buat password kuat (SIMPAN INI!)
   - **Region**: Pilih terdekat (Singapore recommended)
4. Klik **"Create new project"**
5. Tunggu ~2 menit sampai setup selesai

### 1.2 Ambil Credentials

Setelah project ready, ambil credentials berikut:

**A. Project URL & API Key:**
1. Pergi ke **Settings** → **API**
2. Copy:
   - `Project URL` → ini jadi `SUPABASE_URL`
   - `anon public` key → ini jadi `SUPABASE_ANON_KEY`

**B. Database Connection String:**
1. Pergi ke **Settings** → **Database**
2. Scroll ke **Connection string** → pilih tab **URI**
3. Copy connection string, ganti `[YOUR-PASSWORD]` dengan password DB kamu
4. Ini jadi `DATABASE_URL`

Format:
```
postgresql://postgres.[project-id]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 1.3 Buat Storage Bucket

1. Pergi ke **Storage** di sidebar
2. Klik **"New bucket"**
3. Isi:
   - **Name**: `uploads`
   - **Public bucket**: ✅ Enable
4. Klik **"Create bucket"**

### 1.4 Setup Storage Policy

1. Klik bucket `uploads`
2. Klik tab **"Policies"**
3. Klik **"New policy"** → **"For full customization"**
4. Buat policy untuk public read:
   - **Policy name**: `Public Read`
   - **Allowed operation**: SELECT
   - **Target roles**: `anon`, `authenticated`
   - **Policy definition**: `true`
5. Buat policy lagi untuk authenticated upload:
   - **Policy name**: `Auth Upload`
   - **Allowed operation**: INSERT
   - **Policy definition**: `true`

---

## 🔧 Step 2: Setup Lokal

### 2.1 Clone & Install

```bash
git clone https://github.com/your-username/panganjawara-api.git
cd panganjawara-api
npm install
```

### 2.2 Setup Environment Variables

Copy `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Edit `.env` dengan credentials Supabase:

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres.[project-id]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

# Storage
SUPABASE_STORAGE_BUCKET=uploads

# JWT (buat secret random)
JWT_SECRET=your-super-secret-random-string-here
JWT_EXPIRES_IN=24h

# Server
PORT=3000
NODE_ENV=development
```

### 2.3 Test Lokal

```bash
npm run dev
```

Buka: http://localhost:3000/pajar/health

---

## ☁️ Step 3: Deploy ke Vercel

### 3.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Login Vercel

```bash
vercel login
```

### 3.3 Deploy

```bash
# First deployment
vercel

# Production deployment
vercel --prod
```

### 3.4 Set Environment Variables

Di Vercel Dashboard atau via CLI:

```bash
# Via CLI
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add SUPABASE_STORAGE_BUCKET
vercel env add CRON_SECRET

# Atau via Dashboard:
# Vercel Dashboard → Project → Settings → Environment Variables
```

**Environment Variables yang WAJIB:**

| Variable | Deskripsi | Contoh |
|----------|-----------|--------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbG...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | Random secret untuk JWT | `my-super-secret-123` |
| `SUPABASE_STORAGE_BUCKET` | Nama bucket storage | `uploads` |
| `CRON_SECRET` | Secret untuk cron job (opsional) | `random-cron-secret` |

### 3.5 Redeploy dengan Env

```bash
vercel --prod
```

---

## ⏰ Step 4: Cron Job (Keep Supabase Alive)

Supabase free tier akan **pause setelah 1 minggu tidak ada aktivitas**.

Sudah ada cron job yang fetch cuaca Jakarta tiap 3 jam untuk menjaga database aktif.

**Konfigurasi di `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/weather",
      "schedule": "0 */3 * * *"
    }
  ]
}
```

**Catatan:**
- Cron jobs hanya jalan di **Pro/Enterprise plan** Vercel
- Untuk **Hobby plan**, gunakan alternatif:
  - [cron-job.org](https://cron-job.org) (gratis)
  - [UptimeRobot](https://uptimerobot.com) (gratis)
  - GitHub Actions (gratis)

### Alternatif: GitHub Actions Cron

Buat file `.github/workflows/keep-alive.yml`:

```yaml
name: Keep Supabase Alive

on:
  schedule:
    - cron: '0 */3 * * *'  # Every 3 hours
  workflow_dispatch:  # Manual trigger

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Weather Endpoint
        run: |
          curl -X GET "https://your-app.vercel.app/api/cron/weather" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## 🧪 Step 5: Testing

### Health Check

```bash
curl https://your-app.vercel.app/pajar/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-28T10:00:00.000Z",
  "environment": "vercel",
  "database": "connected"
}
```

### Create Admin User

Via API atau langsung di Supabase SQL Editor:

```sql
INSERT INTO users (username, password, role)
VALUES ('admin', '$2a$10$...', 'admin');
```

Atau gunakan script:
```bash
node utils/createAdmin.js
```

---

## 📁 Project Structure

```
panganjawara-api/
├── api/
│   ├── index.js          # Vercel entry point
│   └── cron/
│       └── weather.js    # Cron job (keep DB alive)
├── config/
│   └── supabase.js       # Database configuration
├── controllers/          # Business logic
├── models/               # Database models
├── routes/               # API routes
├── utils/
│   ├── dbHelperPg.js     # PostgreSQL helpers
│   └── uploadSupabase.js # Storage helpers
├── vercel.json           # Vercel config
├── package.json
└── .env.example
```

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pajar/health` | Health check |
| POST | `/pajar/auth/login` | Login |
| POST | `/pajar/auth/register` | Register |
| GET | `/pajar/posts` | Get all posts |
| GET | `/pajar/articles` | Get all articles |
| GET | `/pajar/videos` | Get all videos |
| GET | `/pajar/events` | Get all events |
| GET | `/pajar/pangan/provinces` | Proxy: Harga pangan |
| GET | `/pajar/bmkg/prakiraan-cuaca` | Proxy: Cuaca BMKG |

Full documentation: `GET /pajar/`

---

## ⚠️ Troubleshooting

### Database Connection Error

1. Cek `DATABASE_URL` format benar
2. Pastikan password tidak ada karakter special yang perlu escape
3. Cek Supabase project tidak paused

### Storage Upload Error

1. Pastikan bucket `uploads` sudah dibuat
2. Cek policy sudah di-set
3. Pastikan `SUPABASE_STORAGE_BUCKET=uploads`

### Cron Not Running

1. Cron hanya di Vercel Pro plan
2. Gunakan alternatif: cron-job.org atau GitHub Actions
3. Test manual: `curl https://your-app.vercel.app/api/cron/weather`

### Supabase Paused

1. Login ke Supabase dashboard
2. Klik "Resume" pada project yang paused
3. Tunggu ~30 detik
4. Setup cron job untuk mencegah pause lagi

---

## 📝 Notes

- **Free tier limits:**
  - Supabase: 500MB storage, 2GB bandwidth
  - Vercel Hobby: 100GB bandwidth, no cron
  
- **Upgrade recommended untuk:**
  - Traffic tinggi
  - Cron jobs
  - Custom domain SSL

---

## 🆘 Support

Jika ada masalah:
1. Cek logs di Vercel Dashboard → Functions
2. Cek logs di Supabase Dashboard → Logs
3. Buka issue di repository

---

Made with ❤️ for Pangan Jawara
