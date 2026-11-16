# AGENTS.md — Nongki

Guidance for AI agents working in this repository.

## What this is

Nongki is an Indonesia-wide web directory and recommendation platform for cafes and coffee shops (`kafe`, `kedai kopi`, `warkop`). Niche: help users pick where to hang out, work, or grab coffee, anywhere in Indonesia.

**Not** a coffee e-commerce site, and not Pontianak-only anymore. The user-facing UI copy is **Indonesian only**. Code identifiers, comments, README, and commit messages are English.

Note: `package.json` `description` still says "Pontianak" — stale. Trust this file and the README (Indonesia-wide), not that string.

## Tech stack

- Vite 6 + TypeScript 5, jsdom + Vitest 3 for tests
- Plain HTML (`index.html`, ~295 KB / ~1500 lines — read sections on demand, don't dump it whole)
- Plain CSS (`src/styles/base.css`, `cafe-ui.css`, `home-m.css`, `fonts.css`)
- JS islands in `src/vendor/theme.js` and `src/vendor/home-m.js` (initXxx functions, no framework)
- [Lenis](https://lenis.darkroom.engineering/) for smooth scrolling (initialized in `initSmoothScroll()` — no feature flag; simply runs on desktop pointers)
- [Matter.js](https://brm.io/matter-js/) for bean-falling animation
- No Shopify, no backend, no SSR. State (bucketlist) lives in `localStorage`.
- No lint, format, or CI config. `npm run build` (`tsc -b && vite build`) is the only typecheck gate; `npm run test` is the only test gate.

## Commands

```bash
npm install
npm run dev      # dev server (usually http://localhost:5173)
npm run test     # vitest run — all tests must pass before committing
npm run build    # tsc -b && vite build -> dist/
npm run preview  # preview the production build
```

```bash
npx vitest run src/lib/cafes.test.ts   # single test file
npx vitest run -t "<name>"             # single test by name
```

## Repository layout

```text
index.html                 # main markup (page is one huge file — edit in chunks)
public/assets/             # icons, SVG tiles, images (LFS for png/webp/otf)
src/data/cafes.ts          # seed cafe data (DUMMY — see below) + city metadata
src/lib/cafes.ts           # filtering, timezone-aware open/closed, helpers
src/runtime/cafe-ui.ts     # catalog/picker/bucketlist/cafe-of-the-day UI runtime
src/runtime/bootstrapGlobals.ts  # sets window.Lenis, window.Matter
src/vendor/theme.js        # interactive "islands", loaded after cafe-ui.ts
src/vendor/home-m.js       # mobile hero + mobile story sections
src/styles/                  # see above
src/main.ts, src/test/setup.ts
```

## Hard rules

1. **UI copy must stay Indonesian.** Do not mix English into user-facing text. Established terms: `Pilih Acak` (random picker), `Kafe Pilihan Hari Ini` (cafe of the day), `Daftar Simpan` (bucketlist), `Ramah Kerja` (work-friendly), `Estetik` (aesthetic), `Ramah Hewan` (pet-friendly), `Buka Malam` (late-night), `Kawasan`/`Kota` (city).
2. **Do not reintroduce Shopify concepts** (cart, checkout, `/products/`, `/collections/`, `data-cart-*`, `window.AC`, `shopify:section:load`). They were removed on purpose; `main.test.ts` asserts some of this stays gone.
3. **Cafe data is dummy.** `src/data/cafes.ts` contains fictional names/links/hours for development and demos. Never present it as verified, never use real business names, never claim "Terbaik di Indonesia" as fact. Replacing it with curated data is an open task, intentionally deferred.
4. **Keep the `shopify-section-template--…__*` IDs in `index.html`.** `src/main.test.ts` asserts they exist. They're just stable section IDs now; don't "clean them up".
5. **Legacy sections hidden on phone are intentional, not bugs.** `cafe-ui.css` ("Fase 1") hides `.hs.apart`, `.hs.story`, `.revs`, `.locs`, `.rev2`, `.save`, `.more` under `max-width: 767px`. The mobile page uses the `home_mobile` section instead; desktop shows everything.
6. **Windows + Git:** `git status` may warn about LF→CRLF. Use LF line endings; don't fight the warnings. Commit messages in **English**, scoped (`fix:`, `feat:`, `refactor:`).
7. **Accessibility basics are required** (labels, roles, keyboard paths) — see `index.html` for patterns.
8. **Don't "1:1 restore" the original theme** (`apocalypsecoffee.com`). Nongki intentionally diverges: Indonesian copy, Indonesia-wide scope, no cart, no APOC branding.
9. **Don't claim the data is final or the product is launched.** README says in-development.

## Current state (as of last push)

- Lenis smooth scroll works; `data-lenis-prevent` on drawers opts out.
- Cart/account/checkout/buying flow fully removed.
- Seed data: 22 fictional cafes across 8 cities (Jakarta, Bandung, Yogyakarta, Surabaya, Medan, Makassar, Denpasar, Pontianak — Pontianak has 8, the rest 2 each), including WIB/WITA timezone handling.
- Unreferenced Apocalypse Coffee product images (`public/assets/acr-product_img-*.png`) still sit in `public/assets/` and are copied into `dist/` by Vite. Nothing references them; they are leftovers, not assets in use.
- Known rough edges (accepted, not bugs): very long mobile catalog list; seed data is unverified; legacy sections still hidden on mobile.

## Testing & verification

- `npm run test` must pass before every commit.
- `npm run build` must succeed (it also type-checks with `tsc -b`).
- `src/main.test.ts` mounts the raw `index.html` in jsdom — markup you add is executed in tests. `src/lib/cafes.test.ts` and `src/lib/bucketlist.test.ts` cover helpers.
- Do not weaken or delete test assertions to make them pass.

## Workflow notes

- `index.html` is edited in targeted chunks (regex/string edits); line numbers shift constantly, so locate by content, not line number.
- Prefer editing what exists over adding files; the page is one file by design.
- Keep asset filenames English, lowercase, kebab-case.
- `.gitattributes` marks `*.png`, `*.webp`, `*.otf` as Git LFS.
