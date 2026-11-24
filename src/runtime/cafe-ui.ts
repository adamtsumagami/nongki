/**
 * Nongki interactive UI runtime:
 * Cafe of the Day, directory filtering & corridor chips, random picker, and bucketlist drawer.
 */

import {
  CAFES_DATA,
  CITIES,
  FACILITIES,
  PRICE_LEVELS,
  PRICE_LEVEL_SHORT,
  VIBES,
  type Cafe,
  type City,
  type Facility,
  type PriceLevel,
  type Vibe,
} from '../data/cafes';
import {
  CAFE_SORTS,
  DEFAULT_PICKER_RADIUS_KM,
  PICKER_RADIUS_OPTIONS,
  SEMUA_KOTA,
  buildCafeShareUrl,
  distanceKm,
  filterCafes,
  findNearestCafe,
  formatBucketlistShareText,
  formatCafeShareText,
  formatDistanceKm,
  formatHours,
  formatReviewCount,
  getAreasForCity,
  getCafeById,
  getCafeOfTheDay,
  getDailyLabel,
  getInitials,
  getLocalDateKey,
  getOpenStatus,
  isOpenAt,
  parseCatalogSearchParams,
  pickRandomCafe,
  serializeCatalogSearchParams,
  sortCafes,
  type CafeSort,
  type CityFilter,
  type GeoPoint,
  type PickerRadiusKm,
} from '../lib/cafes';
import {
  getBucketlist,
  isVisited,
  isWishlisted,
  removeFromBucketlist,
  resetBucketlist,
  subscribeBucketlist,
  toggleBucketVisited,
  toggleBucketWishlist,
  type BucketTab,
} from '../lib/bucketlist';
import { playPickerReveal, playPickerTick } from '../lib/sound';
import {
  addSuggestion,
  buildSuggestionMailto,
  formatSuggestionSummary,
  loadSuggestions,
  removeSuggestion,
  type CafeSuggestion,
} from '../lib/suggestions';

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

function safeImageUrl(raw?: string): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (value.startsWith('/assets/')) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function cafePhotoMarkup(cafe: Cafe): string {
  const src = safeImageUrl(cafe.image);
  if (!src) return '';
  return `<img class="cafe-photo" src="${esc(src)}" alt="" width="320" height="240" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}

const ICONS = {
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.8h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.8a1 1 0 0 1 1-1Z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>`,
  dice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
} as const;

function statusMarkup(cafe: Cafe, now: Date): string {
  const status = getOpenStatus(cafe, now);
  return `<span class="cc__status${status.open ? ' is-open' : ''}"><i></i>${esc(status.label)}</span>`;
}

function saveButton(
  cafe: Cafe,
  options: { className: string; idle: string; active: string },
): string {
  const on = isWishlisted(cafe.id);
  const label = on ? options.active : options.idle;
  const aria = on ? 'Hapus dari daftar simpan' : 'Simpan ke daftar simpan';
  return `<button class="${options.className}${on ? ' is-on' : ''}" type="button" data-cafe-save="${esc(cafe.id)}" data-label-idle="${esc(options.idle)}" data-label-active="${esc(options.active)}" aria-pressed="${on}" aria-label="${aria}" title="${aria}">${ICONS.bookmark}<span data-save-label>${esc(label)}</span></button>`;
}

function visitedButton(
  cafe: Cafe,
  options: { className: string; idle: string; active: string },
): string {
  const on = isVisited(cafe.id);
  const label = on ? options.active : options.idle;
  const aria = on ? 'Batalkan tanda sudah dikunjungi' : 'Tandai sudah dikunjungi';
  return `<button class="${options.className}${on ? ' is-on' : ''}" type="button" data-cafe-visited="${esc(cafe.id)}" data-label-idle="${esc(options.idle)}" data-label-active="${esc(options.active)}" aria-pressed="${on}" aria-label="${aria}" title="${aria}">${ICONS.check}<span data-visited-label>${esc(label)}</span></button>`;
}

function shareButton(cafe: Cafe, options: { className: string; label: string }): string {
  const aria = `Bagikan ${esc(cafe.name)}`;
  return `<button class="${options.className}" type="button" data-cafe-share="${esc(cafe.id)}" aria-label="${aria}" title="${aria}">${ICONS.share}<span data-share-label>${esc(options.label)}</span></button>`;
}

const CITY_SET = new Set<string>(CITIES);

function isCity(value: string): value is City {
  return CITY_SET.has(value);
}

function countByCity(): Map<City, number> {
  const counts = new Map<City, number>();
  for (const city of CITIES) counts.set(city, 0);
  for (const cafe of CAFES_DATA) {
    counts.set(cafe.city, (counts.get(cafe.city) ?? 0) + 1);
  }
  return counts;
}

function syncDirectoryStats(now: Date = new Date()): void {
  const counts = countByCity();
  const openCount = CAFES_DATA.filter((cafe) => isOpenAt(cafe, now)).length;
  const ptkCount = counts.get('Pontianak') ?? 0;

  document.querySelectorAll<HTMLElement>('[data-stat-total]').forEach((el) => {
    el.textContent = String(CAFES_DATA.length);
  });
  document.querySelectorAll<HTMLElement>('[data-stat-open]').forEach((el) => {
    el.textContent = String(openCount);
  });
  document.querySelectorAll<HTMLElement>('[data-stat-cities]').forEach((el) => {
    el.textContent = String(CITIES.length);
  });
  document.querySelectorAll<HTMLElement>('[data-stat-ptk]').forEach((el) => {
    el.textContent = String(ptkCount);
  });

  document.querySelectorAll<HTMLElement>('[data-susan-item][data-select-city]').forEach((item) => {
    const city = item.dataset.selectCity ?? '';
    if (isCity(city)) {
      item.dataset.price = `${counts.get(city) ?? 0} kafe`;
    }
  });

  document.querySelectorAll<HTMLElement>('[data-ufo-bag][data-select-city]').forEach((bag) => {
    const city = bag.dataset.selectCity ?? '';
    const valueEl = bag.querySelector<HTMLElement>('.ufo__pricetag-v');
    if (isCity(city) && valueEl) {
      valueEl.textContent = `${counts.get(city) ?? 0} kafe`;
    }
  });
}

function scrollToSection(target: Element): void {
  const lenis = (window as Window & {
    __lenis?: { scrollTo: (t: Element | number, opts?: { offset?: number; duration?: number }) => void };
  }).__lenis;
  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(target, { offset: -72 });
    return;
  }
  if (typeof (target as HTMLElement).scrollIntoView === 'function') {
    (target as HTMLElement).scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}

const BACK_TO_TOP_THRESHOLD = 420;

function scrollToTop(): void {
  const lenis = (window as Window & {
    __lenis?: { scrollTo: (t: Element | number, opts?: { offset?: number; duration?: number }) => void };
  }).__lenis;
  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(0);
    return;
  }
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

let codDateKey = '';

function renderAllCafeOfTheDay(containers: HTMLElement[]): void {
  for (const container of containers) {
    renderCafeOfTheDay(container);
  }
}

function renderCafeOfTheDay(container: HTMLElement): void {
  const now = new Date();
  codDateKey = getLocalDateKey(now);
  const cafe = getCafeOfTheDay(CAFES_DATA, now);

  if (!cafe) {
    container.innerHTML = '';
    return;
  }

  const status = getOpenStatus(cafe, now);
  const hours = formatHours(cafe);
  const pillTags = [...cafe.vibes.slice(0, 2), ...cafe.facilities.slice(0, 2)];

  container.innerHTML = `
    <div class="cod__head">
      <h2 class="sr-only">Kafe Pilihan Hari Ini</h2>
      <span class="cod__kicker" aria-hidden="true">Kafe Pilihan Hari Ini</span>
      <span class="cod__date">${esc(getDailyLabel(now))}</span>
    </div>
    <article class="cod__card" style="--cod-accent:${esc(cafe.accentColor)}">
      <div class="cod__art">
        <span class="cod__mono">${esc(getInitials(cafe.name))}</span>
        ${cafePhotoMarkup(cafe)}
        <div class="cod__art-badges">
          <span class="cod__art-area">${esc(cafe.city)}</span>
          <span class="cod__art-price">${esc(PRICE_LEVEL_SHORT[cafe.priceLevel])}</span>
        </div>
      </div>
      <div class="cod__body">
        <div class="cod__row">
          <span class="cod__area">${esc(cafe.city)} · ${esc(cafe.area)}</span>
          <div class="cod__badges"><span class="cc__status${status.open ? ' is-open' : ''}"><i></i>${esc(status.label)}</span></div>
        </div>
        <h3 class="cod__name">${esc(cafe.name)}</h3>
        <p class="cod__tag">${esc(cafe.tagline)}</p>
        <div class="cod__facts">
          <span><b>★ ${esc(cafe.rating.toFixed(1))}</b>${cafe.reviewCount > 0 ? ` ${esc(formatReviewCount(cafe.reviewCount))} ulasan` : ''}</span>
          <span>${esc(cafe.priceRange)}</span>
          <span>${esc(hours)}</span>
        </div>
        <p class="cod__best"><b>Cocok untuk:</b> ${esc(cafe.bestFor)}</p>
        <div class="cod__tags">
          ${pillTags.map((tag) => `<span>${esc(tag)}</span>`).join('')}
        </div>
        <div class="cod__actions">
          <a class="cod__cta" href="${esc(cafe.mapsUrl)}" target="_blank" rel="noopener">${ICONS.pin}<span>Buka Peta</span></a>
          <button class="cod__inspect" type="button" data-cod-inspect="${esc(cafe.id)}">Lihat detail</button>
          ${saveButton(cafe, { className: 'cod__save', idle: 'Simpan', active: 'Tersimpan' })}
          ${shareButton(cafe, { className: 'cod__share', label: 'Bagikan' })}
        </div>
      </div>
    </article>
  `;
}

