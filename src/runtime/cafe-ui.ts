/**
 * Runtime UI Nongki, Fase 1:
 * - Kafe Pilihan Hari Ini di hero mobile
 * - katalog + filter
 * - pemilih acak
 * - laci daftar simpan
 *
 * Semua teks berasal dari data statis, tetapi tetap di-escape karena nanti
 * data bisa datang dari luar (mis. CMS atau API).
 */

import {
  CAFES_DATA,
  CITIES,
  FACILITIES,
  PRICE_LEVELS,
  PRICE_LEVEL_SHORT,
  VIBES,
  type Cafe,
  type Facility,
  type PriceLevel,
  type Vibe,
} from '../data/cafes';
import {
  SEMUA_KOTA,
  filterCafes,
  formatHours,
  formatReviewCount,
  getCafeById,
  getCafeOfTheDay,
  getDailyLabel,
  getInitials,
  getOpenStatus,
  getLocalDateKey,
  pickRandomCafe,
  type CityFilter,
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

const ICONS = {
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.8h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.8a1 1 0 0 1 1-1Z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>`,
  dice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none"/></svg>`,
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
  return `<button class="${options.className}${on ? ' is-on' : ''}" type="button" data-cafe-save="${esc(cafe.id)}" data-label-idle="${esc(options.idle)}" data-label-active="${esc(options.active)}" aria-pressed="${on}" aria-label="${on ? 'Hapus dari daftar simpan' : 'Simpan ke daftar simpan'}">${ICONS.bookmark}<span data-save-label>${esc(label)}</span></button>`;
}

function visitedButton(
  cafe: Cafe,
  options: { className: string; idle: string; active: string },
): string {
  const on = isVisited(cafe.id);
  const label = on ? options.active : options.idle;
  return `<button class="${options.className}${on ? ' is-on' : ''}" type="button" data-cafe-visited="${esc(cafe.id)}" data-label-idle="${esc(options.idle)}" data-label-active="${esc(options.active)}" aria-pressed="${on}" aria-label="${on ? 'Batalkan tanda sudah dikunjungi' : 'Tandai sudah dikunjungi'}">${ICONS.check}<span data-visited-label>${esc(label)}</span></button>`;
}

/* ------------------------------------------------------------------ */
/* Kafe Pilihan Hari Ini                                               */
/* ------------------------------------------------------------------ */

let codDateKey = '';

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

  container.innerHTML = `
    <div class="cod__head">
      <span class="cod__kicker"><i></i>Kafe Pilihan Hari Ini</span>
      <span class="cod__date">${esc(getDailyLabel(now))}</span>
    </div>
    <article class="cod__card" style="--cod-accent:${esc(cafe.accentColor)}">
      <div class="cod__art">
        <span class="cod__mono">${esc(getInitials(cafe.name))}</span>
        <span class="cod__art-area">${esc(cafe.city)}</span>
      </div>
      <div class="cod__body">
        <div class="cod__row">
          <span class="cod__area">${esc(cafe.city)} · ${esc(cafe.area)}</span>
          <span class="cc__status${status.open ? ' is-open' : ''}"><i></i>${esc(status.label)}</span>
        </div>
        <h3 class="cod__name">${esc(cafe.name)}</h3>
        <p class="cod__tag">${esc(cafe.tagline)}</p>
        <div class="cod__facts">
          <span><b>★ ${esc(cafe.rating.toFixed(1))}</b> ${esc(formatReviewCount(cafe.reviewCount))} ulasan</span>
          <span>${esc(PRICE_LEVEL_SHORT[cafe.priceLevel])}</span>
          <span>${esc(hours)}</span>
        </div>
        <div class="cod__tags">
          ${cafe.vibes.slice(0, 3).map((vibe) => `<span>${esc(vibe)}</span>`).join('')}
        </div>
        <div class="cod__actions">
          <a class="cod__cta" href="${esc(cafe.mapsUrl)}" target="_blank" rel="noopener">Rute ke sana</a>
          ${saveButton(cafe, { className: 'cod__save', idle: 'Simpan', active: 'Tersimpan' })}
        </div>
      </div>
    </article>
  `;
}

