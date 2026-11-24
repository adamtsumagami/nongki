import { describe, expect, it } from 'vitest';
import {
  CAFES_DATA,
  CITIES,
  CITY_INFO,
  FACILITIES,
  PRICE_LEVELS,
  VIBES,
  type Cafe,
} from '../data/cafes';
import {
  SEMUA_KOTA,
  buildCafeShareUrl,
  distanceKm,
  filterCafes,
  findNearestCafe,
  formatBucketlistShareText,
  formatCafeShareText,
  formatDistanceKm,
  formatHours,
  getAreasForCity,
  getCafeOfTheDay,
  getInitials,
  getLocalDateKey,
  getLocalMinutes,
  getOpenStatus,
  isOpenAt,
  parseCatalogSearchParams,
  pickRandomCafe,
  serializeCatalogSearchParams,
  sortCafes,
} from './cafes';

/** 14 Nov 2026, 10:00 WIB / 11:00 WITA. */
const AT_10_WIB = new Date('2026-11-14T03:00:00Z');
/** 14 Nov 2026, 23:00 WIB / 00:00 WITA. */
const AT_23_WIB = new Date('2026-11-14T16:00:00Z');

const overnight: Cafe = {
  ...CAFES_DATA[0],
  id: 'overnight-test',
  name: 'Kafe Tengah Malam',
  opensAt: '18:00',
  closesAt: '01:00',
  open24: false,
};

describe('waktu lokal per zona', () => {
  it('menghitung jam WIB dari timestamp UTC', () => {
    expect(getLocalMinutes(AT_10_WIB)).toBe(10 * 60);
    expect(getLocalDateKey(AT_10_WIB)).toBe('2026-11-14');
  });

  it('memakai WIB walau zona waktu perangkat berbeda', () => {
    // 17:30 UTC = 00:30 WIB tanggal berikutnya.
    const date = new Date('2026-11-14T17:30:00Z');
    expect(getLocalMinutes(date)).toBe(30);
    expect(getLocalDateKey(date)).toBe('2026-11-15');
  });

  it('mendukung WITA untuk kota di Indonesia tengah', () => {
    // 00:30 UTC = 07:30 WIB = 08:30 WITA.
    const date = new Date('2026-11-14T00:30:00Z');
    expect(getLocalMinutes(date, 'Asia/Makassar')).toBe(8 * 60 + 30);
    expect(getLocalDateKey(date, 'Asia/Makassar')).toBe('2026-11-14');

    // 17:30 UTC = 01:30 WITA tanggal berikutnya.
    const late = new Date('2026-11-14T17:30:00Z');
    expect(getLocalMinutes(late, 'Asia/Makassar')).toBe(90);
    expect(getLocalDateKey(late, 'Asia/Makassar')).toBe('2026-11-15');
  });
});

