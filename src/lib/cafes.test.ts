import { describe, expect, it } from 'vitest';
import { CAFES_DATA, type Cafe } from '../data/cafes';
import {
  ALL_AREAS,
  filterCafes,
  formatHours,
  getCafeOfTheDay,
  getInitials,
  getOpenStatus,
  getPontianakDateKey,
  getPontianakMinutes,
  isOpenAt,
  pickRandomCafe,
} from './cafes';

/** 14 Nov 2026, 10:00 WIB. */
const AT_10_WIB = new Date('2026-11-14T03:00:00Z');
/** 14 Nov 2026, 23:00 WIB. */
const AT_23_WIB = new Date('2026-11-14T16:00:00Z');

const overnight: Cafe = {
  ...CAFES_DATA[0],
  id: 'overnight-test',
  name: 'Cafe Tengah Malam',
  opensAt: '18:00',
  closesAt: '01:00',
  open24: false,
};

describe('waktu Pontianak', () => {
  it('menghitung jam WIB dari timestamp UTC', () => {
    expect(getPontianakMinutes(AT_10_WIB)).toBe(10 * 60);
    expect(getPontianakDateKey(AT_10_WIB)).toBe('2026-11-14');
  });

  it('memakai WIB walau zona waktu perangkat berbeda', () => {
    // 17:30 UTC = 00:30 WIB tanggal berikutnya.
    const date = new Date('2026-11-14T17:30:00Z');
    expect(getPontianakMinutes(date)).toBe(30);
    expect(getPontianakDateKey(date)).toBe('2026-11-15');
  });
});

describe('jam operasional', () => {
  it('mengenali cafe yang sedang buka dan tutup', () => {
    const asiang = CAFES_DATA.find((cafe) => cafe.id === 'asiang')!;
    expect(isOpenAt(asiang, AT_10_WIB)).toBe(true);
    expect(isOpenAt(asiang, AT_23_WIB)).toBe(false);
    expect(getOpenStatus(asiang, AT_10_WIB)).toEqual({ open: true, label: 'Buka sekarang' });
  });

  it('mendukung cafe 24 jam', () => {
    const cw = CAFES_DATA.find((cafe) => cafe.id === 'cw-coffee-reformasi')!;
    expect(isOpenAt(cw, AT_23_WIB)).toBe(true);
    expect(isOpenAt(cw, new Date('2026-11-14T20:00:00Z'))).toBe(true);
    expect(formatHours(cw)).toBe('Buka 24 jam');
  });

  it('mendukung jam operasional yang melewati tengah malam', () => {
    expect(isOpenAt(overnight, AT_23_WIB)).toBe(true);
    // 00:30 WIB
    expect(isOpenAt(overnight, new Date('2026-11-14T17:30:00Z'))).toBe(true);
    // 02:00 WIB
    expect(isOpenAt(overnight, new Date('2026-11-14T19:00:00Z'))).toBe(false);
  });
});

describe('filter katalog', () => {
  it('menyaring berdasarkan kawasan', () => {
    const result = filterCafes(CAFES_DATA, { area: 'Reformasi' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((cafe) => cafe.area === 'Reformasi')).toBe(true);
  });

  it('label "Semua Kawasan" tidak menyaring apa pun', () => {
    expect(filterCafes(CAFES_DATA, { area: ALL_AREAS })).toHaveLength(CAFES_DATA.length);
  });

  it('menerapkan beberapa suasana sekaligus (AND)', () => {
    const result = filterCafes(CAFES_DATA, { vibes: ['WFC Friendly', 'Aesthetic'] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((cafe) => cafe.vibes.includes('WFC Friendly'))).toBe(true);
    expect(result.every((cafe) => cafe.vibes.includes('Aesthetic'))).toBe(true);
  });

  it('menerapkan fasilitas dan pencarian teks', () => {
    const result = filterCafes(CAFES_DATA, { facilities: ['Wi-Fi', 'Colokan'] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((cafe) => cafe.facilities.includes('Wi-Fi'))).toBe(true);

    const searched = filterCafes(CAFES_DATA, { query: 'srikaya' });
    expect(searched.length).toBeGreaterThan(0);
    expect(searched.every((cafe) => cafe.menuHighlights.includes('Roti srikaya') || cafe.menuHighlights.includes('Roti kukus srikaya'))).toBe(true);
  });

  it('menyaring cafe yang buka sekarang', () => {
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

describe('Cafe of the Day', () => {
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

describe('random picker', () => {
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
  it('membuat inisial dari nama cafe', () => {
    expect(getInitials('Warkop Asiang')).toBe('WA');
    expect(getInitials('Canopy')).toBe('CA');
    expect(getInitials('Dua Cerita Coffee & Space')).toBe('DC');
  });
});
