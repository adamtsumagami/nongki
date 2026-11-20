import {
  CITIES,
  CITY_INFO,
  FACILITIES,
  PRICE_LEVELS,
  PRICE_LEVEL_SHORT,
  TIME_ZONE_LABELS,
  VIBES,
  type Cafe,
  type City,
  type Facility,
  type PriceLevel,
  type Vibe,
} from '../data/cafes';

export const SEMUA_KOTA = 'Semua Kota' as const;

export type CityFilter = City | typeof SEMUA_KOTA;

export interface CafeFilters {
  query?: string;
  city?: CityFilter;
  vibes?: Vibe[];
  facilities?: Facility[];
  priceLevels?: PriceLevel[];
  openNow?: boolean;
  now?: Date;
}

export interface OpenStatus {
  open: boolean;
  label: 'Buka sekarang' | 'Tutup sekarang' | 'Buka 24 jam';
}

const DEFAULT_TIME_ZONE = 'Asia/Jakarta';

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

interface ZonedParts {
  minutes: number;
  dateKey: string;
}

/**
 * Membaca jam dan tanggal pada zona waktu tertentu, bukan zona waktu perangkat.
 * Dipakai agar status buka tiap kota tetap benar walau pengguna berada di
 * zona waktu lain.
 */
function getZonedParts(now: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }

  const hours = Number(values.hour ?? '0');
  const minutes = Number(values.minute ?? '0');

  return {
    minutes: mod(hours, 24) * 60 + Math.min(59, Math.max(0, minutes)),
    dateKey: `${values.year}-${values.month}-${values.day}`,
  };
}

/** Menit sejak 00:00 menurut zona waktu kota, default WIB. */
export function getLocalMinutes(now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): number {
  return getZonedParts(now, timeZone).minutes;
}

/** Kunci tanggal YYYY-MM-DD menurut zona waktu kota, dipakai untuk Kafe Pilihan Hari Ini. */
export function getLocalDateKey(now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): string {
  return getZonedParts(now, timeZone).dateKey;
}

/** "HH:MM" -> menit. Nilai yang tidak valid dianggap 00:00. */
export function parseTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return mod(hours, 24) * 60 + Math.min(59, Math.max(0, minutes));
}

export function isOpenAt(cafe: Cafe, now: Date = new Date()): boolean {
  if (cafe.open24) return true;

  const open = parseTime(cafe.opensAt);
  const close = parseTime(cafe.closesAt);
  const current = getLocalMinutes(now, CITY_INFO[cafe.city].timeZone);

  // Jam buka sama dengan jam tutup diperlakukan sebagai buka sehari penuh.
  if (open === close) return true;
  // Lewat tengah malam, mis. 18:00 - 01:00.
  if (close < open) return current >= open || current < close;
  return current >= open && current < close;
}

export function getOpenStatus(cafe: Cafe, now: Date = new Date()): OpenStatus {
  if (cafe.open24) return { open: true, label: 'Buka 24 jam' };
  const open = isOpenAt(cafe, now);
  return { open, label: open ? 'Buka sekarang' : 'Tutup sekarang' };
}

/** Label zona waktu kota, mis. WIB, WITA, atau WIT. */
export function getTimeZoneLabel(cafe: Cafe): string {
  return TIME_ZONE_LABELS[CITY_INFO[cafe.city].timeZone];
}

export function formatHours(cafe: Cafe): string {
  return cafe.open24 ? 'Buka 24 jam' : `${cafe.opensAt} - ${cafe.closesAt} ${getTimeZoneLabel(cafe)}`;
}

export function formatReviewCount(count: number): string {
  return new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(count);
}

export function getDailyLabel(now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(now);
}

function searchableText(cafe: Cafe): string {
  return [
    cafe.name,
    cafe.tagline,
    cafe.city,
    cafe.area,
    cafe.address,
    cafe.bestFor,
    cafe.description,
    ...cafe.vibes,
    ...cafe.facilities,
    ...cafe.menuHighlights,
  ]
    .join(' ')
    .toLocaleLowerCase('id-ID');
}