describe('jam operasional', () => {
  it('mengenali kafe yang sedang buka dan tutup', () => {
    const asiang = CAFES_DATA.find((cafe) => cafe.id === 'warung-kopi-asiang')!;
    expect(isOpenAt(asiang, AT_10_WIB)).toBe(true);
    expect(isOpenAt(asiang, AT_23_WIB)).toBe(false);
    expect(getOpenStatus(asiang, AT_10_WIB)).toEqual({ open: true, label: 'Buka sekarang' });
  });

  it('memakai zona waktu kota masing-masing', () => {
    const makassar = CAFES_DATA.find((cafe) => cafe.id === 'kopi-daeng-losari')!;
    // 07:30 WIB sudah 08:30 WITA, jadi kafe Makassar sudah buka.
    const pagi = new Date('2026-11-14T00:30:00Z');
    expect(isOpenAt(makassar, pagi)).toBe(true);
    // 23:30 WIB sudah 00:30 WITA, kafe sudah tutup.
    const malam = new Date('2026-11-14T16:30:00Z');
    expect(isOpenAt(makassar, malam)).toBe(false);
  });

  it('mendukung kafe 24 jam', () => {
    const open24Cafe = CAFES_DATA.find((cafe) => cafe.id === 'warung-kopi-djaja')!;
    expect(isOpenAt(open24Cafe, AT_23_WIB)).toBe(true);
    expect(isOpenAt(open24Cafe, new Date('2026-11-14T20:00:00Z'))).toBe(true);
    expect(formatHours(open24Cafe)).toBe('Buka 24 jam');
  });

  it('mendukung jam operasional yang melewati tengah malam', () => {
    expect(isOpenAt(overnight, AT_23_WIB)).toBe(true);
    // 00:30 WIB
    expect(isOpenAt(overnight, new Date('2026-11-14T17:30:00Z'))).toBe(true);
    // 02:00 WIB
    expect(isOpenAt(overnight, new Date('2026-11-14T19:00:00Z'))).toBe(false);
  });

  it('menampilkan label zona waktu pada jam buka', () => {
    const asiang = CAFES_DATA.find((cafe) => cafe.id === 'warung-kopi-asiang')!;
    expect(formatHours(asiang)).toBe('04:00 - 18:00 WIB');

    const makassar = CAFES_DATA.find((cafe) => cafe.id === 'kopi-daeng-losari')!;
    expect(formatHours(makassar)).toBe('08:00 - 23:00 WITA');
  });
});

