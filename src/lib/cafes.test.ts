import { describe, expect, it } from 'vitest';
import { CAFES_DATA, type Cafe } from '../data/cafes';
import {
  SEMUA_KOTA,
  filterCafes,
  formatHours,
  getCafeOfTheDay,
  getInitials,
  getLocalDateKey,
  getLocalMinutes,
  getOpenStatus,
  isOpenAt,
  pickRandomCafe,
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
    const asiang = CAFES_DATA.find((cafe) => cafe.id === 'asiang')!;
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

  it('menampilkan label zona waktu pada jam buka', () => {
    const asiang = CAFES_DATA.find((cafe) => cafe.id === 'asiang')!;
    expect(formatHours(asiang)).toBe('04:00 - 13:00 WIB');

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

    const searched = filterCafes(CAFES_DATA, { query: 'srikaya' });
    expect(searched.length).toBeGreaterThan(0);
    expect(
      searched.every(
        (cafe) =>
          cafe.menuHighlights.includes('Roti srikaya') ||
          cafe.menuHighlights.includes('Roti kukus srikaya'),
      ),
    ).toBe(true);
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