export function filterCafes(cafes: Cafe[], filters: CafeFilters = {}): Cafe[] {
  const query = filters.query?.trim().toLocaleLowerCase('id-ID') ?? '';
  const city = filters.city ?? SEMUA_KOTA;
  const vibes = filters.vibes ?? [];
  const facilities = filters.facilities ?? [];
  const priceLevels = filters.priceLevels ?? [];
  const now = filters.now ?? new Date();

  return cafes.filter((cafe) => {
    if (city !== SEMUA_KOTA && cafe.city !== city) return false;
    if (vibes.length > 0 && !vibes.every((vibe) => cafe.vibes.includes(vibe))) return false;
    if (facilities.length > 0 && !facilities.every((facility) => cafe.facilities.includes(facility))) {
      return false;
    }
    if (priceLevels.length > 0 && !priceLevels.includes(cafe.priceLevel)) return false;
    if (filters.openNow && !isOpenAt(cafe, now)) return false;
    if (query && !searchableText(cafe).includes(query)) return false;
    return true;
  });
}

/**
 * Rotasi harian yang deterministik: kafe yang sama selalu tampil pada tanggal
 * yang sama, dan berganti setiap hari tanpa perlu backend.
 */
export function getCafeOfTheDay(cafes: Cafe[], now: Date = new Date()): Cafe | undefined {
  if (cafes.length === 0) return undefined;
  const [year, month, day] = getLocalDateKey(now).split('-').map(Number);
  const days = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const secret = 17;
  return cafes[mod(days + secret, cafes.length)];
}

export interface RandomPickOptions {
  excludeId?: string;
  random?: () => number;
}

export function pickRandomCafe(
  cafes: Cafe[],
  options: RandomPickOptions = {},
): Cafe | undefined {
  const pool =
    options.excludeId && cafes.length > 1
      ? cafes.filter((cafe) => cafe.id !== options.excludeId)
      : cafes;
  if (pool.length === 0) return undefined;

  const roll = Math.min(0.999999, Math.max(0, options.random?.() ?? Math.random()));
  return pool[Math.floor(roll * pool.length)];
}

export const CAFE_SORTS = ['default', 'open', 'rating', 'price-asc', 'name'] as const;

export type CafeSort = (typeof CAFE_SORTS)[number];

export interface CatalogQueryState {
  query: string;
  city: CityFilter;
  vibes: Vibe[];
  facilities: Facility[];
  priceLevels: PriceLevel[];
  openNow: boolean;
  sort: CafeSort;
}

const CITY_SET = new Set<string>(CITIES);
const VIBE_SET = new Set<string>(VIBES);
const FACILITY_SET = new Set<string>(FACILITIES);
const PRICE_SET = new Set<number>(PRICE_LEVELS);
const SORT_SET = new Set<string>(CAFE_SORTS);

function parseAllowlistedList<T extends string>(raw: string | null, allowlist: Set<string>): T[] {
  if (!raw) return [];
  const seen = new Set<T>();
  for (const part of raw.split(',')) {
    const value = part.trim() as T;
    if (allowlist.has(value)) seen.add(value);
  }
  return Array.from(seen);
}

function parsePriceLevels(raw: string | null): PriceLevel[] {
  if (!raw) return [];
  const seen = new Set<PriceLevel>();
  for (const part of raw.split(',')) {
    const num = Number(part.trim());
    if (Number.isInteger(num) && PRICE_SET.has(num)) seen.add(num as PriceLevel);
  }
  return Array.from(seen);
}

