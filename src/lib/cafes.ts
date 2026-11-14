import type { Area, Cafe, Facility, PriceLevel, Vibe } from '../data/cafes';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const ALL_AREAS = 'Semua Kawasan' as const;

export type AreaFilter = Area | typeof ALL_AREAS;

export interface CafeFilters {
  query?: string;
  area?: AreaFilter;
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

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** Menit sejak 00:00 WIB, bukan zona waktu perangkat. */
export function getPontianakMinutes(now: Date = new Date()): number {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  return wib.getUTCHours() * 60 + wib.getUTCMinutes();
}

/** Kunci tanggal YYYY-MM-DD menurut WIB, dipakai untuk Cafe of the Day. */
export function getPontianakDateKey(now: Date = new Date()): string {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const year = wib.getUTCFullYear();
  const month = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wib.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const current = getPontianakMinutes(now);

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

export function formatHours(cafe: Cafe): string {
  return cafe.open24 ? 'Buka 24 jam' : `${cafe.opensAt} - ${cafe.closesAt} WIB`;
}

export function formatReviewCount(count: number): string {
  return new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(count);
}

export function getDailyLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Pontianak',
  }).format(now);
}

function searchableText(cafe: Cafe): string {
  return [
    cafe.name,
    cafe.tagline,
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
  const area = filters.area ?? ALL_AREAS;
  const vibes = filters.vibes ?? [];
  const facilities = filters.facilities ?? [];
  const priceLevels = filters.priceLevels ?? [];
  const now = filters.now ?? new Date();

  return cafes.filter((cafe) => {
    if (area !== ALL_AREAS && cafe.area !== area) return false;
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
 * Rotasi harian yang deterministik: cafe yang sama selalu tampil pada tanggal
 * yang sama, dan berganti setiap hari tanpa perlu backend.
 */
export function getCafeOfTheDay(cafes: Cafe[], now: Date = new Date()): Cafe | undefined {
  if (cafes.length === 0) return undefined;
  const days = Math.floor((now.getTime() + WIB_OFFSET_MS) / 86_400_000);
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
