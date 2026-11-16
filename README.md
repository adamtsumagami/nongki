# Nongki — Kafe Directory for Indonesia

Nongki is a web app for discovering cafes and coffee shops across Indonesia. It helps users pick a place to hang out, get work done, or grab coffee based on city, vibe, facilities, and opening status.

## Features

- **National cafe directory** — browse listings with area, vibe, facilities, price range, and maps link.
- **Search & filters** — filter by city, opening status, and needs (e.g. work-friendly spots).
- **Random pick** — get a random cafe recommendation, optionally limited to currently open places.
- **Cafe of the day** — a daily recommendation from the directory.
- **Bucket list** — save favorite cafes in the browser for later.

## Tech Stack

- [Vite](https://vitejs.dev/) — bundler and dev server
- [TypeScript](https://www.typescriptlang.org/) — language
- CSS — styling
- [Lenis](https://lenis.darkroom.engineering/) — smooth scrolling
- [Matter.js](https://brm.io/matter-js/) — 2D physics animation
- [Vitest](https://vitest.dev/) — testing

## Getting Started

Requires Node.js 18+ and npm.

```bash
npm install   # install dependencies
npm run dev   # dev server (usually http://localhost:5173)
npm run test  # run tests
npm run build # production build to dist/
npm run preview # preview production build
```

## Project Structure

```text
.
├── public/          # Static assets
├── src/
│   ├── data/        # Cafe data model
│   ├── lib/         # Filtering and helpers
│   ├── runtime/     # UI bootstrap and behavior
│   ├── styles/      # CSS
│   ├── vendor/      # Supporting scripts
│   └── test/        # Test setup
├── index.html       # Main HTML markup
└── vite.config.ts   # Vite config
```

## Data Note

The cafe listings are illustrative seed data covering Jakarta, Bandung, Yogyakarta, Surabaya, Medan, Makassar, Denpasar, and Pontianak. Verify before using as real-world info.

## License

[MIT](LICENSE)