describe('filter katalog', () => {
  it('menyaring berdasarkan kota', () => {
    const result = filterCafes(CAFES_DATA, { city: 'Bandung' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((cafe) => cafe.city === 'Bandung')).toBe(true);
  });

  it('label "Semua Kota" tidak menyaring apa pun', () => {
    expect(filterCafes(CAFES_DATA, { city: SEMUA_KOTA })).toHaveLength(CAFES_DATA.length);
  });

  it('menerapkan beberapa suasana sekaligus (AND)', () => {
    const result = filterCafes(CAFES_DATA, { vibes: ['Ramah Kerja', 'Estetik'] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((cafe) => cafe.vibes.includes('Ramah Kerja'))).toBe(true);
    expect(result.every((cafe) => cafe.vibes.includes('Estetik'))).toBe(true);
  });

  it('menerapkan fasilitas dan pencarian teks', () => {
    const result = filterCafes(CAFES_DATA, { facilities: ['Wi-Fi', 'Colokan'] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((cafe) => cafe.facilities.includes('Wi-Fi'))).toBe(true);

    const searched = filterCafes(CAFES_DATA, { query: 'asiang' });
    expect(searched.length).toBeGreaterThan(0);
    expect(searched.every((cafe) => cafe.name.toLowerCase().includes('asiang'))).toBe(true);
  });

  it('menyaring kafe yang buka sekarang', () => {
    const result = filterCafes(CAFES_DATA, { openNow: true, now: AT_10_WIB });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((cafe) => isOpenAt(cafe, AT_10_WIB))).toBe(true);
  });

  it('menggabungkan level harga sebagai OR', () => {
    const result = filterCafes(CAFES_DATA, { priceLevels: [1, 3] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((cafe) => cafe.priceLevel === 1 || cafe.priceLevel === 3)).toBe(true);
  });
});

describe('Kafe Pilihan Hari Ini', () => {
  it('deterministik pada hari yang sama', () => {
    const morning = getCafeOfTheDay(CAFES_DATA, AT_10_WIB);
    const night = getCafeOfTheDay(CAFES_DATA, AT_23_WIB);
    expect(morning?.id).toBe(night?.id);
  });

  it('berganti pada hari berikutnya', () => {
    const today = getCafeOfTheDay(CAFES_DATA, AT_10_WIB);
    const tomorrow = getCafeOfTheDay(CAFES_DATA, new Date('2026-11-15T03:00:00Z'));
    expect(today).toBeDefined();
    expect(tomorrow).toBeDefined();
    expect(today?.id).not.toBe(tomorrow?.id);
  });

  it('aman untuk daftar kosong', () => {
    expect(getCafeOfTheDay([])).toBeUndefined();
  });
});

describe('pemilih acak', () => {
  it('menghindari hasil yang sama jika diminta', () => {
    const first = CAFES_DATA[0];
    const result = pickRandomCafe(CAFES_DATA, { excludeId: first.id, random: () => 0 });
    expect(result).toBeDefined();
    expect(result?.id).not.toBe(first.id);
  });

  it('memakai angka acak yang disuntikkan', () => {
    expect(pickRandomCafe(CAFES_DATA, { random: () => 0 })?.id).toBe(CAFES_DATA[0].id);
    expect(pickRandomCafe(CAFES_DATA, { random: () => 0.999 })?.id).toBe(
      CAFES_DATA[CAFES_DATA.length - 1].id,
    );
  });

  it('mengembalikan undefined untuk daftar kosong', () => {
    expect(pickRandomCafe([], { random: () => 0.5 })).toBeUndefined();
  });
});

describe('utilitas tampilan', () => {
  it('membuat inisial dari nama kafe', () => {
    expect(getInitials('Warkop Senja Pagi')).toBe('WS');
    expect(getInitials('Canopy')).toBe('CA');
    expect(getInitials('Kopi Bersama Kita')).toBe('KB');
  });
});

describe('urutkan katalog', () => {
  it('mengurutkan berdasarkan buka dulu, rating tertinggi, harga termurah, dan nama A-Z', () => {
    const sample = CAFES_DATA.slice(0, 8);
    const snapshot = sample.map((cafe) => cafe.id);

    const byDefault = sortCafes(sample, 'default', AT_23_WIB);
    expect(byDefault.map((c) => c.id)).toEqual(snapshot);

    const byOpen = sortCafes(sample, 'open', AT_23_WIB);
    const firstClosedIndex = byOpen.findIndex((c) => !isOpenAt(c, AT_23_WIB));
    if (firstClosedIndex > -1) {
      expect(byOpen.slice(0, firstClosedIndex).every((c) => isOpenAt(c, AT_23_WIB))).toBe(true);
      expect(byOpen.slice(firstClosedIndex).every((c) => !isOpenAt(c, AT_23_WIB))).toBe(true);
    }

    const byRating = sortCafes(sample, 'rating');
    for (let i = 1; i < byRating.length; i++) {
      expect(byRating[i - 1].rating).toBeGreaterThanOrEqual(byRating[i].rating);
    }

    const byPrice = sortCafes(sample, 'price-asc');
    for (let i = 1; i < byPrice.length; i++) {
      expect(byPrice[i - 1].priceLevel).toBeLessThanOrEqual(byPrice[i].priceLevel);
    }

    const byName = sortCafes(sample, 'name');
    for (let i = 1; i < byName.length; i++) {
      expect(byName[i - 1].name.localeCompare(byName[i].name, 'id')).toBeLessThanOrEqual(0);
    }
  });
});

describe('sinkronisasi query URL', () => {
  it('mem-parse dan menyerialisasi filter valid secara konsisten', () => {
    const search = serializeCatalogSearchParams({
      query: 'kopi',
      city: 'Pontianak',
      vibes: ['Ramah Kerja', 'Estetik'],
      facilities: ['Wi-Fi'],
      priceLevels: [1, 2],
      openNow: true,
      sort: 'rating',
    });

    const parsed = parseCatalogSearchParams(search);
    expect(parsed).toEqual({
      query: 'kopi',
      city: 'Pontianak',
      vibes: ['Ramah Kerja', 'Estetik'],
      facilities: ['Wi-Fi'],
      priceLevels: [1, 2],
      openNow: true,
      sort: 'rating',
    });
  });

  it('mengabaikan nilai tidak dikenal dan memangkas query panjang', () => {
    const longQuery = 'a'.repeat(150);
    const parsed = parseCatalogSearchParams(
      `?q=${longQuery}&kota=Atlantis&suasana=Ramah+Kerja,Invalid,Ramah+Kerja&fasilitas=Bogus&harga=99,2,2&buka=yes&urut=hack`,
    );

    expect(parsed.query).toHaveLength(100);
    expect(parsed.city).toBe(SEMUA_KOTA);
    expect(parsed.vibes).toEqual(['Ramah Kerja']);
    expect(parsed.facilities).toEqual([]);
    expect(parsed.priceLevels).toEqual([2]);
    expect(parsed.openNow).toBe(false);
    expect(parsed.sort).toBe('default');
    expect(serializeCatalogSearchParams({ city: SEMUA_KOTA, sort: 'default' })).toBe('');
  });
});

describe('berbagi kafe & daftar simpan', () => {
  it('membentuk URL berbagi yang terfilter dan menolak skema non-http', () => {
    const cafe = CAFES_DATA[0];
    const url = buildCafeShareUrl(cafe, 'https://nongki.id/?foo=bar#old');
    expect(url.startsWith('https://nongki.id/?')).toBe(true);
    expect(url.endsWith('#direktori')).toBe(true);
    const parsed = parseCatalogSearchParams(new URL(url).search);
    expect(parsed.city).toBe(cafe.city);
    expect(parsed.query).toBe(cafe.name);

    const safeFallback = buildCafeShareUrl(cafe, 'javascript:alert(1)');
    expect(safeFallback.startsWith('https://nongki.id/?')).toBe(true);
  });

  it('memformat teks berbagi kafe dan daftar simpan', () => {
    const cafe = CAFES_DATA[0];
    const url = buildCafeShareUrl(cafe, 'https://nongki.id/');
    const cafeText = formatCafeShareText(cafe, url);
    expect(cafeText).toContain(cafe.name);
    expect(cafeText).toContain(url);

    expect(formatBucketlistShareText([], 'Mau ke sini')).toBe('');
    const listText = formatBucketlistShareText(CAFES_DATA.slice(0, 2), 'Mau ke sini');
    expect(listText).toContain('Daftar Nongki — Mau ke sini (2 kafe)');
    expect(listText).toContain(`1. ${CAFES_DATA[0].name}`);
    expect(listText).toContain(`2. ${CAFES_DATA[1].name}`);
  });
});

describe('jarak, radius, dan kawasan', () => {
  it('menghitung jarak Haversine dan memformatnya dalam meter dan kilometer', () => {
    const asiang = CAFES_DATA.find((c) => c.id === 'warung-kopi-asiang')!;
    const serdam = CAFES_DATA.find((c) => c.id === 'fg-coffee-sungai-raya-dalam')!;
    const kemang = CAFES_DATA.find((c) => c.id === 'anomali-kemang')!;

    expect(distanceKm({ lat: asiang.lat, lng: asiang.lng }, { lat: asiang.lat, lng: asiang.lng })).toBe(0);
    const pontianakDist = distanceKm({ lat: asiang.lat, lng: asiang.lng }, { lat: serdam.lat, lng: serdam.lng });
    expect(pontianakDist).toBeGreaterThan(4);
    expect(pontianakDist).toBeLessThan(10);

    const crossIslandDist = distanceKm(
      { lat: asiang.lat, lng: asiang.lng },
      { lat: kemang.lat, lng: kemang.lng },
    );
    expect(crossIslandDist).toBeGreaterThan(700);

    expect(formatDistanceKm(0.42)).toBe('420 m');
    expect(formatDistanceKm(2.44)).toBe('2,4 km');
  });

  it('menyaring berdasarkan radius lokasi dan kawasan kota', () => {
    const pontianakOrigin = { lat: -0.032, lng: 109.335 };
    const within2Km = filterCafes(CAFES_DATA, {
      near: { origin: pontianakOrigin, maxDistanceKm: 2 },
    });
    expect(within2Km.length).toBeGreaterThan(0);
    expect(within2Km.every((c) => c.city === 'Pontianak')).toBe(true);

    const within5Km = filterCafes(CAFES_DATA, {
      near: { origin: pontianakOrigin, maxDistanceKm: 5 },
    });
    expect(within5Km.length).toBeGreaterThanOrEqual(within2Km.length);

    const gajahMada = filterCafes(CAFES_DATA, { city: 'Pontianak', area: 'Gajah Mada' });
    expect(gajahMada.length).toBeGreaterThanOrEqual(2);
    expect(gajahMada.every((c) => c.area === 'Gajah Mada')).toBe(true);
  });

  it('menemukan kafe terdekat dan daftar kawasan unik per kota', () => {
    const nearest = findNearestCafe(CAFES_DATA, { lat: -0.029, lng: 109.341 });
    expect(nearest?.cafe.id).toBe('warung-kopi-asiang');
    expect(nearest?.distanceKm).toBeLessThan(0.5);
    expect(findNearestCafe([], { lat: 0, lng: 0 })).toBeUndefined();

    const areas = getAreasForCity(CAFES_DATA, 'Pontianak');
    expect(areas).toContain('Gajah Mada');
    expect(areas).toContain('Sungai Raya Dalam');
    expect(new Set(areas).size).toBe(areas.length);
  });
});

describe('integritas skema data kafe', () => {
  it('memastikan seluruh entri memenuhi aturan format, relasi kota, dan enum valid', () => {
    const ids = new Set<string>();
    const citySet = new Set<string>(CITIES);
    const vibeSet = new Set<string>(VIBES);
    const facilitySet = new Set<string>(FACILITIES);
    const priceSet = new Set<number>(PRICE_LEVELS);
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

    expect(CAFES_DATA.length).toBeGreaterThan(0);

    for (const cafe of CAFES_DATA) {
      expect(cafe.id.trim().length).toBeGreaterThan(0);
      expect(ids.has(cafe.id)).toBe(false);
      ids.add(cafe.id);

      expect(cafe.name.trim().length).toBeGreaterThan(0);
      expect(cafe.tagline.trim().length).toBeGreaterThan(0);
      expect(cafe.area.trim().length).toBeGreaterThan(0);
      expect(cafe.address.trim().length).toBeGreaterThan(0);
      expect(cafe.description.trim().length).toBeGreaterThan(0);
      expect(cafe.bestFor.trim().length).toBeGreaterThan(0);
      expect(cafe.priceRange.trim().length).toBeGreaterThan(0);

      expect(citySet.has(cafe.city)).toBe(true);
      expect(CITY_INFO[cafe.city]).toBeDefined();

      expect(cafe.opensAt).toMatch(timeRegex);
      expect(cafe.closesAt).toMatch(timeRegex);
      if (cafe.open24 !== undefined) {
        expect(typeof cafe.open24).toBe('boolean');
      }

      expect(cafe.rating).toBeGreaterThanOrEqual(1);
      expect(cafe.rating).toBeLessThanOrEqual(5);
      expect(cafe.reviewCount).toBeGreaterThanOrEqual(0);
      expect(priceSet.has(cafe.priceLevel)).toBe(true);

      expect(cafe.vibes.length).toBeGreaterThan(0);
      expect(cafe.vibes.every((vibe) => vibeSet.has(vibe))).toBe(true);
      expect(cafe.facilities.every((facility) => facilitySet.has(facility))).toBe(true);
      expect(cafe.menuHighlights.length).toBeGreaterThan(0);

      const parsedUrl = new URL(cafe.mapsUrl);
      expect(parsedUrl.protocol).toBe('https:');
      expect(Number.isFinite(cafe.lat)).toBe(true);
      expect(Number.isFinite(cafe.lng)).toBe(true);
      expect(cafe.lat).toBeGreaterThanOrEqual(-11.5);
      expect(cafe.lat).toBeLessThanOrEqual(6.5);
      expect(cafe.lng).toBeGreaterThanOrEqual(94.5);
      expect(cafe.lng).toBeLessThanOrEqual(141.5);
      if (cafe.image !== undefined) {
        expect(cafe.image.startsWith('/assets/') || cafe.image.startsWith('https://')).toBe(true);
      }
      expect(cafe.accentColor).toMatch(hexColorRegex);
    }
  });
});
