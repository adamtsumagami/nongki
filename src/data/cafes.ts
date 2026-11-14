/**
 * Katalog cafe & warkop Pontianak untuk Nongki.
 *
 * Catatan data:
 * - `opensAt` / `closesAt` memakai format 24 jam "HH:MM" waktu WIB.
 * - `open24` menandai tempat yang buka non-stop.
 * - `image` sengaja opsional: selama foto asli belum tersedia, kartu memakai
 *   placeholder tipografi berbasis `accentColor`.
 */

export const PONTIANAK_AREAS = [
  'Gajah Mada',
  'Hijas',
  'Reformasi',
  'Podomoro',
  'Purnama',
  'Kota Baru',
  'Siantan',
  'Pontianak Kota',
  'Lainnya',
] as const;

export type Area = (typeof PONTIANAK_AREAS)[number];

export const VIBES = [
  'WFC Friendly',
  'Cozy',
  'Aesthetic',
  'Outdoor',
  'Late Night',
  'Legendaris',
  'Nongkrong Santai',
  'Pet Friendly',
] as const;

export type Vibe = (typeof VIBES)[number];

export const FACILITIES = [
  'Wi-Fi',
  'Colokan',
  'AC',
  'Smoking Area',
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
  area: Area;
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
  {
    id: 'asiang',
    name: 'Warkop Asiang',
    tagline: 'Kopi saring legendaris tanpa baju sejak 1958',
    area: 'Gajah Mada',
    address: 'Jl. Merapi No.1, Benua Melayu Darat, Pontianak',
    vibes: ['Legendaris', 'Nongkrong Santai'],
    facilities: ['Parkir'],
    priceRange: 'Rp 8.000 - Rp 25.000',
    priceLevel: 1,
    opensAt: '04:00',
    closesAt: '13:00',
    rating: 4.8,
    reviewCount: 3420,
    featured: true,
    bestFor: 'Nongkrong pagi & sarapan kopi saring + telur setengah matang',
    description:
      'Ikon warkop legendaris Pontianak yang tersohor di nusantara. Disajikan langsung oleh Koh Asiang dengan gaya atraktif tanpa baju, meracik kopi hitam pekat dan kopi susu berbuih halus khas Pontianak.',
    menuHighlights: ['Kopi hitam saring', 'Kopi susu', 'Telur setengah matang', 'Roti bakar'],
    mapsUrl: 'https://maps.google.com/?q=Warkop+Asiang+Pontianak',
    accentColor: '#c9281e',
  },
  {
    id: 'aming-podomoro',
    name: 'Aming Coffee Podomoro',
    tagline: 'Pelopor warung kopi modern Pontianak sejak 1970',
    area: 'Podomoro',
    address: 'Jl. Karya Baru / Podomoro, Pontianak',
    vibes: ['Legendaris', 'WFC Friendly', 'Outdoor', 'Nongkrong Santai'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Smoking Area', 'Musala', 'Parkir'],
    priceRange: 'Rp 10.000 - Rp 35.000',
    priceLevel: 2,
    opensAt: '06:00',
    closesAt: '23:00',
    rating: 4.7,
    reviewCount: 2850,
    featured: true,
    bestFor: 'Kumpul santai keluarga, relasi bisnis, dan nugas',
    description:
      'Pelebaran modern dari warkop legendaris Jl. H. Abbas. Menyediakan bubuk kopi robusta racikan otentik Aming yang harum pekat, ditemani roti srikaya panggang dan pisang goreng krispi.',
    menuHighlights: ['Kopi susu Aming', 'Roti srikaya', 'Pisang goreng', 'Kopi robusta'],
    mapsUrl: 'https://maps.google.com/?q=Aming+Coffee+Podomoro+Pontianak',
    accentColor: '#3aaae0',
  },
  {
    id: 'kopi-kala',
    name: 'Kopi Kala Hijas',
    tagline: 'Suasana estetik & cozy di koridor Hijas',
    area: 'Hijas',
    address: 'Jl. Hijas No. 42, Pontianak',
    vibes: ['Aesthetic', 'WFC Friendly', 'Cozy'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Parkir'],
    priceRange: 'Rp 18.000 - Rp 45.000',
    priceLevel: 3,
    opensAt: '08:00',
    closesAt: '23:00',
    rating: 4.7,
    reviewCount: 1120,
    featured: true,
    bestFor: 'Remote work, meeting kasual, & foto estetik',
    description:
      'Salah satu pelopor coffee shop gelombang ketiga di kawasan kuliner Jl. Hijas. Interior industrial minimalis dengan bar espresso modern, Wi-Fi kencang, dan aneka kreasi artisanal coffee & pastry.',
    menuHighlights: ['Es kopi susu', 'Manual brew', 'Croissant', 'Matcha latte'],
    mapsUrl: 'https://maps.google.com/?q=Kopi+Kala+Hijas+Pontianak',
    accentColor: '#a89018',
  },
  {
    id: 'canopy-center',
    name: 'Canopy Center',
    tagline: 'Creative hub & ruang komunitas kreatif',
    area: 'Purnama',
    address: 'Jl. Purnama 2 No. 8, Pontianak Selatan',
    vibes: ['WFC Friendly', 'Outdoor', 'Aesthetic', 'Nongkrong Santai'],
    facilities: ['Wi-Fi', 'Colokan', 'Musala', 'Parkir'],
    priceRange: 'Rp 15.000 - Rp 40.000',
    priceLevel: 2,
    opensAt: '09:00',
    closesAt: '23:00',
    rating: 4.8,
    reviewCount: 980,
    featured: true,
    bestFor: 'Diskusi komunitas, WFC luar ruangan adem, & event kreatif',
    description:
      'Titik temu komunitas kreatif Pontianak. Dikelilingi pepohonan rindang dan arsitektur semi-terbuka yang sejuk, menyediakan spot nugas panjang dan menu minuman kopi yang menyegarkan.',
    menuHighlights: ['Kopi susu gula aren', 'Americano', 'French fries', 'Rice bowl'],
    mapsUrl: 'https://maps.google.com/?q=Canopy+Center+Pontianak',
    accentColor: '#2a8a4a',
  },
  {
    id: 'cw-coffee-reformasi',
    name: 'CW Coffee Reformasi',
    tagline: 'Markas WFC 24 jam andalan mahasiswa & pekerja',
    area: 'Reformasi',
    address: 'Jl. Reformasi No. 12, Pontianak Tenggara',
    vibes: ['WFC Friendly', 'Late Night'],
    facilities: ['Wi-Fi', 'Colokan', 'AC', 'Smoking Area', 'Parkir'],
    priceRange: 'Rp 15.000 - Rp 38.000',
    priceLevel: 2,
    opensAt: '00:00',
    closesAt: '00:00',
    open24: true,
    rating: 4.6,
    reviewCount: 4200,
    featured: true,
    bestFor: 'Nugas larut malam, begadang deadline, & WFC intensif',
    description:
      'Jaringan coffee shop lokal Pontianak yang buka 24 jam dengan fasilitas colokan di hampir tiap meja, kursi ergonomis, dan koneksi internet stabil. Pilihan nomor satu saat deadline tengah malam.',
    menuHighlights: ['Kopi susu CW', 'Americano', 'Chicken wings', 'Indomie'],
    mapsUrl: 'https://maps.google.com/?q=CW+Coffee+Reformasi+Pontianak',
    accentColor: '#6a4d9c',
  },
  {
    id: 'dua-cerita',
    name: 'Dua Cerita Coffee & Space',
    tagline: 'Tempat cerita & ngopi santai suasana hangat',
    area: 'Reformasi',
    address: 'Jl. Reformasi Gg. Teknik No. 5, Pontianak',
    vibes: ['Cozy', 'Outdoor', 'Nongkrong Santai'],
    facilities: ['Wi-Fi', 'Colokan', 'Parkir'],
    priceRange: 'Rp 12.000 - Rp 30.000',
    priceLevel: 2,
    opensAt: '10:00',
    closesAt: '23:30',
    rating: 4.7,
    reviewCount: 750,
    bestFor: 'Nongkrong sore, gitaran santai, & sharing bareng teman',
    description:
      'Coffee shop dengan atmosfer homy yang sangat dekat dengan kawasan kampus Untan. Tempat favorit mahasiswa untuk bertukar cerita santai sambil menikmati manual brew dan kopi susu aren terjangkau.',
    menuHighlights: ['Kopi susu aren', 'V60', 'Pisang goreng keju', 'Teh tarik'],
    mapsUrl: 'https://maps.google.com/?q=Dua+Cerita+Coffee+Pontianak',
    accentColor: '#e07a30',
  },
  {
    id: 'warkop-win-sinar-pagi',
    name: 'Warkop Win Sinar Pagi',
    tagline: 'Kopi susu mantap & roti pisang srikaya legendaris',
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
    bestFor: 'Kopi saring kental & kudapan tradisional Pontianak',
    description:
      'Warkop klasik di urat nadi Jl. Gajah Mada. Selalu ramai di pagi hari oleh obrolan warga lokal ditemani secangkir kopi hitam manis kental dan roti kukus selai srikaya legit buatan sendiri.',
    menuHighlights: ['Kopi saring', 'Roti kukus srikaya', 'Kopi susu', 'Pisang goreng'],
    mapsUrl: 'https://maps.google.com/?q=Warkop+Win+Sinar+Pagi+Pontianak',
    accentColor: '#9a9aa0',
  },
  {
    id: 'teduh-coffee',
    name: 'Teduh Coffee & Space',
    tagline: 'Ruang hijau rindang di tengah kota',
    area: 'Kota Baru',
    address: 'Jl. Gusti Hamzah No. 20, Kota Baru, Pontianak',
    vibes: ['Aesthetic', 'Outdoor', 'Cozy', 'Pet Friendly'],
    facilities: ['Wi-Fi', 'Colokan', 'Parkir'],
    priceRange: 'Rp 16.000 - Rp 42.000',
    priceLevel: 3,
    opensAt: '09:00',
    closesAt: '23:00',
    rating: 4.7,
    reviewCount: 890,
    bestFor: 'Healing sore hari, ngobrol santai, & baca buku',
    description:
      'Sesuai namanya, mengusung konsep cafe taman terbuka dengan pohon-pohon rindang dan angin sepoi-sepoi. Pilihan tepat untuk melepas penat setelah seharian beraktivitas di Pontianak.',
    menuHighlights: ['Kopi susu', 'Cold brew', 'Pasta', 'Cake'],
    mapsUrl: 'https://maps.google.com/?q=Teduh+Coffee+Pontianak',
    accentColor: '#2a8a4a',
  },
];
