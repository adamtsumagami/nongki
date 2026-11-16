import { beforeAll, describe, expect, it } from 'vitest';
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

  it('does not trap mouse wheel scrolling on the bean physics canvas', () => {
    expect(themeSource).toContain("mouse.element.removeEventListener('wheel', mouse.mousewheel)");
    expect(themeSource).not.toContain('initFvp(');
  });
});
