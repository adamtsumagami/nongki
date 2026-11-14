import { beforeEach, describe, expect, it } from 'vitest';
import {
  BUCKETLIST_STORAGE_KEY,
  EMPTY_BUCKETLIST,
  countSaved,
  getBucketlist,
  isVisited,
  isWishlisted,
  loadBucketlist,
  normalizeBucketlist,
  resetBucketlist,
  saveBucketlist,
  subscribeBucketlist,
  toggleBucketVisited,
  toggleBucketWishlist,
  toggleInList,
  toggleVisited,
  toggleWishlist,
} from './bucketlist';

function createStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    dump: () => data,
  };
}

beforeEach(() => {
  resetBucketlist();
});

describe('normalisasi bucketlist', () => {
  it('membuang id duplikat dan tipe yang salah', () => {
    expect(
      normalizeBucketlist({
        wishlist: ['asiang', 'asiang', 42, '', 'kopi-kala'],
        visited: ['teduh-coffee', 'teduh-coffee'],
      }),
    ).toEqual({
      wishlist: ['asiang', 'kopi-kala'],
      visited: ['teduh-coffee'],
    });
  });

  it('membuat id yang sudah dikunjungi tidak tersimpan di wishlist', () => {
    expect(
      normalizeBucketlist({ wishlist: ['asiang', 'teduh-coffee'], visited: ['teduh-coffee'] }),
    ).toEqual({ wishlist: ['asiang'], visited: ['teduh-coffee'] });
  });

  it('mengembalikan state kosong untuk data rusak', () => {
    expect(normalizeBucketlist(null)).toEqual(EMPTY_BUCKETLIST);
    expect(normalizeBucketlist('nope')).toEqual(EMPTY_BUCKETLIST);
  });
});

describe('toggle daftar', () => {
  it('menambah dan menghapus id', () => {
    expect(toggleInList([], 'asiang')).toEqual(['asiang']);
    expect(toggleInList(['asiang'], 'asiang')).toEqual([]);
  });

  it('wishlist dan visited saling eksklusif', () => {
    const visited = toggleVisited(EMPTY_BUCKETLIST, 'asiang');
    expect(visited).toEqual({ wishlist: [], visited: ['asiang'] });

    const backToWishlist = toggleWishlist(visited, 'asiang');
    expect(backToWishlist).toEqual({ wishlist: ['asiang'], visited: [] });

    const backToVisited = toggleVisited(backToWishlist, 'asiang');
    expect(backToVisited).toEqual({ wishlist: [], visited: ['asiang'] });
  });

  it('menghapus dari visited saat di-toggle ulang', () => {
    expect(toggleVisited({ wishlist: [], visited: ['asiang'] }, 'asiang')).toEqual({
      wishlist: [],
      visited: [],
    });
  });
});

describe('penyimpanan browser', () => {
  it('menyimpan dan memuat ulang state', () => {
    const storage = createStorage();
    saveBucketlist({ wishlist: ['asiang'], visited: ['teduh-coffee'] }, storage);
    expect(loadBucketlist(storage)).toEqual({
      wishlist: ['asiang'],
      visited: ['teduh-coffee'],
    });
    expect(storage.dump().get(BUCKETLIST_STORAGE_KEY)).toContain('asiang');
  });

  it('mengembalikan state kosong untuk JSON rusak', () => {
    const storage = createStorage({ [BUCKETLIST_STORAGE_KEY]: '{invalid' });
    expect(loadBucketlist(storage)).toEqual(EMPTY_BUCKETLIST);
  });

  it('menghitung total cafe tersimpan', () => {
    expect(countSaved({ wishlist: ['a', 'b'], visited: ['c'] })).toBe(3);
  });
});

describe('store bucketlist', () => {
  it('memberi tahu subscriber saat state berubah', () => {
    const seen: string[][] = [];
    const unsubscribe = subscribeBucketlist((state) => seen.push(state.wishlist));
    toggleBucketWishlist('asiang');
    toggleBucketWishlist('kopi-kala');
    unsubscribe();
    toggleBucketWishlist('teduh-coffee');

    expect(seen).toEqual([['asiang'], ['asiang', 'kopi-kala']]);
    expect(isWishlisted('asiang')).toBe(true);
    // State tetap berubah walau listener sudah dilepas.
    expect(isWishlisted('teduh-coffee')).toBe(true);
  });

  it('memindahkan cafe ke visited', () => {
    toggleBucketWishlist('asiang');
    toggleBucketVisited('asiang');
    expect(isWishlisted('asiang')).toBe(false);
    expect(isVisited('asiang')).toBe(true);
    expect(getBucketlist()).toEqual({ wishlist: [], visited: ['asiang'] });
  });
});