/* ------------------------------------------------------------------ */
/* Katalog                                                             */
/* ------------------------------------------------------------------ */

interface CatalogState {
  query: string;
  city: CityFilter;
  vibes: Vibe[];
  facilities: Facility[];
  priceLevels: PriceLevel[];
  openNow: boolean;
}

const catalogState: CatalogState = {
  query: '',
  city: SEMUA_KOTA,
  vibes: [],
  facilities: [],
  priceLevels: [],
  openNow: false,
};

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function chip(value: string, group: string, label: string): string {
  return `<button class="fchip" type="button" data-filter-group="${esc(group)}" data-filter-value="${esc(value)}" aria-pressed="false">${esc(label)}</button>`;
}

function buildCatalogChips(catalog: HTMLElement): void {
  const city = catalog.querySelector<HTMLElement>('[data-filter-city]');
  const vibes = catalog.querySelector<HTMLElement>('[data-filter-vibes]');
  const facilities = catalog.querySelector<HTMLElement>('[data-filter-facilities]');
  const prices = catalog.querySelector<HTMLElement>('[data-filter-price]');
  const open = catalog.querySelector<HTMLElement>('[data-filter-open]');

  if (city) {
    city.innerHTML = [SEMUA_KOTA, ...CITIES].map((value) => chip(value, 'city', value)).join('');
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

function syncCatalogChips(catalog: HTMLElement): void {
  catalog.querySelectorAll<HTMLButtonElement>('[data-filter-group]').forEach((button) => {
    const group = button.dataset.filterGroup;
    const value = button.dataset.filterValue ?? '';
    let pressed = false;

    if (group === 'city') pressed = catalogState.city === value;
    else if (group === 'vibe') pressed = catalogState.vibes.includes(value as Vibe);
    else if (group === 'facility') pressed = catalogState.facilities.includes(value as Facility);
    else if (group === 'price') pressed = catalogState.priceLevels.includes(Number(value) as PriceLevel);
    else if (group === 'open') pressed = catalogState.openNow;

    button.setAttribute('aria-pressed', String(pressed));
  });
}

function hasActiveFilters(): boolean {
  return (
    catalogState.query.trim().length > 0 ||
    catalogState.city !== SEMUA_KOTA ||
    catalogState.vibes.length > 0 ||
    catalogState.facilities.length > 0 ||
    catalogState.priceLevels.length > 0 ||
    catalogState.openNow
  );
}

function renderCafeCard(cafe: Cafe, now: Date): string {
  const tags = [
    ...cafe.vibes.slice(0, 3),
    ...cafe.facilities.slice(0, 2),
  ];

  return `
    <article class="cc" style="--cc-accent:${esc(cafe.accentColor)}">
      <div class="cc__media">
        <span class="cc__mono">${esc(getInitials(cafe.name))}</span>
        <div class="cc__media-top">
          <span class="cc__area">${esc(cafe.city)} · ${esc(cafe.area)}</span>
          ${statusMarkup(cafe, now)}
        </div>
      </div>
      <div class="cc__body">
        <h3 class="cc__name">${esc(cafe.name)}</h3>
        <p class="cc__tag">${esc(cafe.tagline)}</p>
        <div class="cc__meta">
          <span>★ ${esc(cafe.rating.toFixed(1))}</span>
          <span>${esc(formatReviewCount(cafe.reviewCount))} ulasan</span>
          <span>${esc(PRICE_LEVEL_SHORT[cafe.priceLevel])}</span>
          <span>${esc(formatHours(cafe))}</span>
        </div>
        <div class="cc__tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>
        <div class="cc__actions">
          <a class="cc__cta" href="${esc(cafe.mapsUrl)}" target="_blank" rel="noopener">${ICONS.pin}Rute ke sana</a>
          ${saveButton(cafe, { className: 'cc__icon', idle: 'Simpan', active: 'Tersimpan' })}
          ${visitedButton(cafe, { className: 'cc__icon', idle: 'Tandai', active: 'Dikunjungi' })}
        </div>
        <details class="cc__more">
          <summary>Detail &amp; menu</summary>
          <p>${esc(cafe.description)}</p>
          <div class="cc__menu">${cafe.menuHighlights.map((item) => `<span>${esc(item)}</span>`).join('')}</div>
          <p style="margin-top:8px">${esc(cafe.address)}</p>
        </details>
      </div>
    </article>
  `;
}

function renderCatalog(catalog: HTMLElement): void {
  const now = new Date();
  const results = filterCafes(CAFES_DATA, {
    query: catalogState.query,
    city: catalogState.city,
    vibes: catalogState.vibes,
    facilities: catalogState.facilities,
    priceLevels: catalogState.priceLevels,
    openNow: catalogState.openNow,
    now,
  });

  syncCatalogChips(catalog);

  const grid = catalog.querySelector<HTMLElement>('[data-catalog-grid]');
  const count = catalog.querySelector<HTMLElement>('[data-catalog-count]');
  const empty = catalog.querySelector<HTMLElement>('[data-catalog-empty]');
  const reset = catalog.querySelector<HTMLButtonElement>('[data-catalog-reset]');

  if (grid) {
    grid.innerHTML = results.map((cafe) => renderCafeCard(cafe, now)).join('');
    grid.hidden = results.length === 0;
  }
  if (count) {
    count.innerHTML = `<b>${results.length}</b> dari ${CAFES_DATA.length} kafe`;
  }
  if (empty) empty.hidden = results.length > 0;
  if (reset) reset.disabled = !hasActiveFilters();
}

function handleFilterClick(button: HTMLButtonElement, catalog: HTMLElement): void {
  const group = button.dataset.filterGroup;
  const value = button.dataset.filterValue ?? '';

  if (group === 'city') catalogState.city = value as CityFilter;
  else if (group === 'vibe') catalogState.vibes = toggleValue(catalogState.vibes, value as Vibe);
  else if (group === 'facility') {
    catalogState.facilities = toggleValue(catalogState.facilities, value as Facility);
  } else if (group === 'price') {
    catalogState.priceLevels = toggleValue(catalogState.priceLevels, Number(value) as PriceLevel);
  } else if (group === 'open') catalogState.openNow = !catalogState.openNow;

  renderCatalog(catalog);
}

function resetCatalog(catalog: HTMLElement): void {
  catalogState.query = '';
  catalogState.city = SEMUA_KOTA;
  catalogState.vibes = [];
  catalogState.facilities = [];
  catalogState.priceLevels = [];
  catalogState.openNow = false;

  const search = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
  if (search) search.value = '';

  renderCatalog(catalog);
}

/* ------------------------------------------------------------------ */
/* Random picker                                                       */
/* ------------------------------------------------------------------ */

let pickerVibe: Vibe | null = null;
let lastPickedId: string | undefined;
let pickerTimer: number | undefined;

function pickerPool(): Cafe[] {
  return pickerVibe ? CAFES_DATA.filter((cafe) => cafe.vibes.includes(pickerVibe as Vibe)) : CAFES_DATA;
}

function renderPickerHint(picker: HTMLElement): void {
  const out = picker.querySelector<HTMLElement>('[data-picker-out]');
  if (!out) return;

  const total = pickerPool().length;
  const label = pickerVibe ? `suasana ${pickerVibe}` : 'semua suasana';
  out.innerHTML = `<div class="picker__hint">Ada <b>${total}</b> kafe untuk ${esc(label)}. Tekan tombol di atas, biar Nongki yang memilih.</div>`;
}

function renderPickerQuick(picker: HTMLElement): void {
  const holder = picker.querySelector<HTMLElement>('[data-picker-vibes]');
  if (!holder) return;

  holder.innerHTML = VIBES.map((vibe) => {
    const pressed = pickerVibe === vibe;
    return `<button class="fchip" type="button" data-picker-vibe="${esc(vibe)}" aria-pressed="${pressed}">${esc(vibe)}</button>`;
  }).join('');
}

function renderPickerCard(cafe: Cafe, now: Date): string {
  const status = getOpenStatus(cafe, now);

  return `
    <article class="rcard" style="--cc-accent:${esc(cafe.accentColor)}">
      <span class="rcard__stamp">Pilihanmu</span>
      <div class="rcard__top">
        <span class="rcard__area">${esc(cafe.city)} · ${esc(cafe.area)}</span>
        <span class="cc__status${status.open ? ' is-open' : ''}"><i></i>${esc(status.label)}</span>
      </div>
      <h3 class="rcard__name">${esc(cafe.name)}</h3>
      <p class="rcard__tag">${esc(cafe.tagline)}</p>
      <div class="rcard__meta">
        <span>★ ${esc(cafe.rating.toFixed(1))}</span>
        <span>${esc(formatReviewCount(cafe.reviewCount))} ulasan</span>
        <span>${esc(PRICE_LEVEL_SHORT[cafe.priceLevel])}</span>
        <span>${esc(formatHours(cafe))}</span>
      </div>
      <p class="rcard__best"><b>Cocok untuk</b><br>${esc(cafe.bestFor)}</p>
      <div class="rcard__actions">
        <a href="${esc(cafe.mapsUrl)}" target="_blank" rel="noopener">${ICONS.pin}Buka Peta</a>
        ${saveButton(cafe, { className: 'rcard__save', idle: 'Simpan', active: 'Tersimpan' })}
      </div>
    </article>
  `;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function spinPicker(picker: HTMLElement): void {
  const pool = pickerPool();
  const result = pickRandomCafe(pool, { excludeId: lastPickedId });
  if (!result) return;

  const out = picker.querySelector<HTMLElement>('[data-picker-out]');
  const button = picker.querySelector<HTMLButtonElement>('[data-picker-spin]');
  if (!out) return;

  lastPickedId = result.id;

  if (prefersReducedMotion() || pool.length === 1) {
    out.innerHTML = renderPickerCard(result, new Date());
    return;
  }

  if (pickerTimer) window.clearTimeout(pickerTimer);
  if (button) button.disabled = true;

  let tick = 0;
  const tickCount = 9;

  const step = (): void => {
    tick += 1;
    if (tick < tickCount) {
      const sample = pool[(tick * 3 + Math.floor(Math.random() * pool.length)) % pool.length];
      out.innerHTML = `<div class="picker__rolling">${esc(sample.name)}</div>`;
      pickerTimer = window.setTimeout(step, 55 + tick * 12);
      return;
    }

    out.innerHTML = renderPickerCard(result, new Date());
    if (button) button.disabled = false;
    syncBucketControls();
  };

  step();
}

/* ------------------------------------------------------------------ */
/* Bucketlist drawer                                                   */
/* ------------------------------------------------------------------ */

let activeTab: BucketTab = 'wishlist';
let bucketPreviousFocus: HTMLElement | null = null;

function setBucketOpen(open: boolean): void {
  const bucket = document.querySelector<HTMLElement>('[data-bucket]');
  if (!bucket) return;

  bucket.classList.toggle('is-open', open);
  bucket.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('bucket-open', open);
  document
    .querySelectorAll<HTMLElement>('[data-bucket-toggle], [data-bucket-open]')
    .forEach((button) => button.setAttribute('aria-expanded', String(open)));

  if (open) {
    bucketPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    bucket.querySelector<HTMLElement>('.bucket__close')?.focus();
  } else if (bucketPreviousFocus) {
    bucketPreviousFocus.focus();
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
      <div class="bitem__art" aria-hidden="true">${esc(getInitials(cafe.name))}</div>
      <div class="bitem__body">
        <h3 class="bitem__name">${esc(cafe.name)}</h3>
        <div class="bitem__meta">${esc(cafe.city)} · ${esc(cafe.area)} · ${esc(PRICE_LEVEL_SHORT[cafe.priceLevel])} · ${status.open ? 'buka sekarang' : 'sedang tutup'}</div>
        <div class="bitem__actions">
          <a href="${esc(cafe.mapsUrl)}" target="_blank" rel="noopener">Peta</a>
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

  const body = document.querySelector<HTMLElement>('[data-bucket-body]');
  if (body) {
    if (ids.length === 0) {
      body.innerHTML = emptyBucketMarkup(activeTab);
    } else {
      const items = ids
        .map((id) => getCafeById(CAFES_DATA, id))
        .filter((cafe): cafe is Cafe => Boolean(cafe))
        .map((cafe) => bucketItemMarkup(cafe, activeTab, now));
      body.innerHTML = items.length > 0 ? `<div class="bucket__list">${items.join('')}</div>` : emptyBucketMarkup(activeTab);
    }
  }

  const reset = document.querySelector<HTMLButtonElement>('[data-bucket-reset]');
  if (reset) reset.disabled = state.wishlist.length + state.visited.length === 0;

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
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? 'Hapus dari daftar simpan' : 'Simpan ke daftar simpan');
    const label = button.querySelector('[data-save-label]');
    if (label) label.textContent = on ? (button.dataset.labelActive ?? 'Tersimpan') : (button.dataset.labelIdle ?? 'Simpan');
  });

  document.querySelectorAll<HTMLButtonElement>('[data-cafe-visited]').forEach((button) => {
    const id = button.dataset.cafeVisited ?? '';
    const on = isVisited(id);
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? 'Batalkan tanda sudah dikunjungi' : 'Tandai sudah dikunjungi');
    const label = button.querySelector('[data-visited-label]');
    if (label) label.textContent = on ? (button.dataset.labelActive ?? 'Dikunjungi') : (button.dataset.labelIdle ?? 'Tandai');
  });

  renderBucketlist();
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function initCafeUi(): void {
  const cod = document.querySelector<HTMLElement>('[data-cafe-of-day]');
  const catalog = document.querySelector<HTMLElement>('[data-catalog]');
  const picker = document.querySelector<HTMLElement>('[data-picker]');

  if (!cod && !catalog && !picker) return;

  if (cod) {
    renderCafeOfTheDay(cod);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && getLocalDateKey() !== codDateKey) {
        renderCafeOfTheDay(cod);
      }
    });
  }

  if (catalog) {
    buildCatalogChips(catalog);
    renderCatalog(catalog);

    const search = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
    search?.addEventListener('input', () => {
      catalogState.query = search.value;
      renderCatalog(catalog);
    });
  }

  if (picker) {
    renderPickerQuick(picker);
    renderPickerHint(picker);
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

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
      resetBucketlist();
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

    const filter = target.closest<HTMLButtonElement>('[data-filter-group]');
    if (filter && catalog) {
      handleFilterClick(filter, catalog);
      return;
    }

    if (target.closest('[data-catalog-reset]') && catalog) {
      resetCatalog(catalog);
      return;
    }

    const vibe = target.closest<HTMLButtonElement>('[data-picker-vibe]');
    if (vibe && picker) {
      const value = vibe.dataset.pickerVibe ?? '';
      pickerVibe = pickerVibe === value ? null : (value as Vibe);
      renderPickerQuick(picker);
      renderPickerHint(picker);
      return;
    }

    if (target.closest('[data-picker-spin]') && picker) {
      spinPicker(picker);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!isBucketOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setBucketOpen(false);
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

  subscribeBucketlist(() => syncBucketControls());
  syncBucketControls();

  if (window.location.hash === '#bucketlist') {
    activeTab = 'wishlist';
    setBucketOpen(true);
    renderBucketlist();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCafeUi);
} else {
  initCafeUi();
}
