# Nongki

A web app for finding a cafe in Indonesia. Pick a city, filter by what you actually need (open now, seats, wi-fi), save a few to visit, or hit the random-pick button when you can't decide.

Status: early. The cafe data is placeholder, not real.

## What it does

- Lists cafes across eight Indonesian cities (Jakarta, Bandung, Yogyakarta, Surabaya, Medan, Makassar, Denpasar, Pontianak) with area, hours, price range, facilities, and a Maps link.
- Search, filters, and sorting: filter by city, vibe, facilities (Wi-Fi, outlets, smoking area, musala), price level, and open now, or sort by open status, rating, price, or name with URL query sync.
- Cafe of the day on both mobile and desktop views.
- Random picker with city, vibe, and open-now filters plus Web Audio API sound effects.
- Save cafes to a local bucketlist stored in your browser (with copy-to-clipboard sharing and a back-to-top button). No account required.

## Stack

Vite, TypeScript, plain CSS, Lenis (smooth scrolling), Matter.js (physics animation), Vitest. No backend; the saved list lives in `localStorage`.

## Run it

Node 18+.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Also `npm run test`, `npm run build`, `npm run preview`.

## Layout

```text
public/            static assets
src/
  data/            cafe data model and seed entries
  lib/             filtering, sorting, URL query helpers, bucketlist storage, Web Audio sound
  runtime/         UI behavior (catalog, picker, bucketlist, sharing, back-to-top)
  styles/          CSS
  vendor/          third-party scripts
index.html         the page
vite.config.ts     build config
```

## Data

Every cafe in the repo is made up. Names, addresses, hours and links are invented so the UI has something to show. Real, verified listings have not been added yet. Do not present this as a working directory.

## License

[MIT](LICENSE)