interface CatalogState {
  query: string;
  city: CityFilter;
  area: string;
  vibes: Vibe[];
  facilities: Facility[];
  priceLevels: PriceLevel[];
  openNow: boolean;
  sort: CafeSort;
}

interface CatalogPreset {
  id: string;
  label: string;
  vibes?: Vibe[];
  facilities?: Facility[];
  priceLevels?: PriceLevel[];
  openNow?: boolean;
}

const CATALOG_PRESETS: readonly CatalogPreset[] = [
  {
    id: 'wfc',
    label: 'WFC Sekarang',
    vibes: ['Ramah Kerja'],
    facilities: ['Wi-Fi', 'Colokan'],
    openNow: true,
  },
  {
    id: 'malam',
    label: 'Nongkrong Malam',
    vibes: ['Buka Malam'],
  },
  {
    id: 'hemat',
    label: 'Hemat ≤ 25rb',
    priceLevels: [1],
  },
  {
    id: 'musala-wifi',
    label: 'Musala + Wi-Fi',
    facilities: ['Musala', 'Wi-Fi'],
  },
];

const CATALOG_PAGE_SIZE = 12;
let catalogShowAll = false;
let savedCatalogBeforeInspect: CatalogState | null = null;

const catalogState: CatalogState = {
  query: '',
  city: SEMUA_KOTA,
  area: '',
  vibes: [],
  facilities: [],
  priceLevels: [],
  openNow: false,
  sort: 'default',
};

function matchesExactList<T>(actual: readonly T[], target: readonly T[] = []): boolean {
  return actual.length === target.length && target.every((item) => actual.includes(item));
}

function isPresetActive(preset: CatalogPreset): boolean {
  return (
    matchesExactList(catalogState.vibes, preset.vibes) &&
    matchesExactList(catalogState.facilities, preset.facilities) &&
    matchesExactList(catalogState.priceLevels, preset.priceLevels) &&
    catalogState.openNow === Boolean(preset.openNow)
  );
}

function applyPreset(preset: CatalogPreset): void {
  if (isPresetActive(preset)) {
    catalogState.vibes = [];
    catalogState.facilities = [];
    catalogState.priceLevels = [];
    catalogState.openNow = false;
    return;
  }
  catalogState.vibes = [...(preset.vibes ?? [])];
  catalogState.facilities = [...(preset.facilities ?? [])];
  catalogState.priceLevels = [...(preset.priceLevels ?? [])];
  catalogState.openNow = Boolean(preset.openNow);
}

function syncCatalogUrl(): void {
  if (typeof window.history?.replaceState !== 'function') return;
  const search = serializeCatalogSearchParams(catalogState);
  const nextUrl = `${window.location.pathname}${search}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, '', nextUrl);
  }
}

function hydrateCatalogFromUrl(catalog: HTMLElement): void {
  const parsed = parseCatalogSearchParams(window.location.search);
  catalogState.query = parsed.query;
  catalogState.city = parsed.city;
  catalogState.area = '';
  catalogState.vibes = parsed.vibes;
  catalogState.facilities = parsed.facilities;
  catalogState.priceLevels = parsed.priceLevels;
  catalogState.openNow = parsed.openNow;
  catalogState.sort = parsed.sort;

  const search = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
  if (search) search.value = parsed.query;

  const sort = catalog.querySelector<HTMLSelectElement>('[data-catalog-sort]');
  if (sort) sort.value = parsed.sort;

  const advanced = catalog.querySelector<HTMLDetailsElement>('[data-catalog-advanced]');
  if (advanced && (catalogState.facilities.length > 0 || catalogState.priceLevels.length > 0)) {
    advanced.open = true;
  }
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function chip(value: string, group: string, label: string, count?: number): string {
  const countBadge = count !== undefined ? ` <span class="fchip__n">${count}</span>` : '';
  return `<button class="fchip" type="button" data-filter-group="${esc(group)}" data-filter-value="${esc(value)}" aria-pressed="false">${esc(label)}${countBadge}</button>`;
}

function buildCatalogChips(catalog: HTMLElement): void {
  const presets = catalog.querySelector<HTMLElement>('[data-catalog-presets]');
  const city = catalog.querySelector<HTMLElement>('[data-filter-city]');
  const vibes = catalog.querySelector<HTMLElement>('[data-filter-vibes]');
  const facilities = catalog.querySelector<HTMLElement>('[data-filter-facilities]');
  const prices = catalog.querySelector<HTMLElement>('[data-filter-price]');
  const open = catalog.querySelector<HTMLElement>('[data-filter-open]');
  const counts = countByCity();

  if (presets) {
    presets.innerHTML = CATALOG_PRESETS.map(
      (preset) =>
        `<button class="fchip fchip--preset" type="button" data-catalog-preset="${esc(preset.id)}" aria-pressed="false">${esc(preset.label)}</button>`,
    ).join('');
  }
  if (city) {
    city.innerHTML = [
      chip(SEMUA_KOTA, 'city', SEMUA_KOTA, CAFES_DATA.length),
      ...CITIES.map((value) => chip(value, 'city', value, counts.get(value) ?? 0)),
    ].join('');
  }
  if (vibes) {
    vibes.innerHTML = VIBES.map((value) => chip(value, 'vibe', value)).join('');
  }
  if (facilities) {
    facilities.innerHTML = FACILITIES.map((value) => chip(value, 'facility', value)).join('');
  }
  if (prices) {
    prices.innerHTML = PRICE_LEVELS.map((value) =>
      chip(String(value), 'price', PRICE_LEVEL_SHORT[value]),
    ).join('');
  }
  if (open) {
    open.innerHTML = chip('', 'open', 'Buka sekarang');
  }
}

function renderCatalogCorridors(catalog: HTMLElement): void {
  const groupEl = catalog.querySelector<HTMLElement>('[data-catalog-corridor-group]');
  const cityLabelEl = catalog.querySelector<HTMLElement>('[data-catalog-corridor-city]');
  const rowEl = catalog.querySelector<HTMLElement>('[data-catalog-corridors]');
  if (!groupEl || !rowEl) return;

  if (catalogState.city === SEMUA_KOTA) {
    groupEl.hidden = true;
    rowEl.innerHTML = '';
    delete rowEl.dataset.renderedCity;
    return;
  }

  const areas = getAreasForCity(CAFES_DATA, catalogState.city);
  if (areas.length <= 1) {
    groupEl.hidden = true;
    rowEl.innerHTML = '';
    delete rowEl.dataset.renderedCity;
    return;
  }

  groupEl.hidden = false;
  if (rowEl.dataset.renderedCity === catalogState.city) return;

  const cityCafes = CAFES_DATA.filter((cafe) => cafe.city === catalogState.city);
  const areaCounts = new Map<string, number>();
  for (const cafe of cityCafes) {
    areaCounts.set(cafe.area, (areaCounts.get(cafe.area) ?? 0) + 1);
  }

  if (cityLabelEl) cityLabelEl.textContent = `· ${catalogState.city}`;
  rowEl.dataset.renderedCity = catalogState.city;
  rowEl.innerHTML = [
    chip('', 'corridor', 'Semua kawasan', cityCafes.length),
    ...areas.map((area) => chip(area, 'corridor', area, areaCounts.get(area) ?? 0)),
  ].join('');
}

function syncCatalogChips(catalog: HTMLElement): void {
  catalog.querySelectorAll<HTMLButtonElement>('[data-filter-group]').forEach((button) => {
    const group = button.dataset.filterGroup;
    const value = button.dataset.filterValue ?? '';
    let pressed = false;

    if (group === 'city') pressed = catalogState.city === value;
    else if (group === 'corridor') pressed = catalogState.area === value;
    else if (group === 'vibe') pressed = catalogState.vibes.includes(value as Vibe);
    else if (group === 'facility') pressed = catalogState.facilities.includes(value as Facility);
    else if (group === 'price') pressed = catalogState.priceLevels.includes(Number(value) as PriceLevel);
    else if (group === 'open') pressed = catalogState.openNow;

    button.setAttribute('aria-pressed', String(pressed));
  });

  catalog.querySelectorAll<HTMLButtonElement>('[data-catalog-preset]').forEach((button) => {
    const preset = CATALOG_PRESETS.find((item) => item.id === button.dataset.catalogPreset);
    button.setAttribute('aria-pressed', String(preset ? isPresetActive(preset) : false));
  });

  const advCount = catalogState.facilities.length + catalogState.priceLevels.length;
  const advBadge = catalog.querySelector<HTMLElement>('[data-catalog-advanced-count]');
  if (advBadge) {
    advBadge.textContent = String(advCount);
    advBadge.hidden = advCount === 0;
    advBadge.setAttribute('aria-hidden', String(advCount === 0));
  }
}

function syncSearchAdornments(catalog: HTMLElement): void {
  const hasQuery = catalogState.query.trim().length > 0;
  const clearBtn = catalog.querySelector<HTMLButtonElement>('[data-catalog-clear]');
  const kbd = catalog.querySelector<HTMLElement>('.catalog__kbd');
  if (clearBtn) clearBtn.hidden = !hasQuery;
  if (kbd) kbd.hidden = hasQuery;
}

function hasActiveFilters(): boolean {
  return (
    catalogState.query.trim().length > 0 ||
    catalogState.city !== SEMUA_KOTA ||
    catalogState.area.length > 0 ||
    catalogState.vibes.length > 0 ||
    catalogState.facilities.length > 0 ||
    catalogState.priceLevels.length > 0 ||
    catalogState.openNow ||
    catalogState.sort !== 'default'
  );
}

const SORT_LABELS: Record<CafeSort, string> = {
  default: 'Rekomendasi',
  open: 'Buka dulu',
  rating: 'Rating tertinggi',
  'price-asc': 'Harga termurah',
  name: 'Nama A-Z',
};

function buildActiveChipsMarkup(): string {
  const chips: string[] = [];
  const pushChip = (type: string, label: string, value = ''): void => {
    chips.push(
      `<button class="catalog__active-chip" type="button" data-clear-chip="${esc(type)}" data-clear-value="${esc(value)}" aria-label="Hapus filter ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`,
    );
  };

  if (catalogState.query.trim()) pushChip('query', `Cari: "${catalogState.query.trim()}"`);
  if (catalogState.city !== SEMUA_KOTA) pushChip('city', `Kota: ${catalogState.city}`);
  if (catalogState.area) pushChip('area', `Kawasan: ${catalogState.area}`);
  catalogState.vibes.forEach((v) => pushChip('vibe', v, v));
  catalogState.facilities.forEach((f) => pushChip('facility', f, f));
  catalogState.priceLevels.forEach((p) => pushChip('price', PRICE_LEVEL_SHORT[p], String(p)));
  if (catalogState.openNow) pushChip('open', 'Buka sekarang');
  if (catalogState.sort !== 'default') pushChip('sort', `Urut: ${SORT_LABELS[catalogState.sort]}`);

  if (savedCatalogBeforeInspect) {
    chips.unshift(
      '<button class="catalog__active-chip" type="button" data-catalog-restore aria-label="Kembali ke filter sebelumnya">← Filter sebelumnya</button>',
    );
  }

  return chips.join('');
}

