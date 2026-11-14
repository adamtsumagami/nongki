/* Local offline Shopify AJAX & navigation shim so 1:1 vendor/theme.js and vendor/home-m.js
   work interactively on localhost without hitting remote Shopify endpoints or 404 routes. */

interface RoastSeed {
  slug: string;
  productId: number;
  variantId: number;
  title: string;
  priceCents: number;
  image: string;
}

interface CartLine {
  key: string;
  id: number;
  variant_id: number;
  product_id: number;
  product_title: string;
  variant_title: string;
  title: string;
  url: string;
  image: string;
  quantity: number;
  price: number;
  original_price: number;
  final_price: number;
  original_line_price: number;
  final_line_price: number;
  properties: Record<string, string>;
  selling_plan_allocation: {
    selling_plan: { id: number; name: string };
  } | null;
}

const ROAST_SEEDS: RoastSeed[] = [
  {
    slug: 'the-antidote',
    productId: 1001,
    variantId: 100101,
    title: 'The Antidote',
    priceCents: 1200,
    image: '/assets/acr-product_img-6oz-antidote-trans.png#local',
  },
  {
    slug: 'anti-matter',
    productId: 1002,
    variantId: 100201,
    title: 'Anti-Matter',
    priceCents: 1200,
    image: '/assets/acr-product_img-6oz-anti_matter-trans.png#local',
  },
  {
    slug: 'armageddon',
    productId: 1003,
    variantId: 100301,
    title: 'Armageddon',
    priceCents: 1200,
    image: '/assets/acr-product_img-6oz-armageddon-trans.png#local',
  },
  {
    slug: 'the-uprising',
    productId: 1004,
    variantId: 100401,
    title: 'The Uprising',
    priceCents: 1200,
    image: '/assets/acr-product_img-6oz-the_uprising-trans.png#local',
  },
  {
    slug: 'the-bomb',
    productId: 1005,
    variantId: 100501,
    title: 'The Bomb',
    priceCents: 1200,
    image: '/assets/acr-product_img-6oz-the_bomb-trans.png#local',
  },
  {
    slug: 'the-awakening',
    productId: 1006,
    variantId: 100601,
    title: 'The Awakening',
    priceCents: 1200,
    image: '/assets/acr-product_img-6oz-awakening-trans.png#local',
  },
  {
    slug: 'the-wanderer',
    productId: 1007,
    variantId: 100701,
    title: 'The Wanderer',
    priceCents: 1200,
    image: '/assets/acr-product_img-6oz-the_wanderer-trans.png#local',
  },
  {
    slug: 'the-invasion',
    productId: 1008,
    variantId: 100801,
    title: 'The Invasion',
    priceCents: 1200,
    image: '/assets/acr-product_img-6oz-the_invasion-trans.png#local',
  },
];

const PLANS: Record<number, string> = {
  7001: 'Delivered Weekly (Save 10%)',
  7002: 'Delivered Bi-Weekly (Save 10%)',
  7003: 'Delivered Monthly (Save 10%)',
};

const STORAGE_KEY = 'ac_local_cart_v1';

interface RawLineInput {
  id: number | string;
  quantity: number;
  properties?: Record<string, string>;
  selling_plan?: number | string | null;
}

