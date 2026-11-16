/**
 * Katalog kafe dan warung kopi Nongki untuk seluruh Indonesia.
 *
 * Catatan data:
 * - Data awal ini bersifat ilustratif dan dipakai untuk mengisi prototipe.
 *   Verifikasi ulang alamat, jam buka, dan fasilitas sebelum dipublikasikan.
 * - `opensAt` / `closesAt` memakai format 24 jam "HH:MM" menurut zona waktu
 *   kota masing-masing (WIB, WITA, atau WIT).
 * - `open24` menandai tempat yang buka non-stop.
 * - `image` sengaja opsional: selama foto asli belum tersedia, kartu memakai
 *   placeholder tipografi berbasis `accentColor`.
 */

export const CITIES = [
  'Jakarta',
  'Bandung',
  'Yogyakarta',
  'Surabaya',
  'Medan',
  'Makassar',
  'Denpasar',
  'Pontianak',
] as const;

export type City = (typeof CITIES)[number];

export type TimeZone = 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura';

export interface CityInfo {
  province: string;
  timeZone: TimeZone;
}

export const CITY_INFO: Record<City, CityInfo> = {
  Jakarta: { province: 'DKI Jakarta', timeZone: 'Asia/Jakarta' },
  Bandung: { province: 'Jawa Barat', timeZone: 'Asia/Jakarta' },
  Yogyakarta: { province: 'DI Yogyakarta', timeZone: 'Asia/Jakarta' },
  Surabaya: { province: 'Jawa Timur', timeZone: 'Asia/Jakarta' },
  Medan: { province: 'Sumatera Utara', timeZone: 'Asia/Jakarta' },
  Makassar: { province: 'Sulawesi Selatan', timeZone: 'Asia/Makassar' },
  Denpasar: { province: 'Bali', timeZone: 'Asia/Makassar' },
  Pontianak: { province: 'Kalimantan Barat', timeZone: 'Asia/Jakarta' },
};

export const TIME_ZONE_LABELS: Record<TimeZone, string> = {
  'Asia/Jakarta': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Jayapura': 'WIT',
};

export const VIBES = [
  'Ramah Kerja',
  'Nyaman',
  'Estetik',
  'Area Terbuka',
  'Buka Malam',
  'Legendaris',
  'Nongkrong Santai',
  'Ramah Hewan',
] as const;

export type Vibe = (typeof VIBES)[number];

export const FACILITIES = [
  'Wi-Fi',
  'Colokan',
  'AC',
  'Area Merokok',
  'Musala',
  'Parkir',
] as const;

export type Facility = (typeof FACILITIES)[number];

export const PRICE_LEVELS = [1, 2, 3] as const;

export type PriceLevel = (typeof PRICE_LEVELS)[number];

export const PRICE_LEVEL_LABELS: Record<PriceLevel, string> = {
  1: 'Di bawah Rp25rb',
  2: 'Rp25rb - Rp40rb',
  3: 'Di atas Rp40rb',
};

export const PRICE_LEVEL_SHORT: Record<PriceLevel, string> = {
  1: '≤ 25rb',
  2: '25-40rb',
  3: '40rb+',
};

export interface Cafe {
  id: string;
  name: string;
  tagline: string;
  city: City;
  area: string;
  address: string;
  vibes: Vibe[];
  facilities: Facility[];
  priceRange: string;
  priceLevel: PriceLevel;
  opensAt: string;
  closesAt: string;
  open24?: boolean;
  rating: number;
  reviewCount: number;
  featured?: boolean;
  bestFor: string;
  description: string;
  menuHighlights: string[];
  mapsUrl: string;
  accentColor: string;
  image?: string;
}

