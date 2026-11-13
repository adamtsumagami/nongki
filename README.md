# ☕ Nongki — Direktori & Eksplorasi Cafe Pontianak

> **Temukan spot ngopi terbaik di Kota Khatulistiwa tanpa bingung lagi mau nongkrong di mana!**

[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-In%20Development-orange)](#)
[![Location](https://img.shields.io/badge/Focus-Pontianak%2C%20Kalbar-green)](#)

---

## Tentang Nongki

**Nongki** adalah platform web direktori dan panduan eksplorasi *coffee shop* serta kafe yang berlokasi di **Kota Pontianak, Kalimantan Barat**. 

Pontianak terkenal dengan tradisi ngopinya yang begitu kental—dari deretan warkop legendaris di Jalan Gajah Mada hingga kafe-kafe modern dan *aesthetic* yang tersebar di Reformasi, Podomoro, Hijas, hingga Siantan. Namun, seringkali kita menghadapi dilema klasik: *"Mau nongkrong di mana hari ini?"* atau *"Ada rekomendasi tempat yang enak buat WFC gak?"*.

**Nongki** hadir untuk menyelesaikan masalah tersebut dengan menyajikan kurasi kafe lengkap, interaktif, dan fitur-fitur seru untuk menemani gaya hidup nongkrong masyarakat Pontianak maupun wisatawan.

---

## Fitur Unggulan

### 1. Direktori & Katalog Cafe Pontianak
* **Database Lengkap**: Jelajahi kafe dan coffee shop di berbagai kawasan Pontianak.
* **Filter Sesuai Kebutuhan**: Saring tempat berdasarkan:
  * Suasana: *Cozy, Outdoor, Work From Cafe (WFC), Aesthetic/Instagramable, Late Night*.
  * Fasilitas: *Wi-Fi kencang, banyak colokan, area merokok (smoking area), musala, live music*.
  * Kawasan/Kecamatan & rentang harga (*budget-friendly* s/d *specialty coffee*).
* **Profil Detail**: Alamat & tautan Google Maps, jam operasional, menu andalan, dan tautan media sosial.

### 2. Random Cafe Picker (*"Gacha Tongkrongan"*)
* Solusi instan untuk perdebatan abadi *"Terserah mau ke mana"*.
* Cukup tekan satu tombol, sistem akan memilihkan kafe secara acak dari database.
* Dilengkapi opsi kriteria kilat (misal: hanya kafe yang buka sekarang, punya Wi-Fi, atau dalam radius tertentu).

### 3. Cafe of the Day
* Rekomendasi harian terkurasi yang diperbarui setiap hari.
* Menyorot *hidden gem* lokal, kafe bernuansa unik, atau tempat dengan promo/menu musiman yang wajib dicoba hari ini.

### 4. Cafe Bucketlist
* **Wishlist Pribadi**: Simpan kafe-kafe menarik yang ingin dikunjungi di akhir pekan.
* **Tandai Sudah Dikunjungi**: Catat perjalanan *cafe-hopping* kamu di Pontianak.
* Tersimpan rapi di browser sehingga daftar favoritmu selalu siap diakses kapan saja.

---

## Tech Stack

Project ini dibangun menggunakan teknologi web modern untuk memastikan performa yang cepat, interaksi yang mulus, dan pengalaman pengguna yang responsif:

* **Bundler & Tooling**: [Vite](https://vitejs.dev/)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Styling**: Modern CSS / Modular Styling
* **Interactive & Animation**:
  * [Lenis](https://lenis.darkroom.engineering/) — *Smooth Scrolling Experience*
  * [Matter.js](https://brm.io/matter-js/) — *2D Physics Engine untuk animasi interaktif*
* **Testing**: [Vitest](https://vitest.dev/) & [Testing Library](https://testing-library.com/)

---

## Struktur Direktori

```text
nongki/
├── public/              # Aset statis (gambar, icon, favicon)
├── src/
│   ├── runtime/         # Konfigurasi runtime & bootstrap globals
│   ├── styles/          # File styling (base.css, fonts.css, layout)
│   ├── vendor/          # Komponen script & modul pendukung
│   ├── test/            # Setup test unit & integrasi
│   ├── main.ts          # Entry point utama TypeScript
│   └── vite-env.d.ts    # Deklarasi tipe lingkungan Vite
├── index.html           # File markup HTML utama
├── package.json         # Dependensi dan skrip npm
├── tsconfig.json        # Konfigurasi TypeScript
└── vite.config.ts       # Konfigurasi build Vite
```

---

## Memulai (Getting Started)

Ikuti langkah-langkah berikut untuk menjalankan proyek ini di komputer lokal Anda:

### Prasyarat
Pastikan Anda sudah menginstal:
* [Node.js](https://nodejs.org/) (versi 18.x atau lebih baru disarankan)
* npm (biasanya terpasang bersama Node.js) atau pnpm / yarn

### 1. Kloning Repositori
```bash
git clone https://github.com/adamtsumagami/nongki.git
cd nongki
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Jalankan Server Pengembangan
```bash
npm run dev
```
Buka browser dan akses alamat lokal yang muncul di terminal (biasanya `http://localhost:5173`).

### 4. Build untuk Produksi
```bash
npm run build
```
Hasil build siap *deploy* akan berada di dalam folder `dist/`.

### 5. Menjalankan Pengujian (Testing)
```bash
npm run test
```

---

## Roadmap Pengembangan

- [x] Inisialisasi struktur proyek dan desain tema utama
- [ ] Integrasi database katalog kafe Pontianak (alamat, jam buka, fasilitas)
- [ ] Implementasi fitur **Random Cafe Picker** interaktif
- [ ] Implementasi fitur **Cafe of the Day**
- [ ] Implementasi penyimpanan **Cafe Bucketlist** (Local Storage / Sync)
- [ ] Integrasi rute dan peta interaktif (Google Maps API / Leaflet)
- [ ] Fitur kurasi ulasan & kontribusi data kafe baru dari komunitas

---

## Berkontribusi

Punya rekomendasi *coffee shop* favorit di Pontianak atau ingin membantu menyempurnakan fitur Nongki? Kontribusi sangat terbuka!

1. *Fork* repositori ini.
2. Buat *branch* fitur baru Anda:
   ```bash
   git checkout -b feature/nama-fitur-baru
   ```
3. Lakukan *commit* perubahan:
   ```bash
   git commit -m "feat: tambah fitur random picker filter"
   ```
4. *Push* ke *branch* Anda:
   ```bash
   git push origin feature/nama-fitur-baru
   ```
5. Buka **Pull Request**.

---

## Lisensi

Proyek ini dirilis di bawah lisensi [MIT](LICENSE).

---

<p align="center">
  Dibuat dengan ☕ dan semangat anak nongkrong Pontianak.
</p>
