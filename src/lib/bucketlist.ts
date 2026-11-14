/**
 * Bucketlist cafe yang disimpan di browser (localStorage).
 * Dipisah menjadi dua daftar yang saling eksklusif:
 * - wishlist: cafe yang mau dikunjungi
 * - visited: cafe yang sudah pernah didatangi
 */

export const BUCKETLIST_STORAGE_KEY = 'nongki_bucketlist_v1';

export interface BucketlistState {
  wishlist: string[];
  visited: string[];
}

export type BucketTab = 'wishlist' | 'visited';

export const EMPTY_BUCKETLIST: BucketlistState = { wishlist: [], visited: [] };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function uniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function normalizeBucketlist(value: unknown): BucketlistState {
  if (!value || typeof value !== 'object') return { ...EMPTY_BUCKETLIST };
  const source = value as Partial<Record<keyof BucketlistState, unknown>>;
  const visited = uniqueIds(source.visited);
  const visitedSet = new Set(visited);
  const wishlist = uniqueIds(source.wishlist).filter((id) => !visitedSet.has(id));
  return { wishlist, visited };
}

export function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function toggleWishlist(state: BucketlistState, id: string): BucketlistState {
  const wishlisted = state.wishlist.includes(id);
  return {
    wishlist: wishlisted ? state.wishlist.filter((item) => item !== id) : [...state.wishlist, id],
    visited: wishlisted
      ? state.visited
      : state.visited.filter((item) => item !== id),
  };
}

export function toggleVisited(state: BucketlistState, id: string): BucketlistState {
  const visited = state.visited.includes(id);
  return {
    wishlist: visited ? state.wishlist : state.wishlist.filter((item) => item !== id),
    visited: visited ? state.visited.filter((item) => item !== id) : [...state.visited, id],
  };
}

export function countSaved(state: BucketlistState): number {
  return state.wishlist.length + state.visited.length;
}

function getStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadBucketlist(storage: StorageLike | null = getStorage()): BucketlistState {
  if (!storage) return { ...EMPTY_BUCKETLIST };
  try {
    const raw = storage.getItem(BUCKETLIST_STORAGE_KEY);
    if (!raw) return { ...EMPTY_BUCKETLIST };
    return normalizeBucketlist(JSON.parse(raw));
  } catch {
    return { ...EMPTY_BUCKETLIST };
  }
}

export function saveBucketlist(
  state: BucketlistState,
  storage: StorageLike | null = getStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(BUCKETLIST_STORAGE_KEY, JSON.stringify(normalizeBucketlist(state)));
  } catch {
    // Kuota penuh atau localStorage diblokir: abaikan, UI tetap berjalan.
  }
}

let currentState: BucketlistState = loadBucketlist();
const listeners = new Set<(state: BucketlistState) => void>();

function emit(): void {
  const snapshot = getBucketlist();
  listeners.forEach((listener) => listener(snapshot));
}

function commit(next: BucketlistState): BucketlistState {
  currentState = normalizeBucketlist(next);
  saveBucketlist(currentState);
  emit();
  return getBucketlist();
}

export function getBucketlist(): BucketlistState {
  return {
    wishlist: [...currentState.wishlist],
    visited: [...currentState.visited],
  };
}

export function subscribeBucketlist(
  listener: (state: BucketlistState) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isWishlisted(id: string): boolean {
  return currentState.wishlist.includes(id);
}

export function isVisited(id: string): boolean {
  return currentState.visited.includes(id);
}

export function toggleBucketWishlist(id: string): BucketlistState {
  return commit(toggleWishlist(currentState, id));
}

export function toggleBucketVisited(id: string): BucketlistState {
  return commit(toggleVisited(currentState, id));
}

export function removeFromBucketlist(id: string): BucketlistState {
  return commit({
    wishlist: currentState.wishlist.filter((item) => item !== id),
    visited: currentState.visited.filter((item) => item !== id),
  });
}

export function resetBucketlist(): BucketlistState {
  return commit({ ...EMPTY_BUCKETLIST });
}

/** Dipakai test untuk memuat ulang state dari storage. */
export function reloadBucketlist(storage: StorageLike | null = getStorage()): BucketlistState {
  currentState = loadBucketlist(storage);
  emit();
  return getBucketlist();
}
