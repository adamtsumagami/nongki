# Nongki

A web app for finding a cafe in Indonesia. Pick a city, filter by what you actually need (open now, seats, wi-fi), save a few to visit, or hit the random-pick button when you can't decide.

Status: early. The cafe data is placeholder, not real.

## What it does

- Lists cafes in eight cities (Jakarta, Bandung, Yogyakarta, Surabaya, Medan, Makassar, Denpasar, Pontianak) with area, hours, price range and a Maps link.
- Search and filters: city, open now, facilities (wi-fi, outlets, smoking area, musala).
- Cafe of the day on the homepage.
- Random pick button, with an "only the ones that are open" option.
- Save cafes to a list, stored in your browser. No account.

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
  data/            cafe data model
  lib/             filtering, hours, timezone-aware open/closed helpers
  runtime/         UI behavior (catalog, picker, bucketlist)
  styles/          CSS
  vendor/          third-party scripts
index.html         the page
vite.config.ts     build config
```

## Data

Every cafe in the repo is made up. Names, addresses, hours and links are invented so the UI has something to show. Real, verified listings have not been added yet. Do not present this as a working directory.

## License

[MIT](LICENSE)