function buildEmptyCatalogMessage(): string {
  const query = catalogState.query.trim();
  const hasFilters =
    catalogState.city !== SEMUA_KOTA ||
    catalogState.area.length > 0 ||
    catalogState.vibes.length > 0 ||
    catalogState.facilities.length > 0 ||
    catalogState.priceLevels.length > 0 ||
    catalogState.openNow;

  if (query && hasFilters) {
    return `Tidak ditemukan kafe untuk "${query}" dengan kombinasi filter aktif.`;
  }
  if (query) {
    return `Tidak ada kafe yang cocok dengan kata kunci "${query}". Coba nama jalan, area, atau menu lain.`;
  }
  if (hasFilters) {
    return 'Kombinasi filter terlalu spesifik. Lepas salah satu filter suasana, fasilitas, atau jam buka.';
  }
  return 'Coba kurangi filter atau gunakan kata kunci yang lebih umum.';
}

function renderCafeCard(
  cafe: Cafe,
  now: Date,
  autoExpand = false,
  hiddenExtra = false,
): string {
  const tags = [...cafe.vibes.slice(0, 2), ...cafe.facilities.slice(0, 2)];

  return `
    <article class="cc" data-cafe-card="${esc(cafe.id)}" style="--cc-accent:${esc(cafe.accentColor)}"${hiddenExtra ? ' hidden' : ''}>
      <div class="cc__media" aria-hidden="true"><span class="cc__mono">${esc(getInitials(cafe.name))}</span>${cafePhotoMarkup(cafe)}</div>
      <div class="cc__main">
        <div class="cc__topline"><span class="cc__area">${esc(cafe.city)} · ${esc(cafe.area)}</span>${statusMarkup(cafe, now)}</div>
        <h3 class="cc__name">${esc(cafe.name)}</h3>
        <p class="cc__tagline">${esc(cafe.tagline)}</p>
        <div class="cc__meta"><span><b>★ ${esc(cafe.rating.toFixed(1))}</b></span>${cafe.reviewCount > 0 ? `<span>${esc(formatReviewCount(cafe.reviewCount))} ulasan</span>` : ''}<span>${esc(PRICE_LEVEL_SHORT[cafe.priceLevel])}</span><span>${esc(formatHours(cafe))}</span></div>
        <div class="cc__tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>
      </div>
      <div class="cc__side">
        <a class="cc__cta" href="${esc(cafe.mapsUrl)}" target="_blank" rel="noopener">${ICONS.pin}<span>Buka Peta</span></a>
        <div class="cc__icons">
          ${saveButton(cafe, { className: 'cc__icon', idle: 'Simpan', active: 'Tersimpan' })}
          ${visitedButton(cafe, { className: 'cc__icon', idle: 'Tandai', active: 'Dikunjungi' })}
          ${shareButton(cafe, { className: 'cc__icon', label: 'Bagikan' })}
        </div>
      </div>
      <details class="cc__more"${autoExpand ? ' open' : ''}>
        <summary>Detail, fasilitas &amp; menu</summary>
        <div class="cc__dossier">
          <p class="cc__desc">${esc(cafe.description)}</p>
          <div class="cc__dgrid">
            <div>
              <span class="cc__dk">Cocok untuk</span>
              <p class="cc__dv">${esc(cafe.bestFor)}</p>
            </div>
            <div>
              <span class="cc__dk">Kisaran harga</span>
              <p class="cc__dv">${esc(cafe.priceRange)} per orang</p>
            </div>
          </div>
          ${cafe.facilities.length > 0 ? `<div class="cc__drow"><span class="cc__dk">Fasilitas</span><div class="cc__dfacs">${cafe.facilities.map((f) => `<span>${esc(f)}</span>`).join('')}</div></div>` : ''}
          <div class="cc__drow"><span class="cc__dk">Menu andalan</span><div class="cc__menu">${cafe.menuHighlights.map((item) => `<span>${esc(item)}</span>`).join('')}</div></div>
          <p class="cc__addr">${ICONS.pin}<span>${esc(cafe.address)}</span></p>
        </div>
      </details>
    </article>
  `;
}

function renderCatalog(catalog: HTMLElement): void {
  const now = new Date();
  syncDirectoryStats(now);
  renderCatalogCorridors(catalog);
  syncSearchAdornments(catalog);

  const filtered = filterCafes(CAFES_DATA, {
    query: catalogState.query,
    city: catalogState.city,
    area: catalogState.city === SEMUA_KOTA ? undefined : catalogState.area || undefined,
    vibes: catalogState.vibes,
    facilities: catalogState.facilities,
    priceLevels: catalogState.priceLevels,
    openNow: catalogState.openNow,
    now,
  });
  const results = sortCafes(filtered, catalogState.sort, now);
  const singleSearchMatch = results.length === 1 && catalogState.query.trim().length > 0;

  syncCatalogChips(catalog);

  const grid = catalog.querySelector<HTMLElement>('[data-catalog-grid]');
  const count = catalog.querySelector<HTMLElement>('[data-catalog-count]');
  const activeBar = catalog.querySelector<HTMLElement>('[data-catalog-active]');
  const moreWrap = catalog.querySelector<HTMLElement>('[data-catalog-more-wrap]');
  const moreBtn = catalog.querySelector<HTMLButtonElement>('[data-catalog-more]');
  const empty = catalog.querySelector<HTMLElement>('[data-catalog-empty]');
  const emptyMsg = catalog.querySelector<HTMLElement>('[data-catalog-empty-msg]');
  const reset = catalog.querySelector<HTMLButtonElement>('[data-catalog-reset]');

  if (grid) {
    grid.innerHTML = results
      .map((cafe, index) =>
        renderCafeCard(cafe, now, singleSearchMatch, !catalogShowAll && index >= CATALOG_PAGE_SIZE),
      )
      .join('');
    grid.hidden = results.length === 0;
  }
  if (count) {
    const scopeSuffix =
      catalogState.city !== SEMUA_KOTA
        ? catalogState.area
          ? ` · ${esc(catalogState.city)} (${esc(catalogState.area)})`
          : ` · ${esc(catalogState.city)}`
        : '';
    const pageSuffix =
      !catalogShowAll && results.length > CATALOG_PAGE_SIZE
        ? ` · ${CATALOG_PAGE_SIZE} ditampilkan`
        : '';
    count.innerHTML = `Menampilkan <b>${results.length}</b> dari ${CAFES_DATA.length} kafe${scopeSuffix}${pageSuffix}`;
  }
  if (activeBar) {
    const chipsMarkup = buildActiveChipsMarkup();
    activeBar.innerHTML = chipsMarkup;
    activeBar.hidden = chipsMarkup.length === 0;
  }
  if (moreWrap && moreBtn) {
    const extraCount = results.length - CATALOG_PAGE_SIZE;
    const showMore = !catalogShowAll && extraCount > 0;
    moreWrap.hidden = !showMore;
    if (showMore) {
      moreBtn.textContent = `Tampilkan semua ${results.length} kafe (+${extraCount} lagi)`;
    }
  }
  if (empty) empty.hidden = results.length > 0;
  if (emptyMsg && results.length === 0) {
    emptyMsg.textContent = buildEmptyCatalogMessage();
  }
  if (reset) reset.disabled = !hasActiveFilters();
}

function handleFilterClick(button: HTMLButtonElement, catalog: HTMLElement): void {
  const group = button.dataset.filterGroup;
  const value = button.dataset.filterValue ?? '';

  savedCatalogBeforeInspect = null;
  if (group === 'city') {
    catalogState.city = value as CityFilter;
    catalogState.area = '';
  } else if (group === 'corridor') {
    catalogState.area = catalogState.area === value ? '' : value;
  } else if (group === 'vibe') {
    catalogState.vibes = toggleValue(catalogState.vibes, value as Vibe);
  } else if (group === 'facility') {
    catalogState.facilities = toggleValue(catalogState.facilities, value as Facility);
  } else if (group === 'price') {
    catalogState.priceLevels = toggleValue(catalogState.priceLevels, Number(value) as PriceLevel);
  } else if (group === 'open') {
    catalogState.openNow = !catalogState.openNow;
  }

  catalogShowAll = false;
  syncCatalogUrl();
  renderCatalog(catalog);
}

