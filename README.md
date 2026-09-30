# Panduan Setup & Running — ISPU-BE

Backend Node.js (Express ESM) + Prisma + MySQL + WebSocket (`ws`).

## 1. Prasyarat

- Node.js ≥ 18 (cek: `node -v`)
- npm ≥ 9 (cek: `npm -v`)
- MySQL ≥ 8 berjalan lokal / remote
- Database `portal` sudah ada (schema Prisma me-mirror DB Rails yang sudah ada — jangan `migrate`, cukup `generate`)

## 2. Clone & Install

```bash
git clone <repo-url> ispu-be
cd ispu-be
npm install
```
 
## 3. Konfigurasi `.env`

File `.env` tidak ikut git (lihat `.gitignore`). Buat manual:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/portal"
PORT=3000
JWT_SECRET="isi-random-min-32-karakter"
JWT_SECRET_INTERNAL="isi-random-min-32-karakter"
```

> Catatan: `PORT` di `.env` saat ini **tidak dipakai** — `src/application/web.js:37` hardcode `app.listen(3200)`. Server selalu jalan di port **3200**.

## 4. Setup Database

Pastikan MySQL jalan dan DB `portal` ada:

```sql
CREATE DATABASE IF NOT EXISTS portal;
```

`DATABASE_URL` format:

```
mysql://user:password@localhost:3306/portal
```

## 5. Prisma

Project ini hanya butuh generate client (tanpa migrate karena tabel sudah ada):

```bash
npx prisma generate
npx prisma db pull   # opsional, untuk sinkronisasi schema dari DB
```

Verifikasi koneksi cepat:

```bash
npx prisma db execute --stdin <<< "SELECT 1;"
```

## 6. Running

Dev (auto-reload via nodemon):

```bash
npm run dev
```

Production:

```bash
npm start
```

Berhasil jika muncul:

```
Server running on http://0.0.0.0:3200
```

Kill proses di port 3000 (Linux/macOS saja):

```bash
npm run kill
```

> Di Windows gunakan: `netstat -ano | findstr :3200` lalu `taskkill /PID <pid> /F`

## 7. Verifikasi

| Cek | Cara |
|---|---|
| HTTP | `POST http://localhost:3200/data/ispu` dengan body JSON sensor |
| WebSocket | konek ke `ws://localhost:3200` → terima `DATA_2MENIT_UPDATE` / `WEATHER_UPDATE` |
| Download | `GET http://localhost:3200/download/:filename` (file di `public/export/`) |
| Auth | `http://localhost:3200/auth/...` (lihat `src/routes/auth.js`) |

Contoh ping WebSocket (browser console):

```js
const ws = new WebSocket('ws://localhost:3200');
ws.onmessage = (e) => console.log(e.data);
```

## 8. Troubleshooting

| Gejala | Penyebab / Solusi |
|---|---|
| `Can't reach database server` | MySQL mati / `DATABASE_URL` salah. Cek `mysql -u cbi -p -h localhost portal` |
| `Not allowed by CORS` | Origin belum di whitelist. Tambahkan di `src/application/web.js:13` (`allowedOrigins`) |
| `PrismaClient did not initialize` | Belum `npx prisma generate` setelah `npm install` |
| Port 3200 dipakai | Matikan proses lama / ganti angka di `web.js:37` |
| `bcrypt` gagal install di Windows | Install Build Tools: `npm i -g windows-build-tools` atau pakai Node LTS |

## Struktur Singkat

```
src/application/web.js      # entry point, Express + WebSocket
src/application/database.js # PrismaClient
src/routes/                 # auth, download
src/controllers/            # auth, data_report, client_report, monitoring_report
prisma/schema.prisma        # mirror DB MySQL `portal`
public/export/              # file hasil export (download)
```
