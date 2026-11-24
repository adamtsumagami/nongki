import { describe, expect, it } from 'vitest';
import {
  ALLOWED_CITIES,
  ALLOWED_FACILITIES,
  ALLOWED_VIBES,
  classifyPriceLevel,
  convertScrapedCafe,
  deriveVibes,
  exportCafesDataset,
  extractFacilities,
  isIndonesiaCoord,
  parseOpenHours,
  parsePriceText,
  parseTimeRangeString,
  resolveArea,
  resolvePricing,
  slugify,
} from './export-cafes.mjs';

describe('tools/scraper/export-cafes', () => {
  it('parses Indonesian, English, overnight, and 24-hour schedules into HH:MM', () => {
    expect(parseTimeRangeString('07.00–22.00')).toEqual({
      opensAt: '07:00',
      closesAt: '22:00',
      open24: false,
    });
    expect(parseTimeRangeString('8 AM–11:30 PM')).toEqual({
      opensAt: '08:00',
      closesAt: '23:30',
      open24: false,
    });
    expect(parseTimeRangeString('Buka 24 jam')).toEqual({
      opensAt: '00:00',
      closesAt: '23:59',
      open24: true,
    });
    expect(parseTimeRangeString('Tutup')).toBeNull();

    expect(
      parseOpenHours({
        Senin: ['08.00–23.00'],
        Selasa: ['08.00–23.00'],
        Rabu: ['08.00–23.00'],
        Minggu: ['09.00–22.00'],
      }),
    ).toEqual({ opensAt: '08:00', closesAt: '23:00', open24: false, parsed: true });

    expect(
      parseOpenHours({
        Selasa: ['Buka 24 jam'],
      }),
    ).toEqual({ opensAt: '00:00', closesAt: '23:59', open24: true, parsed: true });
  });

  it('parses price strings and prioritizes Vision > panel > fallback pricing', () => {
    expect(parsePriceText('Rp 25–50 rb per orang')).toEqual({ min: 25000, max: 50000 });
    expect(parsePriceText('Rp 15.000 - Rp 30.000')).toEqual({ min: 15000, max: 30000 });
    expect(parsePriceText('$$')).toEqual({ min: 25000, max: 45000 });
    expect(classifyPriceLevel(10000, 25000)).toBe(1);
    expect(classifyPriceLevel(25000, 45000)).toBe(2);
    expect(classifyPriceLevel(45000, 80000)).toBe(3);

    const visionResult = resolvePricing(
      { title: 'Kopi Contoh', category: 'Kafe', price_range: 'Rp 25–50 rb' },
      { price_range_panel: 'Rp 25–50 rb' },
      { extracted: { is_menu_photo: true, price_min_idr: 18000, price_max_idr: 32000 } },
    );
    expect(visionResult).toEqual({
      priceRange: 'Rp 18.000 - Rp 32.000',
      priceLevel: 1,
      source: 'vision',
    });

    const warkopFallback = resolvePricing({ title: 'Warkop Contoh', category: 'Warung Kopi' }, null, null);
    expect(warkopFallback.priceLevel).toBe(1);
    expect(warkopFallback.source).toBe('fallback');
  });

  it('maps Google Maps about flags to allowed facilities and vibes', () => {
    const about = [
      {
        id: 'amenities',
        options: [
          { name: 'Wi-Fi', enabled: true },
          { name: 'Stopkontak tersedia', enabled: true },
          { name: 'Parkir gratis', enabled: true },
          { name: 'Musala', enabled: false },
        ],
      },
      {
        id: 'atmosphere',
        options: [
          { name: 'Nyaman', enabled: true },
          { name: 'Tempat duduk di luar', enabled: true },
        ],
      },
    ];

    const facilities = extractFacilities(about);
    expect(facilities).toEqual(['Wi-Fi', 'Colokan', 'Parkir']);
    expect(facilities.every((f) => ALLOWED_FACILITIES.includes(f))).toBe(true);

    const vibes = deriveVibes(
      { title: 'Kopi Contoh', category: 'Kafe', about, review_count: 120 },
      facilities,
      { opensAt: '08:00', closesAt: '23:30', open24: false },
    );
    expect(vibes).toContain('Ramah Kerja');
    expect(vibes).toContain('Area Terbuka');
    expect(vibes).toContain('Buka Malam');
    expect(vibes.every((v) => ALLOWED_VIBES.includes(v))).toBe(true);
  });

  it('converts scraped Pontianak records into schema-valid Cafe entries and skips invalid rows', () => {
    expect(slugify('Kopi & Roti — Pontianak!')).toBe('kopi-roti-pontianak');
    expect(resolveArea({ street: 'Jl. Gajah Mada No. 10', borough: 'Pontianak Selatan' }, 'Pontianak')).toBe(
      'Gajah Mada',
    );
    expect(isIndonesiaCoord(-0.0289, 109.341)).toBe(true);
    expect(isIndonesiaCoord(40.7128, -74.006)).toBe(false);

    const sampleRecords = [
      {
        cid: '1001',
        title: 'Kedai Uji Coba',
        category: 'Kedai Kopi',
        address: 'Jl. Purnama No. 5, Pontianak Selatan',
        borough: 'Pontianak Selatan',
        street: 'Jl. Purnama No. 5',
        latitude: -0.045,
        longitude: 109.322,
        link: 'https://www.google.com/maps/place/?q=cid:1001',
        thumbnail: 'https://lh5.googleusercontent.com/p/sample=w800',
        review_rating: 4.7,
        review_count: 240,
        price_range: 'Rp 25–50 rb',
        open_hours: { Senin: ['08.00–23.00'], Selasa: ['08.00–23.00'] },
        about: [{ options: [{ name: 'Wi-Fi', enabled: true }, { name: 'Parkir', enabled: true }] }],
        permanently_closed: false,
      },
      {
        cid: '1002',
        title: 'Kedai Uji Coba',
        category: 'Warkop',
        address: 'Jl. Ahmad Yani, Pontianak',
        latitude: -0.055,
        longitude: 109.345,
        link: 'javascript:alert(1)',
        review_rating: 4.9,
        review_count: 600,
        open_hours: {},
        permanently_closed: false,
      },
      {
        cid: '1003',
        title: 'Kafe Koordinat Salah',
        latitude: 35.6762,
        longitude: 139.6503,
        review_count: 500,
        permanently_closed: false,
      },
      {
        cid: '1004',
        title: 'Kafe Sedikit Ulasan',
        latitude: -0.03,
        longitude: 109.33,
        review_count: 3,
        permanently_closed: false,
      },
      {
        cid: '1005',
        title: 'Kafe Tutup Permanen',
        latitude: -0.03,
        longitude: 109.33,
        review_count: 150,
        permanently_closed: true,
      },
    ];

    const menuByCid = new Map([
      ['1001', { cid: '1001', menu_text_items: [{ name: 'Es Kopi Susu', price: 'Rp 22.000' }] }],
    ]);
    const priceByCid = new Map([
      [
        '1001',
        {
          cid: '1001',
          extracted: {
            is_menu_photo: true,
            price_min_idr: 18000,
            price_max_idr: 38000,
            items: [{ name: 'Kopi Susu Gula Aren' }, { name: 'Manual Brew V60' }],
          },
        },
      ],
    ]);

    const { cafes, skipped, coverage } = exportCafesDataset(sampleRecords, {
      city: 'Pontianak',
      minReviews: 10,
      menuByCid,
      priceByCid,
      includeImages: true,
    });

    expect(cafes).toHaveLength(2);
    expect(skipped).toEqual({
      low_reviews: 1,
      missing_title: 0,
      permanently_closed: 1,
      invalid_coordinates: 1,
    });
    expect(coverage.priceVision).toBe(1);
    expect(coverage.withImage).toBe(1);

    const [first, second] = cafes;
    expect(first.id).toBe('kedai-uji-coba-purnama');
    expect(first.name).toBe('Kedai Uji Coba (Purnama)');
    expect(second.id).toBe('kedai-uji-coba-ahmad-yani');
    expect(second.name).toBe('Kedai Uji Coba (Ahmad Yani)');
    expect(first.area).toBe('Purnama');
    expect(first.opensAt).toBe('08:00');
    expect(first.closesAt).toBe('23:00');
    expect(first.priceRange).toBe('Rp 18.000 - Rp 38.000');
    expect(first.menuHighlights).toEqual(['Kopi Susu Gula Aren', 'Manual Brew V60']);
    expect(first.image).toBe('https://lh5.googleusercontent.com/p/sample=w800');
    expect(second.mapsUrl.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true);

    for (const cafe of cafes) {
      expect(ALLOWED_CITIES).toContain(cafe.city);
      expect(cafe.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(cafe.opensAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(cafe.closesAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(cafe.rating).toBeGreaterThanOrEqual(1);
      expect(cafe.rating).toBeLessThanOrEqual(5);
      expect(cafe.vibes.length).toBeGreaterThan(0);
      expect(cafe.menuHighlights.length).toBeGreaterThan(0);
    }

    const emptyRes = convertScrapedCafe({ title: '', latitude: -0.03, longitude: 109.33 }, {
      city: 'Pontianak',
      menuByCid: new Map(),
      priceByCid: new Map(),
      usedIds: new Set(),
      includeImages: false,
    });
    expect(emptyRes.cafe).toBeNull();
    expect(emptyRes.reason).toBe('missing_title');
  });
});