function resetCatalog(catalog: HTMLElement): void {
  savedCatalogBeforeInspect = null;
  catalogShowAll = false;
  catalogState.query = '';
  catalogState.city = SEMUA_KOTA;
  catalogState.area = '';
  catalogState.vibes = [];
  catalogState.facilities = [];
  catalogState.priceLevels = [];
  catalogState.openNow = false;
  catalogState.sort = 'default';

  const search = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
  if (search) search.value = '';

  const sort = catalog.querySelector<HTMLSelectElement>('[data-catalog-sort]');
  if (sort) sort.value = 'default';

  syncCatalogUrl();
  renderCatalog(catalog);
}

function inspectCafeInCatalog(catalog: HTMLElement | null, cafeId: string): void {
  const cafe = getCafeById(CAFES_DATA, cafeId);
  if (!cafe) return;

  if (catalog) {
    if (hasActiveFilters()) {
      savedCatalogBeforeInspect = {
        ...catalogState,
        vibes: [...catalogState.vibes],
        facilities: [...catalogState.facilities],
        priceLevels: [...catalogState.priceLevels],
      };
    }
    catalogShowAll = true;
    catalogState.city = cafe.city;
    catalogState.area = '';
    catalogState.query = cafe.name;
    catalogState.vibes = [];
    catalogState.facilities = [];
    catalogState.priceLevels = [];
    catalogState.openNow = false;

    const search = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
    if (search) search.value = cafe.name;

    syncCatalogUrl();
    renderCatalog(catalog);
    syncBucketControls();
  }

  const safeId = cafe.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const target =
    catalog?.querySelector<HTMLElement>(`[data-cafe-card="${safeId}"]`) ??
    catalog ??
    document.querySelector('#direktori');
  if (target) scrollToSection(target);
}

type PickerLocationMode = 'manual' | 'auto';
type GeoStatus = 'idle' | 'loading' | 'ready' | 'error';

let pickerLocationMode: PickerLocationMode = 'manual';
let pickerCity: City | typeof SEMUA_KOTA = SEMUA_KOTA;
let pickerArea = '';
let pickerRadiusKm: PickerRadiusKm = DEFAULT_PICKER_RADIUS_KM;
let pickerGeoOrigin: GeoPoint | null = null;
let pickerGeoStatus: GeoStatus = 'idle';
let pickerGeoError = '';
let pickerGeoReqSeq = 0;
let pickerVibe: Vibe | null = null;
let pickerOpenNow = false;
let lastPickedId: string | undefined;
let pickerTimer: number | undefined;

function pickerPool(): Cafe[] {
  if (pickerLocationMode === 'auto') {
    if (!pickerGeoOrigin) return [];
    return filterCafes(CAFES_DATA, {
      near: { origin: pickerGeoOrigin, maxDistanceKm: pickerRadiusKm },
      vibes: pickerVibe ? [pickerVibe] : [],
      openNow: pickerOpenNow,
    });
  }

  return filterCafes(CAFES_DATA, {
    city: pickerCity,
    area: pickerCity === SEMUA_KOTA ? undefined : pickerArea || undefined,
    vibes: pickerVibe ? [pickerVibe] : [],
    openNow: pickerOpenNow,
  });
}

function geolocationErrorMessage(code: number | undefined): string {
  if (code === 1) {
    return 'Izin lokasi ditolak. Aktifkan izin lokasi di perangkat atau beralih ke Atur lokasimu.';
  }
  if (code === 2) {
    return 'Lokasi perangkat tidak dapat ditentukan sekarang. Coba lagi atau beralih ke Atur lokasimu.';
  }
  if (code === 3) {
    return 'Permintaan lokasi melebihi batas waktu. Coba lagi atau beralih ke Atur lokasimu.';
  }
  return 'Gagal membaca lokasi perangkat. Coba lagi atau beralih ke Atur lokasimu.';
}