function findSeed(idOrSlug: number | string): RoastSeed {
  const str = String(idOrSlug).replace(/^\/products\//, '').split('?')[0];
  return (
    ROAST_SEEDS.find(
      (r) => String(r.variantId) === str || String(r.productId) === str || r.slug === str,
    ) ?? ROAST_SEEDS[0]
  );
}

function hydrateCartDataTag() {
  const el = document.querySelector('script[data-cart-data]');
  if (!el) return;
  const products: Record<string, unknown> = {};
  for (const r of ROAST_SEEDS) {
    products[String(r.productId)] = {
      id: r.productId,
      variants: [
        { id: r.variantId, title: '6 oz / Whole Bean', opts: ['6 oz', 'Whole Bean'], price: r.priceCents, available: true },
        { id: r.variantId + 1, title: '12 oz / Whole Bean', opts: ['12 oz', 'Whole Bean'], price: 1800, available: true },
        { id: r.variantId + 2, title: '5 lb / Whole Bean', opts: ['5 lb', 'Whole Bean'], price: 7200, available: true },
      ],
      selling_plans: Object.entries(PLANS).map(([id, name]) => ({
        id: Number(id),
        name,
      })),
    };
  }
  el.textContent = JSON.stringify({ products });
}

class LocalCartStore {
  private lines: CartLine[] = [];

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) this.lines = parsed as CartLine[];
      }
    } catch {
      this.lines = [];
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lines));
    } catch {
      // ignore storage quota errors
    }
  }

  private recomputeLine(line: CartLine) {
    const unit = line.original_price;
    const finalUnit = line.selling_plan_allocation ? Math.round(unit * 0.9) : unit;
    line.final_price = finalUnit;
    line.price = finalUnit;
    line.original_line_price = unit * line.quantity;
    line.final_line_price = finalUnit * line.quantity;
  }

  toJSON() {
    let originalTotal = 0;
    let finalTotal = 0;
    let itemCount = 0;
    for (const l of this.lines) {
      this.recomputeLine(l);
      originalTotal += l.original_line_price;
      finalTotal += l.final_line_price;
      itemCount += l.quantity;
    }
    return {
      items: this.lines,
      item_count: itemCount,
      original_total_price: originalTotal,
      total_price: finalTotal,
    };
  }

  add(items: RawLineInput[]) {
    for (const raw of items) {
      const seed = findSeed(raw.id);
      const qty = Math.max(1, Number(raw.quantity || 1));
      const planId = raw.selling_plan ? Number(raw.selling_plan) : null;
      const planName = planId ? (PLANS[planId] ?? 'Delivered Monthly (Save 10%)') : null;
      const variantOffset = Number(raw.id) - seed.variantId;
      const unitPrice = variantOffset === 1 ? 1800 : variantOffset === 2 ? 7200 : seed.priceCents;
      const sizeLabel = variantOffset === 1 ? '12 oz' : variantOffset === 2 ? '5 lb' : '6 oz';
      const props = raw.properties ?? {};
      const lineId = `${seed.variantId + Math.max(0, variantOffset)}:${planId ?? '0'}:${JSON.stringify(props)}`;
      const existing = this.lines.find((l) => l.key === lineId);
      if (existing) {
        existing.quantity += qty;
      } else {
        this.lines.push({
          key: lineId,
          id: seed.variantId + Math.max(0, variantOffset),
          variant_id: seed.variantId + Math.max(0, variantOffset),
          product_id: seed.productId,
          product_title: seed.title,
          variant_title: `${sizeLabel} / Whole Bean`,
          title: `${seed.title} — ${sizeLabel}`,
          url: `/products/${seed.slug}`,
          image: seed.image,
          quantity: qty,
          price: unitPrice,
          original_price: unitPrice,
          final_price: unitPrice,
          original_line_price: unitPrice * qty,
          final_line_price: unitPrice * qty,
          properties: props,
          selling_plan_allocation: planId && planName ? { selling_plan: { id: planId, name: planName } } : null,
        });
      }
    }
    this.persist();
    return this.toJSON();
  }

  change(payload: { id?: string; line?: number; quantity: number }) {
    const qty = Number(payload.quantity ?? 0);
    let idx = -1;
    if (payload.id) {
      idx = this.lines.findIndex((l) => l.key === payload.id);
    } else if (payload.line != null) {
      idx = Number(payload.line) - 1;
    }
    if (idx >= 0 && idx < this.lines.length) {
      if (qty <= 0) this.lines.splice(idx, 1);
      else this.lines[idx].quantity = qty;
    }
    this.persist();
    return this.toJSON();
  }

  update(updates: Record<string, number>) {
    for (const [lineId, qty] of Object.entries(updates)) {
      const idx = this.lines.findIndex((l) => l.key === lineId);
      if (idx >= 0) {
        if (qty <= 0) this.lines.splice(idx, 1);
        else this.lines[idx].quantity = qty;
      }
    }
    this.persist();
    return this.toJSON();
  }

  clear() {
    this.lines = [];
    this.persist();
    return this.toJSON();
  }
}