/** Returns a sorted copy of the cafe list without mutating the input array. */
export function sortCafes(cafes: Cafe[], sortBy: CafeSort, now: Date = new Date()): Cafe[] {
  const list = [...cafes];
  if (sortBy === 'default') return list;

  return list.sort((a, b) => {
    if (sortBy === 'open') {
      return (
        Number(isOpenAt(b, now)) - Number(isOpenAt(a, now)) ||
        b.rating - a.rating ||
        a.name.localeCompare(b.name, 'id')
      );
    }
    if (sortBy === 'rating') {
      return (
        b.rating - a.rating ||
        b.reviewCount - a.reviewCount ||
        a.name.localeCompare(b.name, 'id')
      );
    }
    if (sortBy === 'price-asc') {
      return (
        a.priceLevel - b.priceLevel ||
        b.rating - a.rating ||
        a.name.localeCompare(b.name, 'id')
      );
    }
    return a.name.localeCompare(b.name, 'id');
  });
}

/** Parses and allowlist-validates directory filters from a URL query string. */
export function parseCatalogSearchParams(search: string): CatalogQueryState {
  const params = new URLSearchParams(search);
  const rawCity = params.get('kota')?.trim() ?? '';
  const rawSort = params.get('urut')?.trim() ?? '';

  return {
    query: (params.get('q') ?? '').trim().slice(0, 100),
    city: CITY_SET.has(rawCity) ? (rawCity as City) : SEMUA_KOTA,
    vibes: parseAllowlistedList<Vibe>(params.get('suasana'), VIBE_SET),
    facilities: parseAllowlistedList<Facility>(params.get('fasilitas'), FACILITY_SET),
    priceLevels: parsePriceLevels(params.get('harga')),
    openNow: params.get('buka') === '1',
    sort: SORT_SET.has(rawSort) ? (rawSort as CafeSort) : 'default',
  };
}

/** Serializes active directory filters into a compact query string, omitting defaults. */
export function serializeCatalogSearchParams(state: Partial<CatalogQueryState>): string {
  const params = new URLSearchParams();
  const query = state.query?.trim().slice(0, 100) ?? '';
  if (query) params.set('q', query);
  if (state.city && state.city !== SEMUA_KOTA) params.set('kota', state.city);
  if (state.vibes && state.vibes.length > 0) params.set('suasana', state.vibes.join(','));
  if (state.facilities && state.facilities.length > 0) {
    params.set('fasilitas', state.facilities.join(','));
  }
  if (state.priceLevels && state.priceLevels.length > 0) {
    params.set('harga', state.priceLevels.join(','));
  }
  if (state.openNow) params.set('buka', '1');
  if (state.sort && state.sort !== 'default') params.set('urut', state.sort);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

/** Builds a shareable directory URL filtered to the given cafe. */
export function buildCafeShareUrl(cafe: Cafe, currentUrl: string): string {
  let parsed: URL;
  try {
    const candidate = new URL(currentUrl);
    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
      parsed = new URL('https://nongki.id/');
    } else {
      parsed = new URL(`${candidate.origin}${candidate.pathname}`);
    }
  } catch {
    parsed = new URL('https://nongki.id/');
  }

  parsed.search = serializeCatalogSearchParams({ city: cafe.city, query: cafe.name });
  parsed.hash = '#direktori';
  return parsed.toString();
}

export function formatCafeShareText(cafe: Cafe, shareUrl: string): string {
  return `${cafe.name} (${cafe.city} · ${cafe.area}) — ${formatHours(cafe)}\n${shareUrl}`;
}

export function formatBucketlistShareText(cafes: Cafe[], tabLabel: string): string {
  if (cafes.length === 0) return '';
  const lines = cafes.map(
    (cafe, i) =>
      `${i + 1}. ${cafe.name} (${cafe.city} · ${cafe.area}, ${PRICE_LEVEL_SHORT[cafe.priceLevel]}, ${formatHours(cafe)}) — ${cafe.mapsUrl}`,
  );
  return `Daftar Nongki — ${tabLabel} (${cafes.length} kafe)\n${lines.join('\n')}`;
}

export function getCafeById(cafes: Cafe[], id: string): Cafe | undefined {
  return cafes.find((cafe) => cafe.id === id);
}

export function getInitials(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'NK';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
