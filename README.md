<div align="center">

<img src="./docs/nongki-banner.png" alt="Nongki Banner" width="100%">

# Nongki

**An Indonesia cafe & warkop directory. Vite + TypeScript, ad-free, no account required.**

**Nongki** helps remote workers, students, and coffee lovers decide where to hang out across
**Pontianak, Jakarta, Yogyakarta, Bandung, Bogor, and Surabaya** — with live open status, vibe and
facility filters, a geolocation random picker, and a local saved list built right into your browser.

*Status: in development — 222 places across 6 cities collected via the built-in scraper pipeline.*

</div>

---

## Features

<table>
<tr>
<td width="50%" valign="top">

**Directory & Filtering**

- 222 cafes, coffee shops, and warkops across 6 cities
- Filter by city, street corridor, vibe, facilities, price tier, and open now
- Sort by recommendation, open status, rating, lowest price, or name (`A–Z`)
- Shareable filter state synced directly to URL query parameters
- Quick keyboard search with `/` and instant filter reset

</td>
<td width="50%" valign="top">

**Discovery & Random Picker**

- Daily curated *Kafe Pilihan Hari Ini* on both desktop and mobile views
- Random picker (*Pilih Acak*) with Web Audio sound cues
- Device location mode with selectable search radius (`2–20 km`)
- Manual fallback by city, area, vibe, and open-now status
- Expandable cafe dossier cards with map links and highlights

</td>
</tr>
<tr>
<td valign="top">

**Save, Suggest & Share**

- Local bucketlist (*Daftar Simpan*) split into *Mau ke sini* and *Sudah ke sini*
- One-click share text formatted cleanly for group chats
- Built-in *Usulkan Kafe* tab so visitors can suggest missing spots directly
- Formatted email pre-fill to `support@nongki.me` plus local suggestion history

</td>
<td valign="top">

**Clean & Private**

- Zero ads, zero tracking, zero sign-up walls
- No backend or SSR — saved lists and preferences stay on your device
- Smooth desktop scrolling via Lenis and interactive bean physics via Matter.js
- Responsive layouts tailored separately for mobile and desktop viewports

</td>
</tr>
</table>

---

## Running Locally

Requires **Node.js 18+**.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Additional scripts:

```bash
npm run test      # run Vitest unit and jsdom integration suites
npm run build     # type-check with tsc -b and build dist/ via Vite
npm run preview   # preview the production build locally
```

---

## Repository Layout

```text
docs/             README visual assets
public/assets/    city landmark cards, icons, physics beans, and textures
src/
  data/           cafe schema, 6-city metadata, and scraped dataset
  lib/            filtering, sorting, URL sync, bucketlist, suggestions, and Web Audio cues
  runtime/        directory, random picker, bucketlist drawer, and suggestion tab runtime
  styles/         base, catalog UI, mobile hero, and font stylesheets
  vendor/         interactive carousel, manifesto reveal, and physics islands
tools/scraper/    Playwright Google Maps scraper, normalizer, and Cafe[] exporter
index.html        main single-page markup
```

---

## Cafe Data & Scraper Pipeline

Entries in `src/data/cafes.ts` are collected from Google Maps using the scripts in
[`tools/scraper/`](./tools/scraper/README.md) (`scrape-places.mjs` -> `normalize-city.mjs` ->
`export-cafes.mjs`). Opening hours, price ranges, and facilities may change over time.

Contact & suggestions: [`support@nongki.me`](mailto:support@nongki.me)

---

## License

Released under the [MIT License](LICENSE).
