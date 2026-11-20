import { beforeAll, describe, expect, it, vi } from 'vitest';
import rawHtml from '../index.html?raw';
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

    const countEl = document.querySelector<HTMLElement>('[data-catalog-count]');
    expect(countEl?.textContent).toContain('8 dari 22 kafe');

    const resetBtn = document.querySelector<HTMLButtonElement>('[data-catalog-reset]');
    expect(resetBtn?.disabled).toBe(false);
    resetBtn!.click();
    expect(countEl?.textContent).toContain('22 dari 22 kafe');
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

  it('keeps legacy commerce copy and data-filter-area out of index.html', () => {
    for (const forbidden of [
      'data-filter-area',
      'Third-party certified beans',
      'Kebijakan Pengembalian',
      'Kebijakan Pengiriman',
      'Family-Owned',
      'Atur Kadensi',
      'App Store',
      'Google Play',
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

      sideBag.click();
      expect(countEl.textContent).toContain('22 dari 22 kafe');
      expect(susanLink.dataset.selectCity).toBe('Bandung');

      susanLink.click();
      expect(countEl.textContent).toContain('2 dari 22 kafe');
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
      expect(countEl.textContent).toContain('2 dari 22 kafe');
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
      expect(sortedNames.length).toBe(22);
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

  it('does not trap mouse wheel scrolling on the bean physics canvas', () => {
    expect(themeSource).toContain("mouse.element.removeEventListener('wheel', mouse.mousewheel)");
    expect(themeSource).not.toContain('initFvp(');
  });
});