export const CAFES_DATA: Cafe[] = [
  /* ---------------------------------------------------------------- */
  /* Pontianak                                                        */
  /* ---------------------------------------------------------------- */
  {
    id: 'asiang',
    name: 'Warkop Asiang',
    tagline: 'Kopi saring legendaris tanpa baju sejak 1958',
    city: 'Pontianak',
    area: 'Gajah Mada',
    address: 'Jl. Merapi No. 1, Benua Melayu Darat, Pontianak',
    vibes: ['Legendaris', 'Nongkrong Santai'],
    facilities: ['Parkir'],
    priceRange: 'Rp 8.000 - Rp 25.000',
    priceLevel: 1,
    opensAt: '04:00',
    closesAt: '13:00',
    rating: 4.8,
    reviewCount: 3420,
    featured: true,
    bestFor: 'Nongkrong pagi, sarapan, dan kopi saring',
    description:
      'Ikon warung kopi legendaris Pontianak yang tersohor di nusantara. Disajikan langsung oleh Koh Asiang dengan gaya atraktif, meracik kopi hitam pekat dan kopi susu berbuih halus khas Pontianak.',
    menuHighlights: ['Kopi hitam saring', 'Kopi susu', 'Telur setengah matang', 'Roti bakar'],
    mapsUrl: 'https://maps.google.com/?q=Warkop+Asiang+Pontianak',
    accentColor: '#c9281e',
  },
  {
    id: 'aming-podomoro',
    name: 'Aming Coffee Podomoro',
    tagline: 'Pelopor warung kopi modern Pontianak sejak 1970',
    city: 'Pontianak',
    area: 'Podomoro',
    address: 'Jl. Karya Baru / Podomoro, Pontianak',
    vibes: ['Legendaris', 'Ramah Kerja', 'Area Terbuka', 'Nongkrong Santai'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Area Merokok', 'Musala', 'Parkir'],
    priceRange: 'Rp 10.000 - Rp 35.000',
    priceLevel: 2,
    opensAt: '06:00',
    closesAt: '23:00',
    rating: 4.7,
    reviewCount: 2850,
    featured: true,
    bestFor: 'Kumpul keluarga, diskusi, dan kerja santai',
    description:
      'Pelebaran modern dari warung kopi legendaris Jl. H. Abbas. Menyediakan bubuk kopi robusta racikan otentik Aming yang harum pekat, ditemani roti srikaya panggang dan pisang goreng krispi.',
    menuHighlights: ['Kopi susu Aming', 'Roti srikaya', 'Pisang goreng', 'Kopi robusta'],
    mapsUrl: 'https://maps.google.com/?q=Aming+Coffee+Podomoro+Pontianak',
    accentColor: '#3aaae0',
  },
  {
    id: 'kopi-kala',
    name: 'Kopi Kala Hijas',
    tagline: 'Suasana estetik dan nyaman di koridor Hijas',
    city: 'Pontianak',
    area: 'Hijas',
    address: 'Jl. Hijas No. 42, Pontianak',
    vibes: ['Estetik', 'Ramah Kerja', 'Nyaman'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Parkir'],
    priceRange: 'Rp 18.000 - Rp 45.000',
    priceLevel: 3,
    opensAt: '08:00',
    closesAt: '23:00',
    rating: 4.7,
    reviewCount: 1120,
    featured: true,
    bestFor: 'Kerja jarak jauh, rapat santai, dan foto',
    description:
      'Salah satu pelopor kedai kopi gelombang ketiga di kawasan kuliner Jl. Hijas. Interior industrial minimalis dengan bar espresso modern, Wi-Fi kencang, dan aneka kreasi kopi serta kudapan.',
    menuHighlights: ['Es kopi susu', 'Seduh manual', 'Croissant', 'Latte matcha'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Kala+Hijas+Pontianak',
    accentColor: '#a89018',
  },
  {
    id: 'canopy-center',
    name: 'Canopy Center',
    tagline: 'Ruang komunitas kreatif dengan taman terbuka',
    city: 'Pontianak',
    area: 'Purnama',
    address: 'Jl. Purnama 2 No. 8, Pontianak Selatan',
    vibes: ['Ramah Kerja', 'Area Terbuka', 'Estetik', 'Nongkrong Santai'],
    facilities: ['Wi-Fi', 'Colokan', 'Musala', 'Parkir'],
    priceRange: 'Rp 15.000 - Rp 40.000',
    priceLevel: 2,
    opensAt: '09:00',
    closesAt: '23:00',
    rating: 4.8,
    reviewCount: 980,
    featured: true,
    bestFor: 'Diskusi komunitas, kerja di luar ruangan, dan acara kreatif',
    description:
      'Titik temu komunitas kreatif Pontianak. Dikelilingi pepohonan rindang dan arsitektur semi-terbuka yang sejuk, tersedia meja panjang untuk bekerja dan menu kopi yang menyegarkan.',
    menuHighlights: ['Kopi susu gula aren', 'Americano', 'Kentang goreng', 'Nasi ayam'],
    mapsUrl: 'https://maps.google.com/?q=Canopy+Center+Pontianak',
    accentColor: '#2a8a4a',
  },
  {
    id: 'cw-coffee-reformasi',
    name: 'CW Coffee Reformasi',
    tagline: 'Markas kerja 24 jam andalan mahasiswa dan pekerja',
    city: 'Pontianak',
    area: 'Reformasi',
    address: 'Jl. Reformasi No. 12, Pontianak Tenggara',
    vibes: ['Ramah Kerja', 'Buka Malam'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Area Merokok', 'Parkir'],
    priceRange: 'Rp 15.000 - Rp 38.000',
    priceLevel: 2,
    opensAt: '00:00',
    closesAt: '00:00',
    open24: true,
    rating: 4.6,
    reviewCount: 4200,
    featured: true,
    bestFor: 'Kerja larut malam, mengejar tenggat, dan belajar',
    description:
      'Jaringan kedai kopi lokal Pontianak yang buka 24 jam dengan colokan di hampir tiap meja, kursi ergonomis, dan koneksi internet stabil. Pilihan utama saat tenggat mengejar.',
    menuHighlights: ['Kopi susu CW', 'Americano', 'Sayap ayam', 'Mi instan'],
    mapsUrl: 'https://maps.google.com/?q=CW+Coffee+Reformasi+Pontianak',
    accentColor: '#6a4d9c',
  },
  {
    id: 'dua-cerita',
    name: 'Dua Cerita Coffee & Space',
    tagline: 'Tempat bercerita dan ngopi dengan suasana hangat',
    city: 'Pontianak',
    area: 'Reformasi',
    address: 'Jl. Reformasi Gg. Teknik No. 5, Pontianak',
    vibes: ['Nyaman', 'Area Terbuka', 'Nongkrong Santai'],
    facilities: ['Wi-Fi', 'Colokan', 'Parkir'],
    priceRange: 'Rp 12.000 - Rp 30.000',
    priceLevel: 2,
    opensAt: '10:00',
    closesAt: '23:30',
    rating: 4.7,
    reviewCount: 750,
    bestFor: 'Nongkrong sore, bermain musik, dan berbagi cerita',
    description:
      'Kedai kopi dengan atmosfer hangat yang sangat dekat dengan kawasan kampus Untan. Tempat favorit mahasiswa untuk bertukar cerita sambil menikmati seduh manual dan kopi susu aren terjangkau.',
    menuHighlights: ['Kopi susu aren', 'V60', 'Pisang goreng keju', 'Teh tarik'],
    mapsUrl: 'https://maps.google.com/?q=Dua+Cerita+Coffee+Pontianak',
    accentColor: '#e07a30',
  },
  {
    id: 'warkop-win-sinar-pagi',
    name: 'Warkop Win Sinar Pagi',
    tagline: 'Kopi susu mantap dan roti srikaya legendaris',
    city: 'Pontianak',
    area: 'Gajah Mada',
    address: 'Jl. Gajah Mada No. 38, Pontianak',
    vibes: ['Legendaris', 'Nongkrong Santai'],
    facilities: ['Parkir'],
    priceRange: 'Rp 7.000 - Rp 22.000',
    priceLevel: 1,
    opensAt: '05:00',
    closesAt: '18:00',
    rating: 4.6,
    reviewCount: 1650,
    bestFor: 'Kopi saring kental dan kudapan tradisional',
    description:
      'Warung kopi klasik di urat nadi Jl. Gajah Mada. Selalu ramai pada pagi hari oleh obrolan warga lokal, ditemani secangkir kopi hitam manis kental dan roti kukus selai srikaya buatan sendiri.',
    menuHighlights: ['Kopi saring', 'Roti kukus srikaya', 'Kopi susu', 'Pisang goreng'],
    mapsUrl: 'https://maps.google.com/?q=Warkop+Win+Sinar+Pagi+Pontianak',
    accentColor: '#9a9aa0',
  },
  {
    id: 'teduh-coffee',
    name: 'Teduh Coffee & Space',
    tagline: 'Ruang hijau rindang di tengah kota',
    city: 'Pontianak',
    area: 'Kota Baru',
    address: 'Jl. Gusti Hamzah No. 20, Kota Baru, Pontianak',
    vibes: ['Estetik', 'Area Terbuka', 'Nyaman', 'Ramah Hewan'],
    facilities: ['Wi-Fi', 'Colokan', 'Parkir'],
    priceRange: 'Rp 16.000 - Rp 42.000',
    priceLevel: 3,
    opensAt: '09:00',
    closesAt: '23:00',
    rating: 4.7,
    reviewCount: 890,
    bestFor: 'Beristirahat sore hari, mengobrol, dan membaca buku',
    description:
      'Sesuai namanya, mengusung konsep kafe taman terbuka dengan pepohonan rindang dan angin sepoi-sepoi. Pilihan tepat untuk melepas penat setelah seharian beraktivitas.',
    menuHighlights: ['Kopi susu', 'Kopi seduh dingin', 'Pasta', 'Kue'],
    mapsUrl: 'https://maps.google.com/?q=Teduh+Coffee+Pontianak',
    accentColor: '#2a8a4a',
  },

  /* ---------------------------------------------------------------- */
  /* Jakarta                                                          */
  /* ---------------------------------------------------------------- */
  {
    id: 'anomali-kemang',
    name: 'Anomali Coffee Kemang',
    tagline: 'Kopi spesialti Indonesia dengan suasana hangat',
    city: 'Jakarta',
    area: 'Kemang',
    address: 'Jl. Kemang Raya No. 17, Jakarta Selatan',
    vibes: ['Ramah Kerja', 'Nyaman', 'Estetik'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Area Merokok', 'Parkir'],
    priceRange: 'Rp 30.000 - Rp 60.000',
    priceLevel: 3,
    opensAt: '07:00',
    closesAt: '22:00',
    rating: 4.7,
    reviewCount: 2100,
    featured: true,
    bestFor: 'Kerja jarak jauh, rapat, dan ngopi santai',
    description:
      'Kedai kopi spesialti yang mengangkat biji kopi dari berbagai daerah di Indonesia. Ruangannya lapang, nyaman untuk bekerja, dan menunya menjelaskan asal biji dengan jelas.',
    menuHighlights: ['Es kopi susu', 'Seduh manual', 'Croissant', 'Kopi single origin'],
    mapsUrl: 'https://maps.google.com/?q=Anomali+Coffee+Kemang',
    accentColor: '#3aaae0',
  },
  {
    id: 'giyanti-menteng',
    name: 'Giyanti Coffee Roastery',
    tagline: 'Rumah sangrai kopi di jantung Menteng',
    city: 'Jakarta',
    area: 'Menteng',
    address: 'Jl. Surabaya No. 20, Menteng, Jakarta Pusat',
    vibes: ['Nyaman', 'Estetik', 'Nongkrong Santai'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Parkir'],
    priceRange: 'Rp 35.000 - Rp 70.000',
    priceLevel: 3,
    opensAt: '08:00',
    closesAt: '21:00',
    rating: 4.8,
    reviewCount: 1300,
    bestFor: 'Menikmati kopi sangrai sendiri dan mengobrol santai',
    description:
      'Kedai sekaligus rumah sangrai kopi yang tenang di Menteng. Cocok untuk mencicipi racikan biji pilihan, belajar soal sangrai, atau sekadar membaca buku di sore hari.',
    menuHighlights: ['Seduh manual', 'Espresso', 'Kopi susu', 'Kue mentega'],
    mapsUrl: 'https://maps.google.com/?q=Giyanti+Coffee+Roastery+Menteng',
    accentColor: '#2a8a4a',
  },

  /* ---------------------------------------------------------------- */
  /* Bandung                                                          */
  /* ---------------------------------------------------------------- */
  {
    id: 'kopi-toko-djawa',
    name: 'Kopi Toko Djawa',
    tagline: 'Kopi susu klasik di koridor Braga',
    city: 'Bandung',
    area: 'Braga',
    address: 'Jl. Braga No. 61, Bandung',
    vibes: ['Estetik', 'Nyaman', 'Nongkrong Santai'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Parkir'],
    priceRange: 'Rp 20.000 - Rp 45.000',
    priceLevel: 2,
    opensAt: '08:00',
    closesAt: '22:00',
    rating: 4.7,
    reviewCount: 1800,
    featured: true,
    bestFor: 'Ngopi sore, foto, dan jalan-jalan di Braga',
    description:
      'Kedai kopi dengan nuansa klasik di kawasan Braga. Menyajikan kopi susu dan camilan yang akrab di lidah, dengan interior kayu yang hangat dan lokasi yang mudah dijangkau.',
    menuHighlights: ['Kopi susu', 'Es kopi susu', 'Roti bakar', 'Pisang goreng'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Toko+Djawa+Braga+Bandung',
    accentColor: '#a89018',
  },
  {
    id: 'kopi-cimol-dago',
    name: 'Kopi Cimol Dago',
    tagline: 'Ngopi santai ditemani camilan khas',
    city: 'Bandung',
    area: 'Dago',
    address: 'Jl. Ir. H. Juanda No. 120, Dago, Bandung',
    vibes: ['Nongkrong Santai', 'Area Terbuka'],
    facilities: ['Wi-Fi', 'Parkir', 'Area Merokok'],
    priceRange: 'Rp 12.000 - Rp 30.000',
    priceLevel: 1,
    opensAt: '09:00',
    closesAt: '23:00',
    rating: 4.5,
    reviewCount: 900,
    bestFor: 'Kumpul santai, camilan, dan ngobrol panjang',
    description:
      'Tempat ngopi sederhana di Dago dengan area terbuka dan menu camilan yang ramah kantong. Sering jadi titik kumpul mahasiswa dan warga sekitar pada malam hari.',
    menuHighlights: ['Kopi susu', 'Cimol', 'Teh manis', 'Pisang goreng'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Cimol+Dago+Bandung',
    accentColor: '#e07a30',
  },

  /* ---------------------------------------------------------------- */
  /* Yogyakarta                                                       */
  /* ---------------------------------------------------------------- */
  {
    id: 'kopi-klotok',
    name: 'Kopi Klotok',
    tagline: 'Kopi kampung dengan pemandangan hijau',
    city: 'Yogyakarta',
    area: 'Kaliurang',
    address: 'Jl. Kaliurang KM 16, Pakem, Sleman, Yogyakarta',
    vibes: ['Legendaris', 'Area Terbuka', 'Nongkrong Santai'],
    facilities: ['Parkir', 'Musala', 'Area Merokok'],
    priceRange: 'Rp 10.000 - Rp 25.000',
    priceLevel: 1,
    opensAt: '06:00',
    closesAt: '20:00',
    rating: 4.7,
    reviewCount: 3200,
    featured: true,
    bestFor: 'Sarapan, suasana pedesaan, dan jalan-jalan pagi',
    description:
      'Warung kopi di lereng Kaliurang yang dikenal dengan suasana kampung dan pemandangan hijau. Menu kopi dan gorengan sederhana disajikan dengan pemandangan yang menyegarkan.',
    menuHighlights: ['Kopi klotok', 'Pisang goreng', 'Tahu tempe', 'Teh manis'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Klotok+Kaliurang',
    accentColor: '#2a8a4a',
  },
  {
    id: 'kopi-joss-lik-man',
    name: 'Kopi Joss Lik Man',
    tagline: 'Kopi arang legendaris khas Yogyakarta',
    city: 'Yogyakarta',
    area: 'Gedongkiwo',
    address: 'Jl. Gedongkiwo, Mantrijeron, Yogyakarta',
    vibes: ['Legendaris', 'Buka Malam', 'Area Terbuka'],
    facilities: ['Parkir', 'Area Merokok'],
    priceRange: 'Rp 8.000 - Rp 20.000',
    priceLevel: 1,
    opensAt: '17:00',
    closesAt: '02:00',
    rating: 4.6,
    reviewCount: 1500,
    bestFor: 'Ngopi malam dan mencoba kopi arang',
    description:
      'Warung kopi malam yang terkenal dengan kopi joss, yaitu kopi panas yang diberi arang membara. Rasanya unik, suasananya ramai, dan cocok untuk ngobrol sampai larut.',
    menuHighlights: ['Kopi joss', 'Kopi susu', 'Gorengan', 'Indomie'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Joss+Lik+Man+Yogyakarta',
    accentColor: '#c9281e',
  },

  /* ---------------------------------------------------------------- */
  /* Surabaya                                                         */
  /* ---------------------------------------------------------------- */
  {
    id: 'kopi-tugu-darmo',
    name: 'Kopi Tugu Darmo',
    tagline: 'Kopi lokal dengan ruang kerja yang nyaman',
    city: 'Surabaya',
    area: 'Darmo',
    address: 'Jl. Raya Darmo No. 68, Surabaya',
    vibes: ['Ramah Kerja', 'Nyaman', 'Estetik'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Parkir'],
    priceRange: 'Rp 20.000 - Rp 40.000',
    priceLevel: 2,
    opensAt: '07:00',
    closesAt: '22:00',
    rating: 4.6,
    reviewCount: 1100,
    bestFor: 'Kerja, belajar, dan ngopi bersama teman',
    description:
      'Kedai kopi dengan ruang kerja yang tertata dan colokan di banyak meja. Menyajikan kopi susu serta menu pendamping yang cocok untuk sesi kerja panjang.',
    menuHighlights: ['Kopi susu', 'Americano', 'Roti bakar', 'Nasi goreng'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Tugu+Darmo+Surabaya',
    accentColor: '#3aaae0',
  },
  {
    id: 'zangrandi-surabaya',
    name: 'Zangrandi Coffee & Ice Cream',
    tagline: 'Kedai es krim dan kopi yang sudah lama berdiri',
    city: 'Surabaya',
    area: 'Genteng',
    address: 'Jl. Yos Sudarso No. 15, Genteng, Surabaya',
    vibes: ['Legendaris', 'Nyaman', 'Nongkrong Santai'],
    facilities: ['AC', 'Parkir', 'Musala'],
    priceRange: 'Rp 20.000 - Rp 45.000',
    priceLevel: 2,
    opensAt: '08:00',
    closesAt: '22:00',
    rating: 4.6,
    reviewCount: 2400,
    bestFor: 'Kumpul keluarga, es krim, dan suasana klasik',
    description:
      'Tempat legendaris di Surabaya yang menyajikan es krim dan kopi dengan suasana lama yang tetap terjaga. Cocok untuk berhenti sejenak saat berjalan-jalan di pusat kota.',
    menuHighlights: ['Es krim', 'Kopi susu', 'Roti bakar', 'Es campur'],
    mapsUrl: 'https://maps.google.com/?q=Zangrandi+Surabaya',
    accentColor: '#9a9aa0',
  },

  /* ---------------------------------------------------------------- */
  /* Medan                                                            */
  /* ---------------------------------------------------------------- */
  {
    id: 'warkop-apek-kesawan',
    name: 'Warung Kopi Apek',
    tagline: 'Warung kopi legendaris di Kesawan',
    city: 'Medan',
    area: 'Kesawan',
    address: 'Jl. Kesawan No. 15, Medan',
    vibes: ['Legendaris', 'Nongkrong Santai'],
    facilities: ['Parkir', 'Area Merokok'],
    priceRange: 'Rp 7.000 - Rp 20.000',
    priceLevel: 1,
    opensAt: '07:00',
    closesAt: '22:00',
    rating: 4.6,
    reviewCount: 2600,
    featured: true,
    bestFor: 'Kopi susu kental, roti bakar, dan ngobrol pagi',
    description:
      'Warung kopi tua di kawasan Kesawan yang tetap ramai hingga kini. Kopi susunya kental dan manis, disajikan bersama roti bakar dan obrolan warga kota.',
    menuHighlights: ['Kopi susu', 'Roti bakar', 'Kopi hitam', 'Telur setengah matang'],
    mapsUrl: 'https://maps.google.com/?q=Warung+Kopi+Apek+Kesawan+Medan',
    accentColor: '#c9281e',
  },
  {
    id: 'kopi-kito-medan',
    name: 'Kopi Kito',
    tagline: 'Kopi susu kekinian di pusat kota',
    city: 'Medan',
    area: 'Merdeka Walk',
    address: 'Jl. Balai Kota No. 1, Medan',
    vibes: ['Ramah Kerja', 'Estetik', 'Nyaman'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Parkir'],
    priceRange: 'Rp 18.000 - Rp 38.000',
    priceLevel: 2,
    opensAt: '10:00',
    closesAt: '23:00',
    rating: 4.5,
    reviewCount: 800,
    bestFor: 'Nongkrong malam, kerja ringan, dan foto',
    description:
      'Kedai kopi modern di kawasan Merdeka Walk dengan ruang ber-AC dan area duduk yang nyaman. Menyajikan kopi susu serta minuman kekinian untuk menemani malam di kota.',
    menuHighlights: ['Es kopi susu', 'Latte', 'Kentang goreng', 'Donat'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Kito+Medan',
    accentColor: '#6a4d9c',
  },

  /* ---------------------------------------------------------------- */
  /* Makassar                                                         */
  /* ---------------------------------------------------------------- */
  {
    id: 'kopi-daeng-losari',
    name: 'Kopi Daeng',
    tagline: 'Ngopi santai dekat pantai Losari',
    city: 'Makassar',
    area: 'Losari',
    address: 'Jl. Penghibur No. 10, Losari, Makassar',
    vibes: ['Nyaman', 'Nongkrong Santai', 'Ramah Kerja'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Parkir'],
    priceRange: 'Rp 15.000 - Rp 35.000',
    priceLevel: 2,
    opensAt: '08:00',
    closesAt: '23:00',
    rating: 4.6,
    reviewCount: 950,
    bestFor: 'Ngopi sore, kerja ringan, dan melihat laut',
    description:
      'Kedai kopi dekat kawasan Losari dengan ruang duduk yang nyaman. Setelah ngopi, kamu bisa langsung berjalan kaki menikmati angin laut dan matahari terbenam.',
    menuHighlights: ['Kopi susu', 'Es kopi susu', 'Pisang goreng', 'Nasi goreng'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Daeng+Losari+Makassar',
    accentColor: '#3aaab8',
  },
  {
    id: 'warkop-phinisi',
    name: 'Warung Kopi Phinisi',
    tagline: 'Warung kopi terbuka menghadap laut',
    city: 'Makassar',
    area: 'Pantai Losari',
    address: 'Jl. Metro Tanjung Bunga, Makassar',
    vibes: ['Area Terbuka', 'Nongkrong Santai', 'Buka Malam'],
    facilities: ['Parkir', 'Area Merokok', 'Musala'],
    priceRange: 'Rp 10.000 - Rp 28.000',
    priceLevel: 1,
    opensAt: '07:00',
    closesAt: '00:00',
    rating: 4.5,
    reviewCount: 1200,
    bestFor: 'Ngopi malam, menikmati angin laut, dan kumpul',
    description:
      'Warung kopi dengan area terbuka yang menghadap ke arah laut. Tempat yang ramai pada malam hari, cocok untuk ngobrol santai sambil menikmati suasana pesisir.',
    menuHighlights: ['Kopi susu', 'Kopi hitam', 'Pisang goreng', 'Jagung bakar'],
    mapsUrl: 'https://maps.google.com/?q=Warung+Kopi+Phinisi+Makassar',
    accentColor: '#e07a30',
  },

  /* ---------------------------------------------------------------- */
  /* Denpasar                                                         */
  /* ---------------------------------------------------------------- */
  {
    id: 'bali-buda-renon',
    name: 'Bali Buda Renon',
    tagline: 'Kafe sehat dengan taman yang asri',
    city: 'Denpasar',
    area: 'Renon',
    address: 'Jl. Raya Puputan No. 21, Renon, Denpasar',
    vibes: ['Nyaman', 'Ramah Hewan', 'Area Terbuka'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Parkir'],
    priceRange: 'Rp 25.000 - Rp 55.000',
    priceLevel: 2,
    opensAt: '07:00',
    closesAt: '21:00',
    rating: 4.7,
    reviewCount: 1400,
    featured: true,
    bestFor: 'Sarapan sehat, kerja santai, dan bawa hewan peliharaan',
    description:
      'Kafe dengan taman hijau dan menu yang menekankan bahan segar. Suasananya tenang, ramah untuk hewan peliharaan, dan cocok untuk sarapan atau kerja ringan.',
    menuHighlights: ['Kopi Bali', 'Jus buah', 'Roti gandum', 'Salad'],
    mapsUrl: 'https://maps.google.com/?q=Bali+Buda+Renon+Denpasar',
    accentColor: '#2a8a4a',
  },
  {
    id: 'kopi-kintamani-renon',
    name: 'Kopi Kintamani Renon',
    tagline: 'Kopi Bali dengan suasana tropis',
    city: 'Denpasar',
    area: 'Renon',
    address: 'Jl. Cok Agung Tresna No. 8, Denpasar',
    vibes: ['Estetik', 'Area Terbuka', 'Nongkrong Santai'],
    facilities: ['Wi-Fi', 'Parkir', 'Area Merokok'],
    priceRange: 'Rp 18.000 - Rp 40.000',
    priceLevel: 2,
    opensAt: '08:00',
    closesAt: '22:00',
    rating: 4.6,
    reviewCount: 700,
    bestFor: 'Ngopi santai, foto, dan menikmati sore',
    description:
      'Kedai kopi yang mengangkat biji kopi Kintamani dengan area terbuka dan tanaman hijau. Tempat yang nyaman untuk berhenti sejenak di tengah kesibukan kota.',
    menuHighlights: ['Kopi Kintamani', 'Es kopi susu', 'Pisang goreng', 'Kue kelapa'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Kintamani+Renon+Denpasar',
    accentColor: '#a89018',
  },
];
