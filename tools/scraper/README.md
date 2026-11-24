# Nongki Cafe Scraper Pipeline

Offline data-collection pipeline for gathering and normalizing Indonesian cafe listings into the `Cafe` schema used by `src/data/cafes.ts`.

Generated binaries, raw dumps, browser profiles, and local output files are ignored by `.gitignore` (`tools/scraper/bin/`, `tools/scraper/output/`, `tools/scraper/node_modules/`, `tools/scraper/chrome-profile/`).

## Pipeline Stages

### Stage 1: Raw Google Maps Collection
Install Playwright once inside `tools/scraper/` (`npm install`), then collect raw place records using `tools/scraper/queries-pontianak.txt`:
```bash
node tools/scraper/scrape-places.mjs --per-query 4 --max-places 36
```
Output: `tools/scraper/output/pontianak-raw.json` (JSONL). Stops immediately if Google Maps presents a CAPTCHA/verification challenge.

Optional pilot check on `tools/scraper/output/pilot-raw.json`:
```bash
node tools/scraper/inspect-pilot.mjs
```

### Stage 1b: Normalize & Deduplicate
Deduplicates by `cid`/`place_id`/`link`, filters out permanently closed places and entries outside the target area, and sorts by review count:
```bash
node tools/scraper/normalize-pontianak.mjs
```
Outputs:
- `tools/scraper/output/pontianak-cafes.json`
- `tools/scraper/output/pontianak-stats.json`

Optional review-photo candidate extraction:
```bash
node tools/scraper/collect-review-candidates.mjs
```

### Stage 2: Menu Photos & Panel Price Scraping (optional)
Install Playwright dependency once inside `tools/scraper/`:
```bash
cd tools/scraper && npm install
```
Sign in once to avoid Google Maps Limited View:
```bash
node tools/scraper/scrape-menus.mjs --login
```
Run menu scraping (resumable via existing `cid` in output JSONL):
```bash
node tools/scraper/scrape-menus.mjs --limit 25 --download
```
Output: `tools/scraper/output/pontianak-menus.jsonl`

### Stage 3: Vision Menu Price Extraction (optional)
Requires `GEMINI_API_KEY`:
```powershell
$env:GEMINI_API_KEY = "<ISI_KUNCI_GEMINI>"
node tools/scraper/extract-menu-prices.mjs --limit 25
```
Output: `tools/scraper/output/pontianak-menu-prices.jsonl`

### Stage 4: Export to Nongki `Cafe[]` Schema
Converts `pontianak-cafes.json` (plus optional Stage 2/3 outputs when present) into validated `Cafe[]` entries matching `src/data/cafes.ts`:
```bash
node tools/scraper/export-cafes.mjs --min-reviews 20 --limit 40
```
Optional flags:
- `--input <path>`: custom normalized JSON path
- `--output <path>`: output JSON path (default `tools/scraper/output/pontianak-cafes-ready.json`)
- `--ts-output <path>`: write a TypeScript module exporting `SCRAPED_CAFES`
- `--city <City>`: city name from `CITIES` (default `Pontianak`)
- `--min-reviews <n>`: minimum review count filter (default `10`)
- `--limit <n>`: cap exported entries
- `--include-images`: keep validated `https://` thumbnail URLs in `Cafe.image`

## Verification After Importing into `src/data/cafes.ts`

Before committing any curated dataset into `src/data/cafes.ts`, verify schema integrity, coordinates, and build:
```bash
npm run test
npm run build
```
