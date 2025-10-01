# API Posting dengan Autentikasi Admin & Dukungan Multi-Gambar

REST API komprehensif untuk mengelola posting, komentar, dan artikel dengan autentikasi admin, unggah gambar, serta analitik.

## Fitur

- **Pembuatan Konten Publik**: Siapa pun dapat membuat posting dan komentar dengan gambar
- **Autentikasi Admin**: Autentikasi berbasis JWT untuk manajemen konten
- **Manajemen Post**: Pembuatan publik, moderasi oleh admin
- **Sistem Komentar**: Komentar publik dengan moderasi admin
- **Sistem Artikel**: Manajemen artikel ala CMS dengan banyak gambar (khusus admin)
- **Unggah Gambar**: Dukungan banyak gambar untuk posting, komentar, dan artikel
- **Analitik**: Pelacakan statistik lengkap dengan geolokasi
- **Pemeriksaan Kesehatan**: Endpoint status sistem dan geolokasi

## Instalasi

1. Kloning repositori ini
2. Pasang dependensi: `npm install`
3. Salin `.env.example` menjadi `.env` dan sesuaikan konfigurasinya
4. Jalankan XAMPP (layanan MySQL)
5. **Impor basis data**: Impor `database_setup.sql` ke MySQL/MariaDB
6. Jalankan aplikasi: `npm start`

📋 Lihat `DATABASE_SETUP.md` untuk petunjuk setup basis data yang lebih detail.

## Pengguna Admin Bawaan

- **Username**: `username-admin-anda`
- **Password**: `kata-sandi-yang-kuat`
- **Email**: `admin@domain-anda.test`

⚠️ **Penting**: Ganti placeholder ini pada data awal Anda dan gunakan kredensial kuat di lingkungan produksi.

## Endpoint API

### Autentikasi (`/pajar/auth`)

- `POST /login` - Login admin
- `GET /profile` - Ambil profil admin (butuh autentikasi)
- `PUT /change-password` - Ganti kata sandi (butuh autentikasi)
- `POST /create-user` - Buat pengguna admin baru (khusus admin)

### Post (`/pajar/posts`)

- `GET /` - Ambil semua post (publik)
- `GET /:id` - Ambil post berdasarkan ID dengan pelacakan view (publik)
- `POST /` - Buat post dengan gambar (publik - tanpa autentikasi!)
- `PUT /:id` - Perbarui post dengan gambar baru (khusus admin)
- `DELETE /:id` - Hapus post (khusus admin)
- `GET /:id/stats` - Statistik post (khusus admin)

### Komentar (`/pajar`)

- `GET /posts/:post_id/comments` - Ambil komentar untuk sebuah post (publik)
- `POST /posts/:post_id/comments` - Buat komentar dengan gambar (publik)
- `PUT /comments/:id` - Perbarui komentar (khusus admin)
- `DELETE /comments/:id` - Hapus komentar (khusus admin)

### Artikel (`/pajar/articles`)

- `GET /` - Ambil semua artikel terbit (publik, admin melihat semua status)
- `GET /featured` - Ambil artikel unggulan (publik)
- `GET /search?q=kata` - Cari artikel (publik)
- `GET /:id` - Ambil artikel berdasarkan ID dengan pelacakan view (publik untuk artikel terbit)
- `POST /` - Buat artikel dengan gambar (khusus admin)
- `PUT /:id` - Perbarui artikel dengan gambar baru (khusus admin)
- `DELETE /:id` - Hapus artikel (khusus admin)
- `GET /:id/stats` - Statistik artikel (khusus admin)

### Statistik (`/pajar/stats`)

Semua endpoint membutuhkan autentikasi admin:

- `GET /dashboard` - Statistik dashboard secara keseluruhan
- `GET /content/:type` - Statistik per jenis konten (post/komentar/artikel)
- `GET /content/:type/:id` - Statistik detail untuk konten tertentu
- `GET /images` - Statistik penggunaan gambar
- `DELETE /cleanup?days=365` - Bersihkan statistik lama

