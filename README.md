# Nongki — Direktori & Rekomendasi Kafe Indonesia

Nongki adalah aplikasi web untuk menemukan dan menjelajahi kafe serta kedai kopi di berbagai kota di Indonesia. Proyek ini membantu pengguna memilih tempat nongkrong, ngopi, atau kerja berdasarkan kota, suasana, fasilitas, dan status buka.

## Fitur

- **Direktori kafe lintas kota** — jelajahi daftar kafe beserta area, suasana, fasilitas, rentang harga, dan tautan lokasi.
- **Pencarian & filter** — cari kafe dan saring berdasarkan kota, status buka, serta kebutuhan seperti tempat ramah kerja.
- **Pilih Acak** — dapatkan rekomendasi kafe secara acak, termasuk opsi yang sedang buka.
- **Kafe Pilihan Hari Ini** — rekomendasi harian dari daftar kafe yang tersedia.
- **Daftar Simpan** — simpan kafe favorit di peramban untuk dibuka kembali nanti.

## Cakupan Data Saat Ini

Data awal mencakup contoh kafe di kota berikut:
- Jakarta
- Bandung
- Yogyakarta
- Surabaya
- Medan
- Makassar
- Denpasar
- Pontianak

> **Catatan:** Data kafe saat ini bersifat contoh/ilustratif dan perlu diverifikasi sebelum digunakan sebagai informasi final.

## Teknologi

- [Vite](https://vitejs.dev/) — bundler dan server pengembangan
- [TypeScript](https://www.typescriptlang.org/) — bahasa pemrograman
- CSS — styling antarmuka
- [Lenis](https://lenis.darkroom.engineering/) — gulir halus
- [Matter.js](https://brm.io/matter-js/) — animasi fisika 2D
- [Vitest](https://vitest.dev/) & [Testing Library](https://testing-library.com/) — pengujian

## Struktur Proyek

```text
.
├── public/              # Aset statis publik
├── src/
│   ├── data/            # Data dan model kafe
│   ├── lib/             # Logika bantu, filter, dan utilitas
│   ├── runtime/         # Inisialisasi dan perilaku UI runtime
│   ├── styles/          # Berkas gaya (CSS)
│   ├── vendor/          # Skrip/modul pendukung
│   ├── test/            # Pengaturan pengujian
│   ├── main.ts          # Titik masuk aplikasi
│   └── main.test.ts     # Pengujian utama
├── index.html           # Markup HTML utama
├── package.json         # Dependensi dan skrip npm
├── tsconfig*.json       # Konfigurasi TypeScript
└── vite.config.ts       # Konfigurasi Vite
```

## Prasyarat

- [Node.js](https://nodejs.org/) 18 atau lebih baru (disarankan)
- npm (terpasang bersama Node.js)

## Menjalankan Proyek

1. **Instal dependensi**
   ```bash
   npm install
   ```

2. **Jalankan mode pengembangan**
   ```bash
   npm run dev
   ```
   Buka alamat lokal yang ditampilkan di terminal (biasanya `http://localhost:5173`).

3. **Buat build produksi**
   ```bash
   npm run build
   ```
   Hasil build tersedia di folder `dist/`.

4. **Pratinjau build produksi**
   ```bash
   npm run preview
   ```

5. **Jalankan pengujian**
   ```bash
   npm run test
   ```

## Status Proyek

Proyek masih dalam pengembangan. Fokus saat ini meliputi penyempurnaan data kafe, konsistensi bahasa antarmuka, dan peningkatan pengalaman pengguna.

## Kontribusi

Kontribusi terbuka untuk perbaikan fitur, data, dan dokumentasi.

1. Fork repositori ini.
2. Buat branch fitur: `git checkout -b feat/nama-fitur`
3. Commit perubahan: `git commit -m "feat: deskripsi singkat"`
4. Push branch: `git push origin feat/nama-fitur`
5. Buka Pull Request.

## Lisensi

Proyek ini menggunakan lisensi [MIT](LICENSE).