function requestDeviceLocation(picker: HTMLElement): void {
  pickerGeoReqSeq += 1;
  const seq = pickerGeoReqSeq;

  if (typeof navigator.geolocation?.getCurrentPosition !== 'function') {
    pickerGeoStatus = 'error';
    pickerGeoError =
      'Perangkat ini belum mendukung akses lokasi. Gunakan pilihan Atur lokasimu.';
    renderPickerQuick(picker);
    renderPickerHint(picker);
    return;
  }

  pickerGeoStatus = 'loading';
  pickerGeoError = '';
  renderPickerQuick(picker);
  renderPickerHint(picker);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (seq !== pickerGeoReqSeq) return;
      pickerGeoOrigin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      pickerGeoStatus = 'ready';
      pickerGeoError = '';
      renderPickerQuick(picker);
      renderPickerHint(picker);
    },
    (err) => {
      if (seq !== pickerGeoReqSeq) return;
      pickerGeoStatus = 'error';
      pickerGeoError = geolocationErrorMessage(err?.code);
      renderPickerQuick(picker);
      renderPickerHint(picker);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

function renderPickerHint(picker: HTMLElement): void {
  const out = picker.querySelector<HTMLElement>('[data-picker-out]');
  const button = picker.querySelector<HTMLButtonElement>('[data-picker-spin]');
  const total = pickerPool().length;

  const vibeLabel = pickerVibe ? `suasana ${pickerVibe}` : 'semua suasana';
  const openLabel = pickerOpenNow ? ' · buka sekarang' : '';

  if (pickerLocationMode === 'auto') {
    if (pickerGeoStatus === 'loading') {
      if (button) button.disabled = true;
      if (out) {
        out.innerHTML =
          '<div class="picker__hint"><span class="picker__stage-badge">Mencari sinyal</span><p>Menunggu lokasi perangkat untuk mencari kafe terdekat...</p></div>';
      }
      return;
    }

    if (pickerGeoStatus === 'error' || !pickerGeoOrigin) {
      if (button) button.disabled = true;
      if (out) {
        out.innerHTML = `<div class="picker__hint"><span class="picker__stage-badge">Lokasi belum aktif</span><p>Lokasi perangkat belum tersedia. Coba ambil ulang lokasi di atas atau pilih kota secara manual.</p><button class="picker__hint-btn" type="button" data-picker-switch-manual>Atur lokasimu</button></div>`;
      }
      return;
    }

    if (button) button.disabled = total === 0;
    if (!out) return;

    if (total === 0) {
      const nearest = findNearestCafe(CAFES_DATA, pickerGeoOrigin);
      const nearestNote = nearest
        ? ` Kafe terdekat di data saat ini berjarak ${formatDistanceKm(nearest.distanceKm)} (${nearest.cafe.city}).`
        : '';
      const actionBtn =
        pickerRadiusKm < 20 && nearest && nearest.distanceKm <= 20
          ? '<button class="picker__hint-btn" type="button" data-picker-widen-radius="20">Perluas ke 20 km</button>'
          : '<button class="picker__hint-btn" type="button" data-picker-switch-manual>Atur lokasimu</button>';

      out.innerHTML = `<div class="picker__hint"><span class="picker__stage-badge">0 kandidat</span><p>Belum ada kafe dalam radius <b>${pickerRadiusKm} km</b> (${esc(vibeLabel)}${esc(openLabel)}).${esc(nearestNote)}</p>${actionBtn}</div>`;
      return;
    }

    out.innerHTML = `<div class="picker__hint"><span class="picker__stage-badge">${total} kandidat siap diacak</span><div class="picker__stage-dice" aria-hidden="true">${ICONS.dice}</div><p>Ada <b>${total}</b> kafe dalam radius <b>${pickerRadiusKm} km</b> (${esc(vibeLabel)}${esc(openLabel)}). Tekan tombol pilih, biar Nongki menentukan tujuanmu.</p></div>`;
    return;
  }

  if (button) button.disabled = total === 0;
  if (!out) return;

  const cityLabel =
    pickerCity === SEMUA_KOTA
      ? 'semua kota'
      : pickerArea
        ? `${pickerCity} · ${pickerArea}`
        : pickerCity;

  if (total === 0) {
    out.innerHTML = `<div class="picker__hint"><span class="picker__stage-badge">0 kandidat</span><p>Belum ada kafe yang cocok untuk <b>${esc(cityLabel)}</b> (${esc(vibeLabel)}${esc(openLabel)}). Coba ubah atau longgarkan filter.</p></div>`;
    return;
  }

  out.innerHTML = `<div class="picker__hint"><span class="picker__stage-badge">${total} kandidat siap diacak</span><div class="picker__stage-dice" aria-hidden="true">${ICONS.dice}</div><p>Ada <b>${total}</b> kafe di <b>${esc(cityLabel)}</b> (${esc(vibeLabel)}${esc(openLabel)}). Tekan tombol pilih, biar Nongki menentukan tujuanmu.</p></div>`;
}

function renderPickerQuick(picker: HTMLElement): void {
  const isLoadingGeo = pickerLocationMode === 'auto' && pickerGeoStatus === 'loading';
  picker.querySelectorAll<HTMLButtonElement>('[data-picker-loc-mode]').forEach((btn) => {
    const mode: PickerLocationMode = btn.dataset.pickerLocMode === 'auto' ? 'auto' : 'manual';
    const pressed = pickerLocationMode === mode;
    const busy = mode === 'auto' && isLoadingGeo;
    btn.setAttribute('aria-pressed', String(pressed));
    btn.disabled = busy;
    btn.setAttribute('aria-busy', String(busy));
  });

  const autoPanel = picker.querySelector<HTMLElement>('[data-picker-auto-panel]');
  const manualPanel = picker.querySelector<HTMLElement>('[data-picker-manual-panel]');
  if (autoPanel) autoPanel.hidden = pickerLocationMode !== 'auto';
  if (manualPanel) manualPanel.hidden = pickerLocationMode !== 'manual';

  const radiiHolder = picker.querySelector<HTMLElement>('[data-picker-radii]');
  if (radiiHolder) {
    radiiHolder.innerHTML = PICKER_RADIUS_OPTIONS.map((km) => {
      const pressed = pickerRadiusKm === km;
      return `<button class="fchip" type="button" data-picker-radius="${km}" aria-pressed="${pressed}">${km} km</button>`;
    }).join('');
  }

  const locStatusEl = picker.querySelector<HTMLElement>('[data-picker-loc-status]');
  if (locStatusEl) {
    if (pickerGeoStatus === 'loading') {
      locStatusEl.setAttribute('role', 'status');
      locStatusEl.classList.remove('is-error');
      locStatusEl.innerHTML = '<span>Mengambil lokasi perangkat...</span>';
    } else if (pickerGeoStatus === 'error') {
      locStatusEl.setAttribute('role', 'alert');
      locStatusEl.classList.add('is-error');
      locStatusEl.innerHTML = `<span>${esc(pickerGeoError)}</span><button class="picker__loc-action" type="button" data-picker-loc-retry>Coba lagi</button>`;
    } else if (pickerGeoStatus === 'ready' && pickerGeoOrigin) {
      locStatusEl.setAttribute('role', 'status');
      locStatusEl.classList.remove('is-error');
      const nearest = findNearestCafe(CAFES_DATA, pickerGeoOrigin);
      const areaNote =
        nearest && nearest.distanceKm <= 35 ? ` · sekitar ${nearest.cafe.city}` : '';
      locStatusEl.innerHTML = `<span>Lokasi aktif${esc(areaNote)} · maks. ${pickerRadiusKm} km</span><button class="picker__loc-action" type="button" data-picker-loc-retry>Perbarui</button>`;
    } else {
      locStatusEl.setAttribute('role', 'status');
      locStatusEl.classList.remove('is-error');
      locStatusEl.innerHTML = '';
    }
  }

  const cityHolder = picker.querySelector<HTMLElement>('[data-picker-cities]');
  if (cityHolder) {
    const cityOptions: Array<City | typeof SEMUA_KOTA> = [SEMUA_KOTA, ...CITIES];
    cityHolder.innerHTML = cityOptions.map((city) => {
      const pressed = pickerCity === city;
      return `<button class="fchip" type="button" data-picker-city="${esc(city)}" aria-pressed="${pressed}">${esc(city)}</button>`;
    }).join('');
  }

  const areaGroup = picker.querySelector<HTMLElement>('[data-picker-area-group]');
  const areaHolder = picker.querySelector<HTMLElement>('[data-picker-areas]');
  if (areaGroup && areaHolder) {
    if (pickerCity === SEMUA_KOTA) {
      areaGroup.hidden = true;
      areaHolder.innerHTML = '';
    } else {
      const areas = getAreasForCity(CAFES_DATA, pickerCity);
      areaGroup.hidden = areas.length === 0;
      areaHolder.innerHTML =
        areas.length === 0
          ? ''
          : [
            `<button class="fchip" type="button" data-picker-area="" aria-pressed="${pickerArea === ''}">Semua kawasan</button>`,
            ...areas.map(
              (area) =>
                `<button class="fchip" type="button" data-picker-area="${esc(area)}" aria-pressed="${pickerArea === area}">${esc(area)}</button>`,
            ),
          ].join('');
    }
  }

  const vibeHolder = picker.querySelector<HTMLElement>('[data-picker-vibes]');
  if (vibeHolder) {
    vibeHolder.innerHTML = VIBES.map((vibe) => {
      const pressed = pickerVibe === vibe;
      return `<button class="fchip" type="button" data-picker-vibe="${esc(vibe)}" aria-pressed="${pressed}">${esc(vibe)}</button>`;
    }).join('');
  }

  const openBtn = picker.querySelector<HTMLButtonElement>('[data-picker-open]');
  if (openBtn) {
    openBtn.setAttribute('aria-pressed', String(pickerOpenNow));
  }
}

function renderPickerCard(cafe: Cafe, now: Date): string {
  const status = getOpenStatus(cafe, now);
  const distMeta =
    pickerLocationMode === 'auto' && pickerGeoOrigin
      ? `<span class="rcard__dist">${esc(formatDistanceKm(distanceKm(pickerGeoOrigin, { lat: cafe.lat, lng: cafe.lng })))} dari lokasimu</span>`
      : '';
  const chips = [...cafe.vibes.slice(0, 2), ...cafe.facilities.slice(0, 2)];

  return `
    <article class="rcard" style="--cc-accent:${esc(cafe.accentColor)}">
      <div class="rcard__art">
        <span class="rcard__mono">${esc(getInitials(cafe.name))}</span>
        ${cafePhotoMarkup(cafe)}
        <span class="rcard__stamp">Pilihanmu</span>
      </div>
      <div class="rcard__body">
        <div class="rcard__top">
          <span class="rcard__area">${esc(cafe.city)} · ${esc(cafe.area)}</span>
          <span class="cc__status${status.open ? ' is-open' : ''}"><i></i>${esc(status.label)}</span>
        </div>
        <h3 class="rcard__name">${esc(cafe.name)}</h3>
        <p class="rcard__tag">${esc(cafe.tagline)}</p>
        <div class="rcard__meta">
          <span><b>★ ${esc(cafe.rating.toFixed(1))}</b></span>
          ${cafe.reviewCount > 0 ? `<span>${esc(formatReviewCount(cafe.reviewCount))} ulasan</span>` : ''}
          <span>${esc(PRICE_LEVEL_SHORT[cafe.priceLevel])}</span>
          <span>${esc(formatHours(cafe))}</span>
          ${distMeta}
        </div>
        <div class="rcard__chips">
          ${chips.map((item) => `<span>${esc(item)}</span>`).join('')}
        </div>
        <p class="rcard__best"><b>Cocok untuk</b><br>${esc(cafe.bestFor)}</p>
        <div class="rcard__actions">
          <a href="${esc(cafe.mapsUrl)}" target="_blank" rel="noopener">${ICONS.pin}Buka Peta</a>
          <button class="rcard__respin" type="button" data-picker-respin>${ICONS.dice}<span>Acak lagi</span></button>
          ${saveButton(cafe, { className: 'rcard__save', idle: 'Simpan', active: 'Tersimpan' })}
          ${shareButton(cafe, { className: 'rcard__share', label: 'Bagikan' })}
        </div>
      </div>
    </article>
  `;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function spinPicker(picker: HTMLElement): void {
  const pool = pickerPool();
  const result = pickRandomCafe(pool, { excludeId: lastPickedId });
  if (!result) {
    renderPickerHint(picker);
    return;
  }

  const out = picker.querySelector<HTMLElement>('[data-picker-out]');
  const button = picker.querySelector<HTMLButtonElement>('[data-picker-spin]');
  if (!out) return;

  lastPickedId = result.id;

  if (prefersReducedMotion() || pool.length === 1) {
    out.setAttribute('aria-live', 'polite');
    out.innerHTML = renderPickerCard(result, new Date());
    syncBucketControls();
    playPickerReveal();
    return;
  }

  if (pickerTimer) window.clearTimeout(pickerTimer);
  if (button) button.disabled = true;
  out.setAttribute('aria-live', 'off');

  let tick = 0;
  const tickCount = 9;

  const step = (): void => {
    tick += 1;
    if (tick < tickCount) {
      const sample = pool[(tick * 3 + Math.floor(Math.random() * pool.length)) % pool.length];
      out.innerHTML = `<div class="picker__rolling"><span class="picker__rolling-kicker">Mengacak pilihan...</span><strong>${esc(sample.name)}</strong><span class="picker__rolling-sub">${esc(sample.city)} · ${esc(sample.area)}</span></div>`;
      playPickerTick(tick, tickCount);
      pickerTimer = window.setTimeout(step, 55 + tick * 12);
      return;
    }

    out.setAttribute('aria-live', 'polite');
    out.innerHTML = renderPickerCard(result, new Date());
    if (button) button.disabled = false;
    syncBucketControls();
    playPickerReveal();
  };

  step();
}

let activeTab: BucketTab = 'wishlist';
let bucketPreviousFocus: HTMLElement | null = null;
let bucketResetConfirmTimer: number | undefined;

function clearBucketResetConfirm(): void {
  if (bucketResetConfirmTimer) {
    window.clearTimeout(bucketResetConfirmTimer);
    bucketResetConfirmTimer = undefined;
  }
  const reset = document.querySelector<HTMLButtonElement>('[data-bucket-reset]');
  if (reset) {
    delete reset.dataset.confirm;
    reset.classList.remove('is-confirm');
    reset.textContent = 'Kosongkan';
  }
}

function setBucketOpen(open: boolean): void {
  const bucket = document.querySelector<HTMLElement>('[data-bucket]');
  if (!bucket) return;

  if (!open) clearBucketResetConfirm();

  bucket.classList.toggle('is-open', open);
  bucket.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('bucket-open', open);
  const mainEl = document.querySelector<HTMLElement>('[data-main]');
  if (mainEl) mainEl.inert = open;
  document
    .querySelectorAll<HTMLElement>('[data-bucket-toggle], [data-bucket-open]')
    .forEach((button) => button.setAttribute('aria-expanded', String(open)));

  if (open) {
    bucketPreviousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    bucket.querySelector<HTMLElement>('.bucket__close')?.focus();
  } else if (bucketPreviousFocus) {
    if (bucketPreviousFocus.isConnected) {
      bucketPreviousFocus.focus();
    } else {
      document.querySelector<HTMLElement>('[data-bucket-toggle]')?.focus();
    }
    bucketPreviousFocus = null;
  }
}

function isBucketOpen(): boolean {
  return document.querySelector('[data-bucket]')?.classList.contains('is-open') ?? false;
}

function syncBucketTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-bucket-tab]').forEach((tab) => {
    const selected = tab.dataset.bucketTab === activeTab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });

  const panel = document.querySelector<HTMLElement>('[data-bucket-body]');
  if (panel) panel.setAttribute('aria-labelledby', `bucket-tab-${activeTab}`);
}

