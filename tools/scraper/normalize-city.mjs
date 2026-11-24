import fs from 'node:fs';
import path from 'node:path';

/**
 * Generic Google Maps scraped JSONL normalizer for Indonesian cities.
 * Deduplicates entries, filters out closed or out-of-city places, and sorts by popularity.
 */
function parseArgs(argv) {
  const args = {
    input: '',
    output: '',
    city: '',
    match: '',
    stats: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--input') args.input = argv[++i] || '';
    else if (token === '--output') args.output = argv[++i] || '';
    else if (token === '--city') args.city = argv[++i] || '';
    else if (token === '--match') args.match = argv[++i] || '';
    else if (token === '--stats') args.stats = true;
  }
  return args;
}

const CITY_PATTERNS = {
  Pontianak: /pontianak|kubu\s*raya|sungai\s*raya|kalimantan\s*barat/i,
  Jakarta: /jakarta|dki\s*jakarta|kemang|senopati|menteng|tebet|kuningan|blok\s*m|pik|kelapa\s*gading/i,
  Yogyakarta: /yogyakarta|jogja|sleman|bantul|kotagede|malioboro|prawirotaman|seturan|palagan|gejayan/i,
  Bandung: /bandung|dago|braga|ciumbuleuit|lembang|buah\s*batu|pasir\s*kaliki|jawa\s*barat/i,
  Bogor: /bogor|sentul|pajajaran|surya\s*kencana|tanah\s*sareal|baranangsiang|taman\s*kencana|cibinong/i,
  Surabaya: /surabaya|gubeng|tunjungan|darmo|manyar|ketintang|citraland|jawa\s*timur/i,
};

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function dedupeKey(item) {
  return String(item.cid || item.place_id || item.link || item.title || '').trim();
}

function isCoffeePlace(item) {
  const hay = [item.title, item.category, ...(item.categories || [])].join(' ');
  // Exclude convenience store kiosks or non-cafe chains
  if (/\b(indomaret|alfamart|spbu|pertamina|point\s*coffee|point\s*cafe)\b/i.test(hay)) return false;
  return true;
}

function matchesCity(item, pattern) {
  const hay = [
    item.address,
    item.complete_address?.city,
    item.complete_address?.state,
    item.complete_address?.borough,
    item.title,
  ]
    .filter(Boolean)
    .join(' ');
  return pattern.test(hay);
}

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.output || !args.city) {
  console.error('Usage: node normalize-city.mjs --city <Name> --input <in.jsonl> --output <out.json> [--match <regex>] [--stats]');
  process.exit(1);
}

const pattern = args.match ? new RegExp(args.match, 'i') : CITY_PATTERNS[args.city] || new RegExp(args.city, 'i');
const items = readJsonl(path.resolve(args.input));

const seen = new Map();
let closedCount = 0;
let nonCityCount = 0;
let filteredOutCount = 0;

for (const item of items) {
  if (item.permanently_closed || item.temporarily_closed) {
    closedCount += 1;
    continue;
  }
  if (!matchesCity(item, pattern)) {
    nonCityCount += 1;
    continue;
  }
  if (!isCoffeePlace(item)) {
    filteredOutCount += 1;
    continue;
  }
  if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') {
    filteredOutCount += 1;
    continue;
  }
  const key = dedupeKey(item);
  if (!key) continue;
  const prev = seen.get(key);
  if (!prev || Number(item.review_count || 0) > Number(prev.review_count || 0)) {
    seen.set(key, item);
  }
}

const normalized = [...seen.values()].sort(
  (a, b) => Number(b.review_count || 0) - Number(a.review_count || 0) || String(a.title || '').localeCompare(String(b.title || '')),
);

fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');

if (args.stats) {
  console.log(
    JSON.stringify(
      {
        city: args.city,
        rawCount: items.length,
        closedCount,
        nonCityCount,
        filteredOutCount,
        normalizedCount: normalized.length,
        output: args.output,
      },
      null,
      2,
    ),
  );
}
