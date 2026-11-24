/**
 * Penyimpanan lokal dan pemformatan usulan kafe baru dari pengunjung.
 * Menggunakan localStorage dengan fallback memori agar aman di seluruh lingkungan.
 */

export const SUGGESTIONS_STORAGE_KEY = 'nongki_cafe_suggestions_v1';
export const SUPPORT_EMAIL = 'support@nongki.me';

export interface CafeSuggestion {
  id: string;
  name: string;
  city: string;
  area: string;
  link: string;
  notes: string;
  createdAt: string;
}

export interface CafeSuggestionInput {
  name: string;
  city: string;
  area?: string;
  link?: string;
  notes?: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

let memoryFallback: CafeSuggestion[] = [];

function getSafeStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return null;
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

function normalizeSuggestion(raw: unknown): CafeSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<CafeSuggestion>;
  const name = typeof item.name === 'string' ? item.name.trim().slice(0, 100) : '';
  const city = typeof item.city === 'string' ? item.city.trim().slice(0, 60) : '';
  if (!name || !city) return null;

  return {
    id:
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : `usulan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    city,
    area: typeof item.area === 'string' ? item.area.trim().slice(0, 120) : '',
    link: typeof item.link === 'string' ? item.link.trim().slice(0, 200) : '',
    notes: typeof item.notes === 'string' ? item.notes.trim().slice(0, 300) : '',
    createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : new Date().toISOString(),
  };
}

export function loadSuggestions(): CafeSuggestion[] {
  const storage = getSafeStorage();
  if (!storage) return [...memoryFallback];
  try {
    const raw = storage.getItem(SUGGESTIONS_STORAGE_KEY);
    if (!raw) return [...memoryFallback];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const list = parsed.map(normalizeSuggestion).filter((x): x is CafeSuggestion => x !== null);
    memoryFallback = list;
    return [...list];
  } catch {
    return [...memoryFallback];
  }
}

function saveSuggestions(list: CafeSuggestion[]): void {
  const capped = list.slice(0, 20);
  memoryFallback = [...capped];
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(SUGGESTIONS_STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Ignore quota/storage errors and keep in-memory copy.
  }
}

export function addSuggestion(input: CafeSuggestionInput): CafeSuggestion {
  const name = input.name.trim().slice(0, 100);
  const city = input.city.trim().slice(0, 60);
  if (!name) throw new Error('Nama kafe wajib diisi.');
  if (!city) throw new Error('Kota wajib dipilih.');

  const item: CafeSuggestion = {
    id: `usulan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    city,
    area: (input.area ?? '').trim().slice(0, 120),
    link: (input.link ?? '').trim().slice(0, 200),
    notes: (input.notes ?? '').trim().slice(0, 300),
    createdAt: new Date().toISOString(),
  };

  const current = loadSuggestions();
  saveSuggestions([item, ...current]);
  return item;
}

export function removeSuggestion(id: string): CafeSuggestion[] {
  const next = loadSuggestions().filter((item) => item.id !== id);
  saveSuggestions(next);
  return next;
}

export function clearSuggestions(): void {
  saveSuggestions([]);
}

export function formatSuggestionSummary(item: CafeSuggestion): string {
  const lines = [
    'Usulan Kafe Baru — Nongki',
    `Nama Kafe : ${item.name}`,
    `Kota      : ${item.city}`,
  ];
  if (item.area) lines.push(`Kawasan   : ${item.area}`);
  if (item.link) lines.push(`Tautan    : ${item.link}`);
  if (item.notes) lines.push(`Catatan   : ${item.notes}`);
  return lines.join('\n');
}

export function buildSuggestionMailto(item: CafeSuggestion): string {
  const subject = `[Usulan Kafe] ${item.name} (${item.city})`;
  const body = formatSuggestionSummary(item);
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