function emptyBucketMarkup(tab: BucketTab): string {
  const wishlist = tab === 'wishlist';
  return `
    <div class="bucket__empty">
      <span class="bucket__empty-mark" aria-hidden="true">${wishlist ? '☆' : '✓'}</span>
      <b>${wishlist ? 'Belum ada rencana nongki' : 'Belum ada kunjungan'}</b>
      <p>${wishlist ? 'Tekan tombol Simpan di kartu kafe untuk menyusun daftar nongki berikutnya.' : 'Tandai kafe yang sudah kamu datangi supaya koleksi nongki-mu makin lengkap.'}</p>
      <a href="#direktori" data-bucket-close>Cari kafe${ICONS.pin}</a>
    </div>
  `;
}

function bucketItemMarkup(cafe: Cafe, tab: BucketTab, now: Date): string {
  const status = getOpenStatus(cafe, now);
  const isWish = tab === 'wishlist';

  return `
    <article class="bitem" style="--cc-accent:${esc(cafe.accentColor)}">
      <div class="bitem__art" aria-hidden="true">${esc(getInitials(cafe.name))}${cafePhotoMarkup(cafe)}</div>
      <div class="bitem__body">
        <h3 class="bitem__name">${esc(cafe.name)}</h3>
        <div class="bitem__meta">${esc(cafe.city)} · ${esc(cafe.area)} · ${esc(PRICE_LEVEL_SHORT[cafe.priceLevel])} · ${status.open ? 'buka sekarang' : 'sedang tutup'}</div>
        <div class="bitem__actions">
          <a href="${esc(cafe.mapsUrl)}" target="_blank" rel="noopener">Buka Peta</a>
          <button type="button" data-bucket-move="${esc(cafe.id)}" data-bucket-target="${isWish ? 'visited' : 'wishlist'}">${isWish ? 'Sudah ke sana' : 'Simpan lagi'}</button>
          <button type="button" class="bitem__remove" data-bucket-remove="${esc(cafe.id)}">Hapus</button>
        </div>
      </div>
    </article>
  `;
}

function renderBucketlist(): void {
  const state = getBucketlist();
  const now = new Date();
  const ids = state[activeTab];

  document.querySelectorAll<HTMLElement>('[data-bucket-tab-count]').forEach((el) => {
    const tab = el.dataset.bucketTabCount as BucketTab;
    el.textContent = String(state[tab].length);
  });

  let resolvedCount = 0;
  const body = document.querySelector<HTMLElement>('[data-bucket-body]');
  if (ids.length > 0) {
    const resolved = ids
      .map((id) => getCafeById(CAFES_DATA, id))
      .filter((cafe): cafe is Cafe => Boolean(cafe));
    resolvedCount = resolved.length;
    if (body) {
      body.innerHTML =
        resolvedCount > 0
          ? `<div class="bucket__list">${resolved.map((cafe) => bucketItemMarkup(cafe, activeTab, now)).join('')}</div>`
          : emptyBucketMarkup(activeTab);
    }
  } else if (body) {
    body.innerHTML = emptyBucketMarkup(activeTab);
  }

  const share = document.querySelector<HTMLButtonElement>('[data-bucket-share]');
  if (share) share.disabled = resolvedCount === 0;

  const reset = document.querySelector<HTMLButtonElement>('[data-bucket-reset]');
  if (reset) reset.disabled = state.wishlist.length + state.visited.length === 0;
  clearBucketResetConfirm();

  syncBucketTabs();
}

function syncBucketControls(): void {
  const badge = document.querySelector<HTMLElement>('[data-bucket-count]');
  const total = getBucketlist().wishlist.length + getBucketlist().visited.length;

  if (badge) {
    badge.textContent = String(total);
    badge.classList.toggle('is-empty', total === 0);
  }

  document.querySelectorAll<HTMLButtonElement>('[data-cafe-save]').forEach((button) => {
    const id = button.dataset.cafeSave ?? '';
    const on = isWishlisted(id);
    const aria = on ? 'Hapus dari daftar simpan' : 'Simpan ke daftar simpan';
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', aria);
    button.setAttribute('title', aria);
    const label = button.querySelector('[data-save-label]');
    if (label) {
      label.textContent = on
        ? (button.dataset.labelActive ?? 'Tersimpan')
        : (button.dataset.labelIdle ?? 'Simpan');
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-cafe-visited]').forEach((button) => {
    const id = button.dataset.cafeVisited ?? '';
    const on = isVisited(id);
    const aria = on ? 'Batalkan tanda sudah dikunjungi' : 'Tandai sudah dikunjungi';
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', aria);
    button.setAttribute('title', aria);
    const label = button.querySelector('[data-visited-label]');
    if (label) {
      label.textContent = on
        ? (button.dataset.labelActive ?? 'Dikunjungi')
        : (button.dataset.labelIdle ?? 'Tandai');
    }
  });

  renderBucketlist();
}

let toastTimer: number | undefined;