export function installLocalShopifyShim() {
  const win = window as unknown as { __acShimInstalled?: boolean; AC?: Record<string, (...a: unknown[]) => void> };
  if (win.__acShimInstalled) return;
  win.__acShimInstalled = true;

  hydrateCartDataTag();
  const store = new LocalCartStore();
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let pathname = '';
    let search = '';
    try {
      const parsed = new URL(urlStr, window.location.origin);
      if (parsed.origin !== window.location.origin) return nativeFetch(input, init);
      pathname = parsed.pathname;
      search = parsed.search;
    } catch {
      return nativeFetch(input, init);
    }

    const jsonRes = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

    const parseJsonBody = (): { ok: true; data: Record<string, unknown> } | { ok: false } => {
      if (!init?.body) return { ok: true, data: {} };
      try {
        const parsed: unknown = JSON.parse(String(init.body));
        return { ok: true, data: (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown> };
      } catch {
        return { ok: false };
      }
    };

    if (pathname === '/cart.js') {
      return jsonRes(store.toJSON());
    }
    if (pathname === '/cart/add.js') {
      const body = parseJsonBody();
      if (!body.ok) return jsonRes({ status: 400, description: 'Invalid JSON payload' }, 400);
      const raw = body.data;
      const items: RawLineInput[] = Array.isArray(raw.items) ? (raw.items as RawLineInput[]) : [raw as unknown as RawLineInput];
      const cart = store.add(items);
      return jsonRes({ items: cart.items });
    }
    if (pathname === '/cart/change.js') {
      const body = parseJsonBody();
      if (!body.ok) return jsonRes({ status: 400, description: 'Invalid JSON payload' }, 400);
      return jsonRes(store.change(body.data as { id?: string; line?: number; quantity: number }));
    }
    if (pathname === '/cart/update.js') {
      const body = parseJsonBody();
      if (!body.ok) return jsonRes({ status: 400, description: 'Invalid JSON payload' }, 400);
      return jsonRes(store.update((body.data.updates as Record<string, number>) || {}));
    }
    if (pathname === '/cart/clear.js') {
      return jsonRes(store.clear());
    }
    if (search.includes('sections=cart-data')) {
      return jsonRes({ 'cart-data': document.querySelector('#shopify-section-cart-data')?.innerHTML ?? '' });
    }
    if (pathname === '/account') {
      return new Response('<html><body><a href="/account/login">Login</a></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }
    if (pathname === '/contact') {
      return new Response('<html><body><p class="form-status">Subscribed</p></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }
    return nativeFetch(input, init);
  };

  // Keep internal storefront navigation on the local landing page without 404 reloads
  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname === '/') return;

      const p = url.pathname;
      if (p.startsWith('/products/')) {
        e.preventDefault();
        const seed = findSeed(p);
        store.add([{ id: seed.variantId, quantity: 1 }]);
        win.AC?.refreshCart?.();
        win.AC?.openCartDrawer?.();
        return;
      }

      const sectionMap: Array<[RegExp, string]> = [
        [/^\/collections/, '#shopify-section-template--20401917558953__carousel'],
        [/^\/pages\/subscribe/, '#shopify-section-template--20401917558953__subscribe'],
        [/^\/pages\/(about|our-story)/, '#shopify-section-template--20401917558953__timeline'],
        [/^\/pages\/(our-locations|contact|franchise)/, '#shopify-section-sections--20401917100201__footer'],
        [/^\/policies\//, '#shopify-section-sections--20401917100201__footer'],
      ];

      if (p === '/checkout') {
        e.preventDefault();
        const hint = document.querySelector('.cart-drawer__hint');
        if (hint) hint.textContent = 'Demo checkout ready — local preview only.';
        return;
      }

      for (const [re, sel] of sectionMap) {
        if (re.test(p)) {
          e.preventDefault();
          document.body.dataset.menuStatus = 'closed';
          document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      }
    });
  });
}