### Sistem

- `GET /` - Informasi API
- `GET /health` - Pemeriksaan kesehatan
- `GET /location?ip=x.x.x.x` - Ambil data geolokasi

## Unggah Berkas

### Format yang Didukung
- JPEG, JPG, PNG, GIF, WebP
- Ukuran maksimum berkas: 5MB
- Maksimum berkas per permintaan: 10 (post/artikel), 5 (komentar)

### Contoh Unggah

```bash
# Buat post dengan gambar
curl -X POST http://localhost:3000/pajar/posts \
  -F "title=Posting Saya" \
  -F "content=Isi posting di sini" \
  -F "author=Pengguna Publik" \
  -F "images=@gambar1.jpg" \
  -F "images=@gambar2.png"

# Buat komentar dengan gambar
curl -X POST http://localhost:3000/pajar/posts/1/comments \
  -F "author=Pengguna Anonim" \
  -F "content=Postingnya bagus!" \
  -F "images=@reaksi.gif"
```

## Autentikasi

### Login
```bash
curl -X POST http://localhost:3000/pajar/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Menggunakan Token JWT
```bash
curl -H "Authorization: Bearer TOKEN_JWT_ANDA" \
  http://localhost:3000/pajar/posts
```

## Skema Basis Data

Berkas SQL membuat tabel-tabel berikut:

- **users**: Akun pengguna admin
- **posts**: Post blog dengan jumlah view dan jumlah gambar
- **comments**: Komentar yang terhubung ke post dengan dukungan gambar
- **articles**: Artikel CMS dengan konten kaya dan banyak status
- **images**: Metadata berkas untuk semua gambar yang diunggah
- **statistics**: Data analitik dengan pelacakan geolokasi

## Kompatibilitas MariaDB ✅

Sepenuhnya kompatibel dengan:
- ✅ MySQL 5.7+
- ✅ MySQL 8.0+
- ✅ MariaDB 10.3+
- ✅ MariaDB 10.6+ (server hosting Anda)

## Variabel Lingkungan

Lihat `.env.example` untuk semua opsi konfigurasi yang tersedia.

## Pengembangan

- `npm start` - Mode produksi
- `npm run dev` - Mode pengembangan dengan nodemon

## Bekerja dengan Git

- `.gitignore` yang disediakan menjaga rahasia, dependensi, dan unggahan otomatis di luar versi kontrol. Pindahkan aset yang ingin dilacak ke jalur yang tidak diabaikan sebelum melakukan commit.
- Commit migrasi atau berkas seed basis data yang dibutuhkan agar orang lain dapat mereplikasi lingkungan Anda; hindari meng-commit data produksi.
- Tag rilis setiap kali Anda melakukan deploy agar konsumen API dapat mengunci ke versi tertentu.

## Fitur Keamanan

- Autentikasi berbasis JWT
- Hashing kata sandi dengan bcrypt
- Validasi unggah berkas
- Perlindungan dari SQL injection
- Proteksi rute khusus admin

## Fitur Analitik

- Pelacakan view dengan geolokasi
- Pelacakan user agent
- Metrik performa konten
- Analisis distribusi geografis
- Pola aktivitas per jam
- Statistik penggunaan gambar

## Penanganan Error

API mengembalikan format error yang konsisten:

```json
{
  "error": "Deskripsi pesan error"
}
```

Kode status HTTP yang umum:
- 200: Sukses
- 201: Dibuat
- 400: Permintaan tidak valid
- 401: Tidak terautentikasi
- 403: Dilarang (butuh admin)
- 404: Tidak ditemukan
- 500: Kesalahan server internal

## Lisensi

Didistribusikan di bawah Lisensi MIT. Lihat berkas `LICENSE` untuk informasi selengkapnya.