function showToast(message: string): void {
  const el = document.querySelector<HTMLElement>('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

async function copyText(text: string): Promise<boolean> {
  if (typeof navigator.clipboard?.writeText !== 'function') return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function handleCafeShare(cafeId: string, button: HTMLButtonElement): Promise<void> {
  const cafe = getCafeById(CAFES_DATA, cafeId);
  if (!cafe) return;

  button.disabled = true;
  try {
    const url = buildCafeShareUrl(cafe, window.location.href);
    const text = formatCafeShareText(cafe, url);

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${cafe.name} — Nongki`, text, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    const ok = await copyText(text);
    showToast(
      ok
        ? `Tautan ${cafe.name} disalin.`
        : 'Gagal menyalin tautan. Silakan salin alamat halaman secara manual.',
    );
  } finally {
    button.disabled = false;
  }
}

async function handleBucketShare(button: HTMLButtonElement): Promise<void> {
  const ids = getBucketlist()[activeTab];
  const cafes = ids
    .map((id) => getCafeById(CAFES_DATA, id))
    .filter((cafe): cafe is Cafe => Boolean(cafe));
  if (cafes.length === 0) return;

  const label = activeTab === 'wishlist' ? 'Mau ke sini' : 'Sudah ke sini';
  const text = formatBucketlistShareText(cafes, label);
  if (!text) return;

  button.disabled = true;
  try {
    const ok = await copyText(text);
    showToast(
      ok ? `Daftar simpan disalin (${cafes.length} kafe).` : 'Gagal menyalin daftar simpan.',
    );
  } finally {
    button.disabled = getBucketlist()[activeTab].length === 0;
  }
}

let activeCatalogTab: 'directory' | 'suggest' = 'directory';
let lastSubmittedSuggestion: CafeSuggestion | null = null;

function setCatalogTab(catalog: HTMLElement | null, tab: 'directory' | 'suggest'): void {
  if (!catalog) return;
  activeCatalogTab = tab;
  catalog.querySelectorAll<HTMLButtonElement>('[data-catalog-tab]').forEach((btn) => {
    const isActive = btn.dataset.catalogTab === tab;
    btn.setAttribute('aria-selected', String(isActive));
    btn.tabIndex = isActive ? 0 : -1;
  });
  catalog.querySelectorAll<HTMLElement>('[data-catalog-pane]').forEach((pane) => {
    pane.hidden = pane.dataset.catalogPane !== tab;
  });
}

function renderSuggestHistory(catalog: HTMLElement | null): void {
  if (!catalog) return;
  const items = loadSuggestions();
  const countBadge = catalog.querySelector<HTMLElement>('[data-suggest-count]');
  const emptyEl = catalog.querySelector<HTMLElement>('[data-suggest-empty]');
  const listEl = catalog.querySelector<HTMLElement>('[data-suggest-list]');

  if (countBadge) {
    countBadge.textContent = String(items.length);
    countBadge.hidden = items.length === 0;
  }
  if (emptyEl) emptyEl.hidden = items.length > 0;
  if (!listEl) return;

  listEl.innerHTML = items
    .map(
      (item) => `
      <li class="suggest-item">
        <div class="suggest-item__top">
          <span class="suggest-item__name">${esc(item.name)}</span>
          <span class="suggest-item__city">${esc(item.city)}</span>
        </div>
        ${item.area ? `<p class="suggest-item__meta">${esc(item.area)}</p>` : ''}
        ${item.notes ? `<p class="suggest-item__meta">${esc(item.notes)}</p>` : ''}
        <div class="suggest-item__actions">
          <a class="suggest-item__btn" href="${esc(buildSuggestionMailto(item))}">Kirim Email</a>
          <button class="suggest-item__btn" type="button" data-suggest-copy-id="${esc(item.id)}">Salin</button>
          <button class="suggest-item__btn" type="button" data-suggest-remove="${esc(item.id)}">Hapus</button>
        </div>
      </li>`,
    )
    .join('');
}

function selectCatalogCity(catalog: HTMLElement | null, city: City): void {
  if (catalog) {
    setCatalogTab(catalog, 'directory');
    catalogState.city = city;
    catalogState.area = '';
    syncCatalogUrl();
    renderCatalog(catalog);
  }
  const target = catalog ?? document.querySelector('#direktori');
  if (target) scrollToSection(target);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function initCafeUi(): void {
  const cods = Array.from(document.querySelectorAll<HTMLElement>('[data-cafe-of-day]'));
  const catalog = document.querySelector<HTMLElement>('[data-catalog]');
  const picker = document.querySelector<HTMLElement>('[data-picker]');

  syncDirectoryStats();

  if (cods.length === 0 && !catalog && !picker) return;

  if (cods.length > 0) {
    renderAllCafeOfTheDay(cods);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncDirectoryStats();
        if (getLocalDateKey() !== codDateKey) {
          renderAllCafeOfTheDay(cods);
          syncBucketControls();
        }
      }
    });
  }

  if (catalog) {
    buildCatalogChips(catalog);
    hydrateCatalogFromUrl(catalog);
    renderCatalog(catalog);

    const search = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
    search?.addEventListener('input', () => {
      savedCatalogBeforeInspect = null;
      catalogShowAll = false;
      catalogState.query = search.value;
      syncCatalogUrl();
      renderCatalog(catalog);
      syncBucketControls();
    });

    const sortSelect = catalog.querySelector<HTMLSelectElement>('[data-catalog-sort]');
    sortSelect?.addEventListener('change', () => {
      const value = sortSelect.value;
      savedCatalogBeforeInspect = null;
      catalogShowAll = false;
      catalogState.sort = (CAFE_SORTS as readonly string[]).includes(value)
        ? (value as CafeSort)
        : 'default';
      syncCatalogUrl();
      renderCatalog(catalog);
      syncBucketControls();
    });

    renderSuggestHistory(catalog);
    const suggestForm = catalog.querySelector<HTMLFormElement>('[data-suggest-form]');
    suggestForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(suggestForm);
      const name = String(formData.get('name') ?? '').trim();
      const city = String(formData.get('city') ?? '').trim();
      const area = String(formData.get('area') ?? '').trim();
      const link = String(formData.get('link') ?? '').trim();
      const notes = String(formData.get('notes') ?? '').trim();

      const errorEl = catalog.querySelector<HTMLElement>('[data-suggest-error]');
      const successBox = catalog.querySelector<HTMLElement>('[data-suggest-success]');
      const successMsg = catalog.querySelector<HTMLElement>('[data-suggest-success-msg]');
      const mailtoLink = catalog.querySelector<HTMLAnchorElement>('[data-suggest-mailto]');

      if (!name || !city) {
        if (errorEl) {
          errorEl.textContent = !name
            ? 'Isi nama kafe yang ingin kamu usulkan.'
            : 'Pilih kota lokasi kafe terlebih dahulu.';
          errorEl.hidden = false;
        }
        return;
      }

      if (errorEl) errorEl.hidden = true;
      const saved = addSuggestion({ name, city, area, link, notes });
      lastSubmittedSuggestion = saved;
      renderSuggestHistory(catalog);

      if (successMsg) {
        successMsg.textContent = `${saved.name} (${saved.city}) sudah dicatat. Klik "Kirim via Email" atau salin detailnya untuk dikirim ke tim Nongki.`;
      }
      if (mailtoLink) mailtoLink.href = buildSuggestionMailto(saved);
      if (successBox) successBox.hidden = false;
      suggestForm.hidden = true;
      showToast(`Usulan ${saved.name} disiapkan.`);
    });
  }

  if (picker) {
    renderPickerQuick(picker);
    renderPickerHint(picker);
  }

  const backToTop = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
  const footer = document.querySelector<HTMLElement>('.site-footer');
  const updateBackToTop = (): void => {
    if (!backToTop) return;
    const footerRect = footer?.getBoundingClientRect();
    const footerInView = Boolean(
      footerRect && footerRect.height > 0 && footerRect.top < window.innerHeight - 16,
    );
    backToTop.hidden = window.scrollY < BACK_TO_TOP_THRESHOLD || footerInView;
  };
  updateBackToTop();
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  window.addEventListener('resize', updateBackToTop, { passive: true });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('[data-back-to-top]')) {
      scrollToTop();
      return;
    }

    const codInspect = target.closest<HTMLButtonElement>('[data-cod-inspect]');
    if (codInspect) {
      inspectCafeInCatalog(catalog, codInspect.dataset.codInspect ?? '');
      return;
    }

    if (target.closest('[data-catalog-clear]') && catalog) {
      catalogState.query = '';
      const search = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
      if (search) {
        search.value = '';
        search.focus();
      }
      syncCatalogUrl();
      renderCatalog(catalog);
      syncBucketControls();
      return;
    }

    const openButton = target.closest<HTMLElement>('[data-bucket-toggle], [data-bucket-open]');
    if (openButton) {
      event.preventDefault();
      setBucketOpen(true);
      return;
    }

    const bucketLink = target.closest<HTMLAnchorElement>('a[href="#bucketlist"]');
    if (bucketLink) {
      event.preventDefault();
      activeTab = 'wishlist';
      setBucketOpen(true);
      syncBucketControls();
      return;
    }

    const close = target.closest<HTMLElement>('[data-bucket-close]');
    if (close) {
      if (!(close instanceof HTMLAnchorElement && close.getAttribute('href') !== '#')) {
        event.preventDefault();
      }
      setBucketOpen(false);
      return;
    }

    const tab = target.closest<HTMLButtonElement>('[data-bucket-tab]');
    if (tab) {
      activeTab = tab.dataset.bucketTab === 'visited' ? 'visited' : 'wishlist';
      renderBucketlist();
      return;
    }

    const remove = target.closest<HTMLButtonElement>('[data-bucket-remove]');
    if (remove) {
      removeFromBucketlist(remove.dataset.bucketRemove ?? '');
      return;
    }

    const move = target.closest<HTMLButtonElement>('[data-bucket-move]');
    if (move) {
      const id = move.dataset.bucketMove ?? '';
      if (move.dataset.bucketTarget === 'wishlist') toggleBucketWishlist(id);
      else toggleBucketVisited(id);
      return;
    }

    const resetBucket = target.closest<HTMLButtonElement>('[data-bucket-reset]');
    if (resetBucket) {
      if (resetBucket.dataset.confirm !== '1') {
        resetBucket.dataset.confirm = '1';
        resetBucket.classList.add('is-confirm');
        resetBucket.textContent = 'Yakin kosongkan?';
        if (bucketResetConfirmTimer) window.clearTimeout(bucketResetConfirmTimer);
        bucketResetConfirmTimer = window.setTimeout(() => clearBucketResetConfirm(), 4000);
        return;
      }
      clearBucketResetConfirm();
      resetBucketlist();
      showToast('Daftar simpan dikosongkan.');
      return;
    }

    const bucketShare = target.closest<HTMLButtonElement>('[data-bucket-share]');
    if (bucketShare) {
      void handleBucketShare(bucketShare);
      return;
    }

    const cafeShare = target.closest<HTMLButtonElement>('[data-cafe-share]');
    if (cafeShare) {
      void handleCafeShare(cafeShare.dataset.cafeShare ?? '', cafeShare);
      return;
    }

    const save = target.closest<HTMLButtonElement>('[data-cafe-save]');
    if (save) {
      toggleBucketWishlist(save.dataset.cafeSave ?? '');
      return;
    }

    const visited = target.closest<HTMLButtonElement>('[data-cafe-visited]');
    if (visited) {
      toggleBucketVisited(visited.dataset.cafeVisited ?? '');
      return;
    }

    if (target.closest('[data-catalog-restore]') && catalog && savedCatalogBeforeInspect) {
      const prev = savedCatalogBeforeInspect;
      savedCatalogBeforeInspect = null;
      catalogShowAll = false;
      catalogState.query = prev.query;
      catalogState.city = prev.city;
      catalogState.area = prev.area;
      catalogState.vibes = prev.vibes;
      catalogState.facilities = prev.facilities;
      catalogState.priceLevels = prev.priceLevels;
      catalogState.openNow = prev.openNow;
      catalogState.sort = prev.sort;

      const searchEl = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
      if (searchEl) searchEl.value = prev.query;
      const sortEl = catalog.querySelector<HTMLSelectElement>('[data-catalog-sort]');
      if (sortEl) sortEl.value = prev.sort;

      syncCatalogUrl();
      renderCatalog(catalog);
      syncBucketControls();
      return;
    }

    const presetBtn = target.closest<HTMLButtonElement>('[data-catalog-preset]');
    if (presetBtn && catalog) {
      const preset = CATALOG_PRESETS.find((item) => item.id === presetBtn.dataset.catalogPreset);
      if (preset) {
        savedCatalogBeforeInspect = null;
        applyPreset(preset);
        catalogShowAll = false;
        syncCatalogUrl();
        renderCatalog(catalog);
        syncBucketControls();
      }
      return;
    }

    if (target.closest('[data-catalog-more]') && catalog) {
      catalogShowAll = true;
      renderCatalog(catalog);
      syncBucketControls();
      return;
    }

    const clearChip = target.closest<HTMLButtonElement>('[data-clear-chip]');
    if (clearChip && catalog) {
      savedCatalogBeforeInspect = null;
      const chipType = clearChip.dataset.clearChip;
      const chipVal = clearChip.dataset.clearValue ?? '';
      if (chipType === 'query') {
        catalogState.query = '';
        const searchEl = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
        if (searchEl) searchEl.value = '';
      } else if (chipType === 'city') {
        catalogState.city = SEMUA_KOTA;
        catalogState.area = '';
      } else if (chipType === 'area') {
        catalogState.area = '';
      } else if (chipType === 'vibe') {
        catalogState.vibes = catalogState.vibes.filter((v) => v !== chipVal);
      } else if (chipType === 'facility') {
        catalogState.facilities = catalogState.facilities.filter((f) => f !== chipVal);
      } else if (chipType === 'price') {
        catalogState.priceLevels = catalogState.priceLevels.filter((p) => p !== Number(chipVal));
      } else if (chipType === 'open') {
        catalogState.openNow = false;
      } else if (chipType === 'sort') {
        catalogState.sort = 'default';
        const sortEl = catalog.querySelector<HTMLSelectElement>('[data-catalog-sort]');
        if (sortEl) sortEl.value = 'default';
      }
      catalogShowAll = false;
      syncCatalogUrl();
      renderCatalog(catalog);
      syncBucketControls();
      return;
    }

    const filter = target.closest<HTMLButtonElement>('[data-filter-group]');
    if (filter && catalog) {
      handleFilterClick(filter, catalog);
      syncBucketControls();
      return;
    }

    if (target.closest('[data-catalog-reset], [data-catalog-empty-reset]') && catalog) {
      resetCatalog(catalog);
      syncBucketControls();
      return;
    }

    const pickerLocModeBtn = target.closest<HTMLButtonElement>('[data-picker-loc-mode]');
    if (pickerLocModeBtn && picker) {
      const nextMode: PickerLocationMode =
        pickerLocModeBtn.dataset.pickerLocMode === 'auto' ? 'auto' : 'manual';
      window.clearTimeout(pickerTimer);
      pickerLocationMode = nextMode;
      if (nextMode === 'auto') {
        if (pickerGeoStatus !== 'ready') {
          requestDeviceLocation(picker);
        } else {
          renderPickerQuick(picker);
          renderPickerHint(picker);
        }
      } else {
        pickerGeoReqSeq += 1;
        if (pickerGeoStatus === 'loading') pickerGeoStatus = pickerGeoOrigin ? 'ready' : 'idle';
        renderPickerQuick(picker);
        renderPickerHint(picker);
      }
      return;
    }

    if (target.closest('[data-picker-loc-retry]') && picker) {
      window.clearTimeout(pickerTimer);
      requestDeviceLocation(picker);
      return;
    }

    const pickerRadiusBtn = target.closest<HTMLButtonElement>('[data-picker-radius]');
    if (pickerRadiusBtn && picker) {
      const km = Number(pickerRadiusBtn.dataset.pickerRadius);
      if ((PICKER_RADIUS_OPTIONS as readonly number[]).includes(km)) {
        window.clearTimeout(pickerTimer);
        pickerRadiusKm = km as PickerRadiusKm;
        renderPickerQuick(picker);
        renderPickerHint(picker);
      }
      return;
    }

    const pickerAreaBtn = target.closest<HTMLButtonElement>('[data-picker-area]');
    if (pickerAreaBtn && picker) {
      window.clearTimeout(pickerTimer);
      pickerArea = pickerAreaBtn.dataset.pickerArea ?? '';
      renderPickerQuick(picker);
      renderPickerHint(picker);
      return;
    }

    if (target.closest('[data-picker-widen-radius]') && picker) {
      window.clearTimeout(pickerTimer);
      pickerRadiusKm = 20;
      renderPickerQuick(picker);
      renderPickerHint(picker);
      return;
    }

    if (target.closest('[data-picker-switch-manual]') && picker) {
      window.clearTimeout(pickerTimer);
      pickerGeoReqSeq += 1;
      if (pickerGeoStatus === 'loading') pickerGeoStatus = pickerGeoOrigin ? 'ready' : 'idle';
      pickerLocationMode = 'manual';
      renderPickerQuick(picker);
      renderPickerHint(picker);
      return;
    }

    const pickerCityBtn = target.closest<HTMLButtonElement>('[data-picker-city]');
    if (pickerCityBtn && picker) {
      const value = pickerCityBtn.dataset.pickerCity ?? '';
      window.clearTimeout(pickerTimer);
      pickerCity = value === SEMUA_KOTA || !isCity(value) ? SEMUA_KOTA : value;
      pickerArea = '';
      renderPickerQuick(picker);
      renderPickerHint(picker);
      return;
    }

    const pickerOpenBtn = target.closest<HTMLButtonElement>('[data-picker-open]');
    if (pickerOpenBtn && picker) {
      window.clearTimeout(pickerTimer);
      pickerOpenNow = !pickerOpenNow;
      renderPickerQuick(picker);
      renderPickerHint(picker);
      return;
    }

    const vibe = target.closest<HTMLButtonElement>('[data-picker-vibe]');
    if (vibe && picker) {
      const value = vibe.dataset.pickerVibe ?? '';
      window.clearTimeout(pickerTimer);
      pickerVibe = pickerVibe === value ? null : (value as Vibe);
      renderPickerQuick(picker);
      renderPickerHint(picker);
      return;
    }

    if (target.closest('[data-picker-spin], [data-picker-respin]') && picker) {
      spinPicker(picker);
      return;
    }

    const codAnchor = target.closest<HTMLAnchorElement>('a[href="#cafe-of-the-day"]');
    if (codAnchor) {
      const desktopCod = document.querySelector<HTMLElement>('.cod-band');
      const mobileCod = document.querySelector<HTMLElement>('.herom [data-cafe-of-day]');
      const codTarget =
        desktopCod && window.getComputedStyle(desktopCod).display !== 'none'
          ? desktopCod
          : (mobileCod ?? desktopCod);
      if (codTarget) {
        event.preventDefault();
        scrollToSection(codTarget);
      }
      return;
    }

    const susanLink = target.closest<HTMLAnchorElement>('[data-susan-link]');
    if (susanLink) {
      const rawCity = (susanLink.dataset.selectCity ?? susanLink.dataset.city ?? '').trim();
      if (isCity(rawCity)) {
        event.preventDefault();
        selectCatalogCity(catalog, rawCity);
        return;
      }
      const href = susanLink.getAttribute('href') ?? '';
      if (href.startsWith('#')) {
        const dest = document.querySelector(href);
        if (dest) {
          event.preventDefault();
          scrollToSection(dest);
        }
      }
      return;
    }

    const selectCityEl = target.closest<HTMLElement>('[data-select-city]');
    if (selectCityEl) {
      const city = (selectCityEl.dataset.selectCity ?? '').trim();
      if (isCity(city)) {
        event.preventDefault();
        selectCatalogCity(catalog, city);
      }
      return;
    }

    const catalogTabBtn = target.closest<HTMLButtonElement>('[data-catalog-tab]');
    if (catalogTabBtn && catalog) {
      const tab = catalogTabBtn.dataset.catalogTab === 'suggest' ? 'suggest' : 'directory';
      setCatalogTab(catalog, tab);
      return;
    }

    if (target.closest('[data-open-suggest]') && catalog) {
      event.preventDefault();
      setCatalogTab(catalog, 'suggest');
      scrollToSection(catalog);
      window.setTimeout(() => {
        catalog.querySelector<HTMLInputElement>('#suggest-name')?.focus();
      }, 60);
      return;
    }

    if (target.closest('[data-suggest-copy]') && lastSubmittedSuggestion) {
      void copyText(formatSuggestionSummary(lastSubmittedSuggestion)).then((ok) => {
        showToast(ok ? 'Detail usulan disalin.' : 'Gagal menyalin detail usulan.');
      });
      return;
    }

    if (target.closest('[data-suggest-new]') && catalog) {
      const form = catalog.querySelector<HTMLFormElement>('[data-suggest-form]');
      const successBox = catalog.querySelector<HTMLElement>('[data-suggest-success]');
      if (form) {
        form.reset();
        form.hidden = false;
      }
      if (successBox) successBox.hidden = true;
      catalog.querySelector<HTMLInputElement>('#suggest-name')?.focus();
      return;
    }

    const suggestCopyIdBtn = target.closest<HTMLButtonElement>('[data-suggest-copy-id]');
    if (suggestCopyIdBtn) {
      const item = loadSuggestions().find((entry) => entry.id === suggestCopyIdBtn.dataset.suggestCopyId);
      if (item) {
        void copyText(formatSuggestionSummary(item)).then((ok) => {
          showToast(ok ? `Usulan ${item.name} disalin.` : 'Gagal menyalin usulan.');
        });
      }
      return;
    }

    const suggestRemoveBtn = target.closest<HTMLButtonElement>('[data-suggest-remove]');
    if (suggestRemoveBtn && catalog) {
      removeSuggestion(suggestRemoveBtn.dataset.suggestRemove ?? '');
      renderSuggestHistory(catalog);
      showToast('Usulan dihapus.');
    }
  });

  document.addEventListener('keydown', (event) => {
    const catalogTabTarget =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-catalog-tab]') : null;
    if (catalogTabTarget && catalog && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      let nextTab: 'directory' | 'suggest' = activeCatalogTab === 'directory' ? 'suggest' : 'directory';
      if (event.key === 'Home') nextTab = 'directory';
      else if (event.key === 'End') nextTab = 'suggest';
      setCatalogTab(catalog, nextTab);
      catalog.querySelector<HTMLButtonElement>(`[data-catalog-tab="${nextTab}"]`)?.focus();
      return;
    }

    if (
      event.key === '/' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isBucketOpen() &&
      document.body.dataset.menuStatus !== 'open' &&
      !isEditableTarget(event.target)
    ) {
      const search = catalog?.querySelector<HTMLInputElement>('[data-catalog-search]');
      if (search) {
        event.preventDefault();
        search.focus();
        if (catalog) scrollToSection(catalog);
      }
      return;
    }

    if (!isBucketOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setBucketOpen(false);
      return;
    }

    const tabTarget =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-bucket-tab]') : null;
    if (tabTarget && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Home') activeTab = 'wishlist';
      else if (event.key === 'End') activeTab = 'visited';
      else activeTab = activeTab === 'wishlist' ? 'visited' : 'wishlist';
      renderBucketlist();
      document.querySelector<HTMLButtonElement>(`[data-bucket-tab="${activeTab}"]`)?.focus();
      return;
    }

    if (event.key !== 'Tab') return;

    const bucket = document.querySelector<HTMLElement>('[data-bucket]');
    const focusable = bucket?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (img instanceof HTMLImageElement && img.classList.contains('cafe-photo')) {
        img.remove();
      }
    },
    true,
  );

  subscribeBucketlist(() => syncBucketControls());
  syncBucketControls();

  if (window.location.hash === '#bucketlist') {
    activeTab = 'wishlist';
    setBucketOpen(true);
    renderBucketlist();
  } else if (window.location.hash === '#usulkan-kafe' && catalog) {
    setCatalogTab(catalog, 'suggest');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCafeUi);
} else {
  initCafeUi();
}
