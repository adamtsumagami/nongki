import { beforeAll, describe, expect, it, vi } from 'vitest';
import rawHtml from '../index.html?raw';
import { CAFES_DATA } from './data/cafes';
import { resetSoundStateForTest } from './lib/sound';
import themeSource from './vendor/theme.js?raw';
import homeMSource from './vendor/home-m.js?raw';

function mountHtmlAndBoot() {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  document.documentElement.innerHTML = doc.documentElement.innerHTML;
  document.body.className = doc.body.className;
  for (const attr of Array.from(doc.body.attributes)) {
    document.body.setAttribute(attr.name, attr.value);
  }
}

describe('Nongki Platform', () => {
  beforeAll(async () => {
    mountHtmlAndBoot();
    await import('./main');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 30));
  });

  it('removes the discount popup, preloads stylesheets in head without FOUC, and keeps zero external CDN assets', () => {
    const sections = [
      'shopify-section-sections--20401917132969__header',
      'shopify-section-template--20401917558953__home_mobile',
      'shopify-section-template--20401917558953__hero',
      'shopify-section-template--20401917558953__reviews',
      'shopify-section-template--20401917558953__values',
      'shopify-section-template--20401917558953__carousel',
      'shopify-section-template--20401917558953__pillars',
      'shopify-section-template--20401917558953__timeline',
      'shopify-section-template--20401917558953__cta',
      'shopify-section-template--20401917558953__app',
      'shopify-section-template--20401917558953__subscribe',
      'shopify-section-sections--20401917100201__footer',
    ];
    for (const id of sections) {
      expect(document.getElementById(id), `missing section ${id}`).not.toBeNull();
    }
    expect(document.getElementById('shopify-section-newsletter-popup')).toBeNull();
    expect(document.querySelector('[data-fvp]')).toBeNull();

    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    const headLinks = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]')).map((l) =>
      l.getAttribute('href'),
    );
    expect(headLinks).toContain('/src/styles/fonts.css');
    expect(headLinks).toContain('/src/styles/base.css');
    expect(headLinks).toContain('/src/styles/home-m.css');

    expect(rawHtml).not.toMatch(/\/\/apocalypsecoffee\.com\/cdn\/shop\//i);
    expect(themeSource).not.toMatch(/apocalypsecoffee\.com\/cdn\/shop\/.*\.(png|webp|jpg|svg)/i);
    expect(homeMSource).not.toMatch(/apocalypsecoffee\.com\/cdn\/shop\/.*\.(png|webp|jpg|svg)/i);
  });

  it('toggles the underlay navigation menu drawer via theme.js bindings', () => {
    const toggleBtn = document.querySelector('[data-menu-toggle]') as HTMLElement;
    expect(toggleBtn).not.toBeNull();
    toggleBtn.click();
    expect(document.body.dataset.menuStatus).toBe('open');

    const closeBtn = document.querySelector('[data-menu-close]') as HTMLElement;
    closeBtn.click();
    expect(document.body.dataset.menuStatus).toBe('closed');
  });

  it('opens the daftar simpan drawer via the header bucket button', () => {
    const bucket = document.querySelector('[data-bucket]') as HTMLElement;
    const toggle = document.querySelector('[data-bucket-toggle]') as HTMLElement;
    expect(bucket).not.toBeNull();
    expect(toggle).not.toBeNull();

    expect(bucket.classList.contains('is-open')).toBe(false);
    toggle.click();
    expect(bucket.classList.contains('is-open')).toBe(true);
    expect(bucket.getAttribute('aria-hidden')).toBe('false');

    const close = bucket.querySelector('[data-bucket-close]') as HTMLElement;
    close.click();
    expect(bucket.classList.contains('is-open')).toBe(false);
    expect(bucket.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders shared catalog and random picker directly under MainContent', () => {
    expect(document.querySelectorAll('[data-catalog]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-picker]')).toHaveLength(1);
    expect(document.querySelector('#MainContent > [data-catalog]')).not.toBeNull();
    expect(document.querySelector('#MainContent > [data-picker]')).not.toBeNull();
    expect(
      document.querySelector('#shopify-section-template--20401917558953__home_mobile [data-catalog]'),
    ).toBeNull();
  });

  it('populates both mobile and desktop Cafe of the Day cards', () => {
    const mobileCod = document.querySelector<HTMLElement>('[data-cafe-of-day="mobile"]');
    const desktopCod = document.querySelector<HTMLElement>('[data-cafe-of-day="desktop"]');
    const mobileTitle = mobileCod?.querySelector('h3')?.textContent?.trim() ?? '';
    const desktopTitle = desktopCod?.querySelector('h3')?.textContent?.trim() ?? '';
    expect(mobileTitle.length).toBeGreaterThan(0);
    expect(desktopTitle).toBe(mobileTitle);
  });

  it('renders city filter chips, filters Pontianak, and resets catalog', () => {
    const cityButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-filter-city] button'),
    );
    expect(cityButtons.length).toBeGreaterThanOrEqual(8);

    const pontianakBtn = cityButtons.find((btn) => btn.textContent?.trim().startsWith('Pontianak'));
    expect(pontianakBtn).toBeDefined();
    pontianakBtn!.click();

    const totalCafes = CAFES_DATA.length;
    const pontianakCount = CAFES_DATA.filter((c) => c.city === 'Pontianak').length;
    const countEl = document.querySelector<HTMLElement>('[data-catalog-count]');
    expect(countEl?.textContent).toContain(`${pontianakCount} dari ${totalCafes} kafe`);
    expect(document.querySelectorAll('#direktori img.cafe-photo').length).toBeGreaterThan(0);

    const resetBtn = document.querySelector<HTMLButtonElement>('[data-catalog-reset]');
    expect(resetBtn?.disabled).toBe(false);
    resetBtn!.click();
    expect(countEl?.textContent).toContain(`${totalCafes} dari ${totalCafes} kafe`);
  });

  it('saves and removes cafe in bucketlist drawer with Lenis opt-out', () => {
    const bucketBody = document.querySelector<HTMLElement>('[data-bucket-body]');
    const bucketCount = document.querySelector<HTMLElement>('[data-bucket-count]');
    expect(bucketBody?.hasAttribute('data-lenis-prevent')).toBe(true);

    const saveBtn = Array.from(
      document.querySelectorAll<HTMLButtonElement>('#direktori .cc-grid button'),
    ).find((btn) => /simpan/i.test(btn.textContent ?? ''));
    expect(saveBtn).toBeDefined();

    const initialCount = bucketCount?.textContent?.trim() ?? '';
    saveBtn!.click();
    expect(bucketCount?.textContent?.trim()).not.toBe(initialCount);
    expect(bucketBody?.textContent?.trim().length).toBeGreaterThan(0);

    saveBtn!.click();
    expect(bucketCount?.textContent?.trim()).toBe(initialCount);
  });

  it('filters random picker by city and open-now, then renders picked card', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-14T03:00:00Z'));

      const cityBtn = document.querySelector<HTMLButtonElement>('[data-picker-city="Bandung"]');
      const openBtn = document.querySelector<HTMLButtonElement>('[data-picker-open]');
      const spinBtn = document.querySelector<HTMLButtonElement>('[data-picker-spin]');
      const out = document.querySelector<HTMLElement>('[data-picker-out]');

      expect(cityBtn).not.toBeNull();
      expect(openBtn).not.toBeNull();
      expect(spinBtn).not.toBeNull();

      cityBtn!.click();
      openBtn!.click();
      expect(openBtn!.getAttribute('aria-pressed')).toBe('true');

      spinBtn!.click();
      vi.advanceTimersByTime(5000);

      expect(out?.querySelector('.rcard')).not.toBeNull();
      expect(out?.textContent).toContain('Bandung');

      openBtn!.click();
      document.querySelector<HTMLButtonElement>('[data-picker-city="Semua kota"]')?.click();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets menu toggle attributes when clicking underlay nav close link', () => {
    const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]')!;
    const underlayLink = document.querySelector<HTMLElement>('.underlay-nav__link-large[data-menu-close]')!;

    toggle.click();
    expect(document.body.dataset.menuStatus).toBe('open');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    underlayLink.click();
    expect(document.body.dataset.menuStatus).toBe('closed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps legacy commerce copy, fictional reviews, and data-filter-area out of index.html', () => {
    for (const required of ['og:title', 'twitter:card', 'catalog__notice']) {
      expect(rawHtml).toContain(required);
    }
    for (const forbidden of [
      'data-filter-area',
      'Third-party certified beans',
      'Kebijakan Pengembalian',
      'Kebijakan Pengiriman',
      'Family-Owned',
      'Atur Kadensi',
      'App Store',
      'Google Play',
      'Sharon D.',
      'Cori S.',
      'Kaylee S.R.',
      'Matt B.',
      'Ivan R.',
      'Frank A.',
      'Barbara M.',
      'Permainan papan',
      '700+ pengguna',
      'terlengkap di Indonesia',
    ]) {
      expect(rawHtml).not.toContain(forbidden);
    }
  });

  it('ignores side carousel bag clicks while synced [data-susan-link] filters catalog', () => {
    const countEl = document.querySelector<HTMLElement>('[data-catalog-count]')!;
    const sideBag = document.querySelector<HTMLElement>('.rs__bag[data-select-city="Bandung"]')!;
    const susanLink = document.querySelector<HTMLAnchorElement>('.rs__from[data-susan-link]')!;

    try {
      expect(susanLink.dataset.selectCity).toBe('Jakarta');

      const totalCafes = CAFES_DATA.length;
      const bandungCount = CAFES_DATA.filter((c) => c.city === 'Bandung').length;
      sideBag.click();
      expect(countEl.textContent).toContain(`${totalCafes} dari ${totalCafes} kafe`);
      expect(susanLink.dataset.selectCity).toBe('Bandung');

      susanLink.click();
      expect(countEl.textContent).toContain(`${bandungCount} dari ${totalCafes} kafe`);
      expect(window.location.search).toContain('kota=Bandung');
    } finally {
      document.querySelector<HTMLElement>('.rs__bag[data-select-city="Jakarta"]')?.click();
      document.querySelector<HTMLButtonElement>('[data-catalog-reset]')?.click();
      window.history.replaceState(null, '', '/');
    }
  });

  it('activates active UFO city bag on Enter keydown', () => {
    const countEl = document.querySelector<HTMLElement>('[data-catalog-count]')!;
    const activeUfoBag = document.querySelector<HTMLElement>('.ufo__bag[data-slot="0"]')!;

    try {
      activeUfoBag.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      const jakartaCount = CAFES_DATA.filter((c) => c.city === 'Jakarta').length;
      expect(countEl.textContent).toContain(`${jakartaCount} dari ${CAFES_DATA.length} kafe`);
      expect(window.location.search).toContain('kota=Jakarta');
    } finally {
      document.querySelector<HTMLButtonElement>('[data-catalog-reset]')?.click();
      window.history.replaceState(null, '', '/');
    }
  });

  it('sorts catalog results, syncs URL query, and resets sort state', () => {
    const sortSelect = document.querySelector<HTMLSelectElement>('[data-catalog-sort]')!;
    const resetBtn = document.querySelector<HTMLButtonElement>('[data-catalog-reset]')!;
    const names = () =>
      Array.from(document.querySelectorAll<HTMLElement>('#direktori .cc__name')).map(
        (el) => el.textContent?.trim() ?? '',
      );

    try {
      sortSelect.value = 'name';
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
      const sortedNames = names();
      expect(sortedNames.length).toBe(CAFES_DATA.length);
      expect(sortedNames[0].localeCompare(sortedNames[1], 'id')).toBeLessThanOrEqual(0);
      expect(window.location.search).toContain('urut=name');
      expect(resetBtn.disabled).toBe(false);

      resetBtn.click();
      expect(sortSelect.value).toBe('default');
      expect(window.location.search).toBe('');
    } finally {
      resetBtn.click();
      window.history.replaceState(null, '', '/');
    }
  });

  it('shares a cafe via clipboard and shows toast for success and failure', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
    const shareBtn = document.querySelector<HTMLButtonElement>('#direktori [data-cafe-share]')!;
    const toast = document.querySelector<HTMLElement>('[data-toast]')!;

    try {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      shareBtn.click();
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(1);
        expect(toast.hidden).toBe(false);
        expect(toast.textContent).toContain('disalin');
      });

      writeText.mockRejectedValueOnce(new Error('denied'));
      shareBtn.click();
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(2);
        expect(toast.textContent).toContain('Gagal menyalin tautan');
      });
    } finally {
      toast.hidden = true;
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else delete (navigator as unknown as Record<string, unknown>).clipboard;
      if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
      else delete (navigator as unknown as Record<string, unknown>).share;
    }
  });

  it('enables bucketlist share when saved and copies numbered Indonesian list', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const shareBucketBtn = document.querySelector<HTMLButtonElement>('[data-bucket-share]')!;
    const saveBtn = document.querySelector<HTMLButtonElement>('#direktori [data-cafe-save]')!;
    const toast = document.querySelector<HTMLElement>('[data-toast]')!;

    expect(shareBucketBtn.disabled).toBe(true);

    try {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      saveBtn.click();
      expect(shareBucketBtn.disabled).toBe(false);

      shareBucketBtn.click();
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText.mock.calls[0][0]).toContain('Daftar Nongki');
        expect(writeText.mock.calls[0][0]).toContain('1. ');
        expect(toast.textContent).toContain('Daftar simpan disalin');
      });
    } finally {
      if (saveBtn.getAttribute('aria-pressed') === 'true') saveBtn.click();
      toast.hidden = true;
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else delete (navigator as unknown as Record<string, unknown>).clipboard;
    }
  });

  it('shows back-to-top button after scrolling and scrolls back up on click', () => {
    const backToTop = document.querySelector<HTMLButtonElement>('[data-back-to-top]')!;
    const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    expect(backToTop).not.toBeNull();
    expect(backToTop.hidden).toBe(true);

    try {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 480 });
      window.dispatchEvent(new Event('scroll'));
      expect(backToTop.hidden).toBe(false);

      backToTop.click();
      expect(scrollToSpy).toHaveBeenCalledTimes(1);

      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
      window.dispatchEvent(new Event('scroll'));
      expect(backToTop.hidden).toBe(true);
    } finally {
      scrollToSpy.mockRestore();
      if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
      else delete (window as unknown as Record<string, unknown>).scrollY;
      window.dispatchEvent(new Event('scroll'));
    }
  });

  it('omits the picker sound toggle button and still plays sound cues on spin', () => {
    const originalAudioContext = Object.getOwnPropertyDescriptor(window, 'AudioContext');
    const spinBtn = document.querySelector<HTMLButtonElement>('[data-picker-spin]')!;
    const startMock = vi.fn();

    expect(document.querySelector('[data-picker-sound]')).toBeNull();

    try {
      resetSoundStateForTest();
      const mockCtx = {
        currentTime: 0,
        state: 'running',
        destination: {},
        resume: vi.fn().mockResolvedValue(undefined),
        createOscillator: vi.fn(() => ({
          type: 'sine',
          frequency: { setValueAtTime: vi.fn() },
          start: startMock,
          stop: vi.fn(),
          connect: vi.fn(),
          disconnect: vi.fn(),
          onended: null,
        })),
        createGain: vi.fn(() => ({
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        })),
      };
      const AudioCtor = vi.fn(function mockAudio() {
        return mockCtx;
      });
      Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioCtor });

      spinBtn.click();
      expect(startMock).toHaveBeenCalledTimes(3);
    } finally {
      resetSoundStateForTest();
      if (originalAudioContext) {
        Object.defineProperty(window, 'AudioContext', originalAudioContext);
      } else {
        delete (window as unknown as Record<string, unknown>).AudioContext;
      }
    }
  });

  it('does not trap mouse wheel scrolling on the bean physics canvas', () => {
    expect(themeSource).toContain("mouse.element.removeEventListener('wheel', mouse.mousewheel)");
    expect(themeSource).not.toContain('initFvp(');
  });

  it('supports manual city and area filtering in the random picker', () => {
    vi.useFakeTimers();
    try {
      document.querySelector<HTMLButtonElement>('[data-picker-city="Semua Kota"]')?.click();
      const manualBtn = document.querySelector<HTMLButtonElement>('[data-picker-loc-mode="manual"]')!;
      const autoBtn = document.querySelector<HTMLButtonElement>('[data-picker-loc-mode="auto"]')!;
      const areaGroup = document.querySelector<HTMLElement>('[data-picker-area-group]')!;
      const pontianakBtn = document.querySelector<HTMLButtonElement>('[data-picker-city="Pontianak"]')!;
      const spinBtn = document.querySelector<HTMLButtonElement>('[data-picker-spin]')!;
      const out = document.querySelector<HTMLElement>('[data-picker-out]')!;

      expect(manualBtn.getAttribute('aria-pressed')).toBe('true');
      expect(autoBtn.getAttribute('aria-pressed')).toBe('false');
      expect(areaGroup.hidden).toBe(true);

      pontianakBtn.click();
      expect(areaGroup.hidden).toBe(false);

      const gajahMadaBtn = document.querySelector<HTMLButtonElement>('[data-picker-area="Gajah Mada"]')!;
      expect(gajahMadaBtn).not.toBeNull();
      gajahMadaBtn.click();
      expect(
        document.querySelector<HTMLButtonElement>('[data-picker-area="Gajah Mada"]')?.getAttribute('aria-pressed'),
      ).toBe('true');

      spinBtn.click();
      vi.advanceTimersByTime(5000);
      expect(out.textContent).toContain('Pontianak · Gajah Mada');
    } finally {
      document.querySelector<HTMLButtonElement>('[data-picker-city="Semua Kota"]')?.click();
      vi.useRealTimers();
    }
  });

  it('supports device geolocation mode with radius selection, empty radius, and error recovery', () => {
    vi.useFakeTimers();
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

    try {
      const autoBtn = document.querySelector<HTMLButtonElement>('[data-picker-loc-mode="auto"]')!;
      const manualBtn = document.querySelector<HTMLButtonElement>('[data-picker-loc-mode="manual"]')!;
      const autoPanel = document.querySelector<HTMLElement>('[data-picker-auto-panel]')!;
      const locStatus = document.querySelector<HTMLElement>('[data-picker-loc-status]')!;
      const spinBtn = document.querySelector<HTMLButtonElement>('[data-picker-spin]')!;
      const out = document.querySelector<HTMLElement>('[data-picker-out]')!;

      // 1. Success near Pontianak
      const getCurrentPosition = vi.fn((success: PositionCallback) => {
        success({
          coords: { latitude: -0.032, longitude: 109.335 },
        } as GeolocationPosition);
      });
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition },
      });

      autoBtn.click();
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      expect(autoBtn.getAttribute('aria-pressed')).toBe('true');
      expect(autoPanel.hidden).toBe(false);
      expect(locStatus.textContent).toContain('Lokasi aktif');
      expect(locStatus.textContent).toContain('Pontianak');
      expect(
        document.querySelector<HTMLButtonElement>('[data-picker-radius="5"]')?.getAttribute('aria-pressed'),
      ).toBe('true');

      document.querySelector<HTMLButtonElement>('[data-picker-radius="10"]')!.click();
      expect(locStatus.textContent).toContain('maks. 10 km');

      spinBtn.click();
      vi.advanceTimersByTime(5000);
      expect(out.querySelector('.rcard')).not.toBeNull();
      expect(out.textContent).toContain('dari lokasimu');

      // 2. Empty radius when location is far from all cafes
      const farGeo = vi.fn((success: PositionCallback) => {
        success({
          coords: { latitude: -6.9, longitude: 112.0 },
        } as GeolocationPosition);
      });
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: farGeo },
      });
      document.querySelector<HTMLButtonElement>('[data-picker-loc-retry]')!.click();
      expect(spinBtn.disabled).toBe(true);
      expect(out.querySelector('[data-picker-switch-manual]')).not.toBeNull();

      // 3. Error (PERMISSION_DENIED) + fallback to manual
      const deniedGeo = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, message: 'denied' } as GeolocationPositionError);
      });
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: deniedGeo },
      });
      document.querySelector<HTMLButtonElement>('[data-picker-loc-retry]')!.click();
      expect(locStatus.getAttribute('role')).toBe('alert');
      expect(locStatus.textContent).toContain('Izin lokasi ditolak');
      expect(locStatus.querySelector('[data-picker-loc-retry]')).not.toBeNull();

      manualBtn.click();
      expect(manualBtn.getAttribute('aria-pressed')).toBe('true');
      expect(autoPanel.hidden).toBe(true);
    } finally {
      document.querySelector<HTMLButtonElement>('[data-picker-loc-mode="manual"]')?.click();
      document.querySelector<HTMLButtonElement>('[data-picker-city="Semua Kota"]')?.click();
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', originalGeolocation);
      } else {
        delete (navigator as unknown as Record<string, unknown>).geolocation;
      }
      vi.useRealTimers();
    }
  });
  it('syncs directory live stats, quick-nav links, corridor sub-filters, search clear, and COD detail jump', () => {
    const quickLinks = document.querySelectorAll('.site-nav__quick .site-nav__qlink');
    expect(quickLinks.length).toBeGreaterThanOrEqual(4);

    const totalStat = document.querySelector<HTMLElement>('#direktori [data-stat-total]');
    const ptkStat = document.querySelector<HTMLElement>('[data-stat-ptk]');
    expect(totalStat?.textContent?.trim()).toBe(String(CAFES_DATA.length));
    expect(ptkStat?.textContent?.trim()).toBe(
      String(CAFES_DATA.filter((c) => c.city === 'Pontianak').length),
    );

    const corridorGroup = document.querySelector<HTMLElement>('[data-catalog-corridor-group]')!;
    const resetBtn = document.querySelector<HTMLButtonElement>('[data-catalog-reset]')!;
    const searchInput = document.querySelector<HTMLInputElement>('[data-catalog-search]')!;
    const clearBtn = document.querySelector<HTMLButtonElement>('[data-catalog-clear]')!;

    try {
      expect(corridorGroup.hidden).toBe(true);
      expect(clearBtn.hidden).toBe(true);

      const cityButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-filter-city] button'),
      );
      const pontianakBtn = cityButtons.find((btn) => btn.textContent?.trim().startsWith('Pontianak'))!;
      pontianakBtn.click();
      expect(corridorGroup.hidden).toBe(false);

      const gajahMadaChip = document.querySelector<HTMLButtonElement>(
        '[data-catalog-corridors] [data-filter-value="Gajah Mada"]',
      )!;
      expect(gajahMadaChip).not.toBeNull();
      gajahMadaChip.click();
      expect(gajahMadaChip.getAttribute('aria-pressed')).toBe('true');

      const expectedGm = CAFES_DATA.filter(
        (c) => c.city === 'Pontianak' && c.area === 'Gajah Mada',
      ).length;
      expect(document.querySelectorAll('#direktori .cc')).toHaveLength(expectedGm);

      // Inspect button on Cafe of the Day jumps to that cafe and auto-expands dossier
      const inspectBtn = document.querySelector<HTMLButtonElement>(
        '[data-cafe-of-day="desktop"] [data-cod-inspect]',
      )!;
      expect(inspectBtn).not.toBeNull();
      inspectBtn.click();
      expect(clearBtn.hidden).toBe(false);
      expect(document.querySelectorAll('#direktori .cc')).toHaveLength(1);
      expect(document.querySelector('#direktori .cc__more')?.hasAttribute('open')).toBe(true);

      // Clear search button restores city list and hides itself
      clearBtn.click();
      expect(searchInput.value).toBe('');
      expect(clearBtn.hidden).toBe(true);

      // Slash shortcut focuses search input
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
      expect(document.activeElement).toBe(searchInput);
    } finally {
      resetBtn.click();
      window.history.replaceState(null, '', '/');
    }
  });

  it('supports menu Escape close, 2-step bucket reset, presets, pagination, and #tentang section', () => {
    const resetBtn = document.querySelector<HTMLButtonElement>('[data-catalog-reset]')!;

    try {
      // Shared #tentang section and hidden distilled roaster tail sections
      const tentang = document.querySelector<HTMLElement>('#tentang');
      expect(tentang).not.toBeNull();
      expect(tentang?.hidden).toBe(false);
      expect(
        document.querySelector('#shopify-section-template--20401917558953__pillars')?.hasAttribute('hidden'),
      ).toBe(true);

      // Menu opens and closes via Escape with aria-hidden sync
      const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-toggle]')!;
      const menuWrap = document.querySelector<HTMLElement>('.underlay-nav__menu')!;
      expect(menuWrap.getAttribute('aria-hidden')).toBe('true');
      menuBtn.click();
      expect(document.body.dataset.menuStatus).toBe('open');
      expect(menuWrap.getAttribute('aria-hidden')).toBe('false');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.body.dataset.menuStatus).toBe('closed');
      expect(menuWrap.getAttribute('aria-hidden')).toBe('true');

      // Initial pagination caps visible cards at 12 and reveals all via button
      const visibleBefore = Array.from(document.querySelectorAll<HTMLElement>('#direktori .cc')).filter(
        (card) => !card.hidden,
      );
      expect(visibleBefore.length).toBe(12);
      const moreBtn = document.querySelector<HTMLButtonElement>('[data-catalog-more]')!;
      expect(moreBtn.parentElement?.hidden).toBe(false);
      moreBtn.click();
      const visibleAfter = Array.from(document.querySelectorAll<HTMLElement>('#direktori .cc')).filter(
        (card) => !card.hidden,
      );
      expect(visibleAfter.length).toBe(CAFES_DATA.length);

      // Quick preset + active removable chip + Data contoh badge on non-Pontianak cards
      const hematPreset = document.querySelector<HTMLButtonElement>('[data-catalog-preset="hemat"]')!;
      hematPreset.click();
      expect(hematPreset.getAttribute('aria-pressed')).toBe('true');
      const activeBar = document.querySelector<HTMLElement>('[data-catalog-active]')!;
      expect(activeBar.hidden).toBe(false);
      const priceClearChip = activeBar.querySelector<HTMLButtonElement>('[data-clear-chip="price"]')!;
      expect(priceClearChip).not.toBeNull();
      priceClearChip.click();
      expect(hematPreset.getAttribute('aria-pressed')).toBe('false');

      const jakartaCard = Array.from(document.querySelectorAll<HTMLElement>('#direktori .cc')).find((card) =>
        card.textContent?.includes('Jakarta'),
      );
      expect(jakartaCard?.textContent).toContain('Data contoh');

      // Bucketlist: save item, switch tab via ArrowRight, and require 2 clicks to reset
      const firstSave = document.querySelector<HTMLButtonElement>('#direktori [data-cafe-save]')!;
      firstSave.click();
      document.querySelector<HTMLButtonElement>('[data-bucket-toggle]')!.click();

      const wishlistTab = document.querySelector<HTMLButtonElement>('[data-bucket-tab="wishlist"]')!;
      wishlistTab.focus();
      wishlistTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(document.querySelector('[data-bucket-tab="visited"]')?.getAttribute('aria-selected')).toBe(
        'true',
      );

      const bucketReset = document.querySelector<HTMLButtonElement>('[data-bucket-reset]')!;
      expect(bucketReset.disabled).toBe(false);
      bucketReset.click();
      expect(bucketReset.dataset.confirm).toBe('1');
      expect(bucketReset.textContent).toBe('Yakin kosongkan?');
      expect(document.querySelector('[data-bucket-count]')?.textContent?.trim()).toBe('1');

      bucketReset.click();
      expect(document.querySelector('[data-bucket-count]')?.textContent?.trim()).toBe('0');
      expect(document.querySelector('[data-toast]')?.textContent).toContain('Daftar simpan dikosongkan.');

      document.querySelector<HTMLElement>('[data-bucket-close]')!.click();
    } finally {
      resetBtn.click();
      window.history.replaceState(null, '', '/');
    }
  });
});

