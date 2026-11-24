import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ALLOWED_CITIES = [
  'Pontianak',
  'Jakarta',
  'Yogyakarta',
  'Bandung',
  'Bogor',
  'Surabaya',
];

export const ALLOWED_VIBES = [
  'Ramah Kerja',
  'Nyaman',
  'Estetik',
  'Area Terbuka',
  'Buka Malam',
  'Legendaris',
  'Nongkrong Santai',
  'Ramah Hewan',
];

export const ALLOWED_FACILITIES = [
  'Wi-Fi',
  'Colokan',
  'AC',
  'Area Merokok',
  'Musala',
  'Parkir',
];

const ACCENT_PALETTE = [
  '#c9281e',
  '#3aaae0',
  '#e06d2d',
  '#3a7a4f',
  '#8b5a2b',
  '#5c4b8a',
  '#c48a1c',
  '#2d6a6a',
];

const PONTIANAK_CORRIDORS = [
  { pattern: /gajah\s*mada/i, label: 'Gajah Mada' },
  { pattern: /ahmad\s*yani|a\.\s*yani/i, label: 'Ahmad Yani' },
  { pattern: /purnama/i, label: 'Purnama' },
  { pattern: /podomoro|karya\s*baru/i, label: 'Podomoro' },
  { pattern: /hijas/i, label: 'Hijas' },
  { pattern: /reformasi|untan/i, label: 'Reformasi' },
  { pattern: /kota\s*baru/i, label: 'Kota Baru' },
  { pattern: /sungai\s*raya\s*dalam|serdam/i, label: 'Sungai Raya Dalam' },
  { pattern: /sungai\s*raya|kubu\s*raya/i, label: 'Sungai Raya' },
  { pattern: /siantan/i, label: 'Siantan' },
  { pattern: /tanjung\s*hulu/i, label: 'Tanjung Hulu' },
  { pattern: /tanjung\s*pura/i, label: 'Tanjungpura' },
  { pattern: /paris\s*2|parit\s*h\.?\s*husin/i, label: 'Paris 2' },
  { pattern: /sungai\s*jawi/i, label: 'Sungai Jawi' },
  { pattern: /benua\s*melayu/i, label: 'Benua Melayu' },
  { pattern: /danau\s*sentarum/i, label: 'Danau Sentarum' },
  { pattern: /veteran/i, label: 'Veteran' },
  { pattern: /akcaya/i, label: 'Akcaya' },
  { pattern: /sungai\s*bangkong/i, label: 'Sungai Bangkong' },
  { pattern: /pal\s*lima|pal\s*5/i, label: 'Pal Lima' },
];

export function parseArgs(argv) {
  const opts = {
    input: 'tools/scraper/output/pontianak-cafes.json',
    menus: 'tools/scraper/output/pontianak-menus.jsonl',
    prices: 'tools/scraper/output/pontianak-menu-prices.jsonl',
    output: 'tools/scraper/output/pontianak-cafes-ready.json',
    tsOutput: '',
    city: 'Pontianak',
    minReviews: 10,
    limit: null,
    includeImages: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) opts.input = argv[++i];
    else if (arg === '--menus' && argv[i + 1]) opts.menus = argv[++i];
    else if (arg === '--prices' && argv[i + 1]) opts.prices = argv[++i];
    else if (arg === '--output' && argv[i + 1]) opts.output = argv[++i];
    else if (arg === '--ts-output' && argv[i + 1]) opts.tsOutput = argv[++i];
    else if (arg === '--city' && argv[i + 1]) opts.city = argv[++i];
    else if (arg === '--min-reviews' && argv[i + 1]) opts.minReviews = Number(argv[++i]);
    else if (arg === '--limit' && argv[i + 1]) opts.limit = Number(argv[++i]);
    else if (arg === '--include-images') opts.includeImages = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node tools/scraper/export-cafes.mjs [options]
  --input <path>        Normalized cafes JSON from Stage 1b (default: tools/scraper/output/pontianak-cafes.json)
  --menus <path>        Optional Stage 2 menus JSONL (default: tools/scraper/output/pontianak-menus.jsonl)
  --prices <path>       Optional Stage 3 extracted menu prices JSONL (default: tools/scraper/output/pontianak-menu-prices.jsonl)
  --output <path>       Output Cafe[] JSON path (default: tools/scraper/output/pontianak-cafes-ready.json)
  --ts-output <path>    Optional TypeScript export file path
  --city <name>         Target city in CITIES allowlist (default: Pontianak)
  --min-reviews <n>     Minimum review_count to keep (default: 10)
  --limit <n>           Maximum number of exported cafes
  --include-images      Include validated https:// thumbnail URLs in Cafe.image`);
      process.exit(0);
    }
  }

  if (!ALLOWED_CITIES.includes(opts.city)) {
    throw new Error(`Invalid --city "${opts.city}". Allowed: ${ALLOWED_CITIES.join(', ')}`);
  }
  if (!Number.isFinite(opts.minReviews) || opts.minReviews < 0) {
    throw new Error('--min-reviews must be a non-negative number.');
  }
  if (opts.limit !== null && (!Number.isFinite(opts.limit) || opts.limit <= 0)) {
    throw new Error('--limit must be a positive number.');
  }

  return opts;
}

export function slugify(text) {
  const cleaned = String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'kafe';
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isIndonesiaCoord(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -11.5 &&
    lat <= 6.5 &&
    lng >= 94.5 &&
    lng <= 141.5
  );
}

const CITY_CORRIDORS = {
  Jakarta: [
    { pattern: /kemang/i, label: 'Kemang' },
    { pattern: /senopati|senayan/i, label: 'Senopati' },
    { pattern: /blok\s*m|melawai/i, label: 'Blok M' },
    { pattern: /menteng/i, label: 'Menteng' },
    { pattern: /kuningan|rasuna\s*said|setiabudi/i, label: 'Kuningan' },
    { pattern: /pantai\s*indah\s*kapuk|\bpik\b/i, label: 'PIK' },
    { pattern: /tebet/i, label: 'Tebet' },
    { pattern: /kebayoran|kby\./i, label: 'Kebayoran Baru' },
    { pattern: /mampang/i, label: 'Mampang Prapatan' },
  ],
  Yogyakarta: [
    { pattern: /malioboro|ps\.\s*kembang/i, label: 'Malioboro' },
    { pattern: /prawirotaman/i, label: 'Prawirotaman' },
    { pattern: /seturan/i, label: 'Seturan' },
    { pattern: /kotabaru/i, label: 'Kotabaru' },
    { pattern: /gejayan|affandi/i, label: 'Gejayan' },
    { pattern: /palagan|ngaglik/i, label: 'Palagan' },
    { pattern: /danurejan/i, label: 'Danurejan' },
    { pattern: /jetis/i, label: 'Jetis' },
    { pattern: /gondokusuman/i, label: 'Gondokusuman' },
    { pattern: /mergangsan/i, label: 'Mergangsan' },
    { pattern: /depok/i, label: 'Depok, Sleman' },
  ],
  Bandung: [
    { pattern: /braga/i, label: 'Braga' },
    { pattern: /dago|ir\.\s*h\.\s*juanda|lebak\s*siliwangi|lb\.\s*siliwangi/i, label: 'Dago' },
    { pattern: /riau|martadinata|citarum/i, label: 'Riau' },
    { pattern: /ciumbuleuit|kiputih|punclut/i, label: 'Ciumbuleuit' },
    { pattern: /lembang/i, label: 'Lembang' },
    { pattern: /buah\s*batu/i, label: 'Buah Batu' },
    { pattern: /bandung\s*wetan/i, label: 'Bandung Wetan' },
    { pattern: /cidadap/i, label: 'Cidadap' },
    { pattern: /lengkong/i, label: 'Lengkong' },
  ],
  Bogor: [
    { pattern: /surya\s*kencana|suryakencana/i, label: 'Surya Kencana' },
    { pattern: /pajajaran/i, label: 'Pajajaran' },
    { pattern: /sentul|babakan\s*madang/i, label: 'Sentul' },
    { pattern: /taman\s*kencana|sempur|bincarung/i, label: 'Taman Kencana' },
    { pattern: /baranangsiang|pakuan/i, label: 'Baranangsiang' },
    { pattern: /tanah\s*sareal/i, label: 'Tanah Sareal' },
    { pattern: /bogor\s*utara/i, label: 'Bogor Utara' },
    { pattern: /bogor\s*tengah|paledang|gudang/i, label: 'Bogor Tengah' },
    { pattern: /bogor\s*timur/i, label: 'Bogor Timur' },
  ],
  Surabaya: [
    { pattern: /tunjungan/i, label: 'Tunjungan' },
    { pattern: /gubeng/i, label: 'Gubeng' },
    { pattern: /darmo|wonokromo/i, label: 'Darmo' },
    { pattern: /pakuwon|citraland|lakarsantri|wiyung|surabaya\s*barat/i, label: 'Surabaya Barat' },
    { pattern: /manyar|merr/i, label: 'Manyar' },
    { pattern: /genteng/i, label: 'Genteng' },
    { pattern: /sukomanunggal/i, label: 'Sukomanunggal' },
  ],
};

function cleanAreaSegment(raw) {
  return String(raw || '')
    .replace(/^(kec\.|kecamatan|kel\.|kelurahan)\s+/i, '')
    .replace(/\bKby\.\s*/gi, 'Kebayoran ')
    .replace(/\bPrpt\.?/gi, 'Prapatan')
    .replace(/\bLb\.\s*/gi, 'Lebak ')
    .replace(/\bPs\.\s*/gi, 'Pasar ')
    .replace(/\bSel\.?$/i, 'Selatan')
    .replace(/\bBar\.?$/i, 'Barat')
    .replace(/\bTim\.?$/i, 'Timur')
    .replace(/\bUtr\.?$/i, 'Utara')
    .replace(/\bTgr\.?$/i, 'Tenggara')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveArea(item, city) {
  const combined = [item.title, item.street, item.borough, item.complete_address?.borough, item.address]
    .filter(Boolean)
    .join(' ');
  if (city === 'Pontianak') {
    for (const corridor of PONTIANAK_CORRIDORS) {
      if (corridor.pattern.test(combined)) return corridor.label;
    }
  }

  for (const corridor of CITY_CORRIDORS[city] || []) {
    if (corridor.pattern.test(combined)) return corridor.label;
  }

  const candidates = [
    item.borough,
    item.complete_address?.borough,
    ...String(item.address || '').split(','),
  ];

  for (const rawPart of candidates) {
    const cleaned = cleanAreaSegment(rawPart);
    if (
      cleaned &&
      !/^(RT\.|RW\.|Jl\.|Jalan|No\.|Lt\.|Blok|Block|Kav\.|Komp\.|Kawasan|Gedung|Kota|Kab\.|Kabupaten|DKI|DI\b|Daerah|Jawa|Kalimantan|\d)/i.test(
        cleaned,
      ) &&
      cleaned.length <= 36
    ) {
      return cleaned;
    }
  }

  return city;
}

function to24Hour(hourRaw, minuteRaw, meridiem) {
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw || '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null;

  const mer = (meridiem || '').toUpperCase();
  if (mer === 'AM') {
    if (hour === 12) hour = 0;
  } else if (mer === 'PM') {
    if (hour >= 1 && hour <= 11) hour += 12;
  }

  if (hour === 24 && minute === 0) hour = 0;
  if (hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseTimeRangeString(raw) {
  const text = String(raw || '').replace(/\u202f|\u00a0/g, ' ').trim();
  if (!text) return null;
  if (/24\s*(jam|hours)/i.test(text)) {
    return { opensAt: '00:00', closesAt: '23:59', open24: true };
  }
  if (/^(tutup|closed)$/i.test(text)) return null;

  const ampm = text.match(
    /(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)?\s*[–—-]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)/i,
  );
  if (ampm) {
    const closeMer = ampm[6];
    const openMer = ampm[3] || (Number(ampm[1]) <= Number(ampm[4]) ? closeMer : 'AM');
    const opensAt = to24Hour(ampm[1], ampm[2], openMer);
    const closesAt = to24Hour(ampm[4], ampm[5], closeMer);
    if (opensAt && closesAt) return { opensAt, closesAt, open24: false };
  }

  const h24 = text.match(/(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/);
  if (h24) {
    const opensAt = to24Hour(h24[1], h24[2], '');
    const closesAt = to24Hour(h24[3], h24[4], '');
    if (opensAt && closesAt) return { opensAt, closesAt, open24: false };
  }

  return null;
}

export function parseOpenHours(openHours) {
  const fallback = { opensAt: '08:00', closesAt: '22:00', open24: false, parsed: false };
  if (!openHours || typeof openHours !== 'object') return fallback;

  const counts = new Map();
  let open24Days = 0;

  for (const rawValue of Object.values(openHours)) {
    const entries = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const entry of entries) {
      const parsed = parseTimeRangeString(entry);
      if (!parsed) continue;
      if (parsed.open24) {
        open24Days += 1;
        continue;
      }
      const key = `${parsed.opensAt}|${parsed.closesAt}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  if (open24Days > 0 && open24Days >= counts.size) {
    return { opensAt: '00:00', closesAt: '23:59', open24: true, parsed: true };
  }
  if (counts.size === 0) return fallback;

  const [bestKey] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  const [opensAt, closesAt] = bestKey.split('|');
  return { opensAt, closesAt, open24: false, parsed: true };
}

function formatRupiah(amount) {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

function parsePriceNumber(raw, hasKUnit) {
  const cleaned = String(raw || '').replace(/\./g, '').replace(/,/g, '').trim();
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (hasKUnit || num < 1000) return num * 1000;
  return num;
}

export function parsePriceText(raw) {
  const text = String(raw || '').replace(/\u00a0/g, ' ').trim();
  if (!text) return null;

  const rangeMatch = text.match(
    /(?:Rp\s*)?(\d{1,3}(?:[.,]\d{3})*|\d{1,3})\s*(rb|ribu|k)?\s*[–—-]\s*(?:Rp\s*)?(\d{1,3}(?:[.,]\d{3})*|\d{1,3})\s*(rb|ribu|k)?/i,
  );
  if (rangeMatch) {
    const unit = Boolean(rangeMatch[2] || rangeMatch[4]);
    const min = parsePriceNumber(rangeMatch[1], unit);
    const max = parsePriceNumber(rangeMatch[3], unit);
    if (min && max && max >= min && min >= 2000 && max <= 250000) {
      return { min, max };
    }
  }

  const singleMatch = text.match(/Rp\s*(\d{1,3}(?:[.,]\d{3})*|\d{1,3})\s*(rb|ribu|k)?/i);
  if (singleMatch) {
    const val = parsePriceNumber(singleMatch[1], Boolean(singleMatch[2]));
    if (val && val >= 2000 && val <= 200000) {
      return { min: Math.max(5000, Math.round(val * 0.7)), max: Math.round(val * 1.3) };
    }
  }

  const dollarMatch = text.match(/^(\$+)$/);
  if (dollarMatch) {
    const tier = dollarMatch[1].length;
    if (tier === 1) return { min: 10000, max: 25000 };
    if (tier === 2) return { min: 25000, max: 45000 };
    return { min: 45000, max: 85000 };
  }

  return null;
}

export function classifyPriceLevel(minIdr, maxIdr) {
  const mid = (minIdr + maxIdr) / 2;
  if (mid <= 25000) return 1;
  if (mid <= 40000) return 2;
  return 3;
}

export function resolvePricing(item, menuRecord, priceRecord) {
  const extracted = priceRecord?.extracted;
  if (
    extracted?.is_menu_photo &&
    Number(extracted.price_min_idr) > 0 &&
    Number(extracted.price_max_idr) >= Number(extracted.price_min_idr)
  ) {
    const min = Number(extracted.price_min_idr);
    const max = Number(extracted.price_max_idr);
    return {
      priceRange: `${formatRupiah(min)} - ${formatRupiah(max)}`,
      priceLevel: classifyPriceLevel(min, max),
      source: 'vision',
    };
  }

  for (const candidate of [menuRecord?.price_range_panel, item.price_range]) {
    const parsed = parsePriceText(candidate);
    if (parsed) {
      return {
        priceRange: `${formatRupiah(parsed.min)} - ${formatRupiah(parsed.max)}`,
        priceLevel: classifyPriceLevel(parsed.min, parsed.max),
        source: 'panel',
      };
    }
  }

  const isWarkop = /warkop|warung\s*kopi/i.test(`${item.title || ''} ${item.category || ''}`);
  if (isWarkop) {
    return { priceRange: 'Rp 8.000 - Rp 25.000', priceLevel: 1, source: 'fallback' };
  }
  return { priceRange: 'Rp 20.000 - Rp 40.000', priceLevel: 2, source: 'fallback' };
}

function collectAboutLabels(about) {
  if (!Array.isArray(about)) return [];
  const enabled = [];
  for (const group of about) {
    const options = Array.isArray(group?.options) ? group.options : [];
    for (const opt of options) {
      if (opt && opt.enabled !== false && typeof opt.name === 'string') {
        enabled.push(opt.name.trim());
      }
    }
  }
  return enabled;
}

export function extractFacilities(about) {
  const text = collectAboutLabels(about).join(' | ');
  const found = [];

  if (/wi-?fi/i.test(text)) found.push('Wi-Fi');
  if (/stop\s*kontak|colokan|power\s*outlet|charging/i.test(text)) found.push('Colokan');
  if (/\bac\b|air\s*condition|ber-ac|ruang\s*sejuk/i.test(text)) found.push('AC');
  if (/merokok|smoking/i.test(text)) found.push('Area Merokok');
  if (/musala|mushola|musholla|prayer\s*room/i.test(text)) found.push('Musala');
  if (/parkir|parking/i.test(text)) found.push('Parkir');

  return found.filter((f) => ALLOWED_FACILITIES.includes(f));
}

function isLateNight(hours) {
  if (hours.open24) return true;
  const closeHour = Number(hours.closesAt.split(':')[0]);
  const openHour = Number(hours.opensAt.split(':')[0]);
  return closeHour >= 23 || (closeHour <= 4 && closeHour < openHour);
}

export function deriveVibes(item, facilities, hours) {
  const aboutText = collectAboutLabels(item.about).join(' | ');
  const titleCat = `${item.title || ''} ${item.category || ''}`;
  const vibes = new Set();

  if (
    /laptop|bekerja|work|cowork/i.test(aboutText) ||
    (facilities.includes('Wi-Fi') && facilities.includes('Colokan'))
  ) {
    vibes.add('Ramah Kerja');
  }
  if (/cozy|nyaman|santai|casual/i.test(aboutText)) vibes.add('Nyaman');
  if (/trendy|estetik|instagram|modern|specialty/i.test(`${aboutText} ${titleCat}`)) {
    vibes.add('Estetik');
  }
  if (/outdoor|tempat\s*duduk\s*di\s*luar|area\s*terbuka|terrace|garden/i.test(aboutText)) {
    vibes.add('Area Terbuka');
  }
  if (isLateNight(hours)) vibes.add('Buka Malam');
  if (/warkop|warung\s*kopi/i.test(titleCat) && Number(item.review_count || 0) >= 500) {
    vibes.add('Legendaris');
  }
  if (/anjing|hewan|pet[\s-]*friendly|dogs\s*allowed/i.test(aboutText)) {
    vibes.add('Ramah Hewan');
  }

  vibes.add('Nongkrong Santai');
  return Array.from(vibes)
    .filter((v) => ALLOWED_VIBES.includes(v))
    .slice(0, 4);
}

export function extractMenuHighlights(item, menuRecord, priceRecord) {
  const visionItems = Array.isArray(priceRecord?.extracted?.items)
    ? priceRecord.extracted.items
        .map((x) => String(x?.name || '').trim())
        .filter((name) => name.length >= 2 && name.length <= 48)
    : [];
  if (visionItems.length > 0) return [...new Set(visionItems)].slice(0, 4);

  const panelItems = Array.isArray(menuRecord?.menu_text_items)
    ? menuRecord.menu_text_items
        .map((x) => String(x?.name || '').trim())
        .filter((name) => name.length >= 2 && name.length <= 48)
    : [];
  if (panelItems.length > 0) return [...new Set(panelItems)].slice(0, 4);

  if (/warkop|warung\s*kopi/i.test(`${item.title || ''} ${item.category || ''}`)) {
    return ['Kopi hitam', 'Kopi susu', 'Roti bakar'];
  }
  return ['Kopi susu', 'Espresso', 'Non-kopi'];
}

export function sanitizeHttpsUrl(raw, fallback) {
  try {
    const parsed = new URL(String(raw || '').trim());
    if (parsed.protocol === 'https:') return parsed.toString();
  } catch {
    // Fall through to safe fallback.
  }
  return fallback;
}

function buildIndonesianCopy(name, area, city, vibes, facilities, category) {
  const isWarkop = /warkop|warung\s*kopi/i.test(`${name} ${category || ''}`);
  const placeType = isWarkop ? 'Warung kopi' : 'Kedai kopi';

  const tagline = `${placeType} di kawasan ${area}, ${city}`;

  const bestParts = [];
  if (vibes.includes('Ramah Kerja')) bestParts.push('kerja dengan laptop');
  if (vibes.includes('Buka Malam')) bestParts.push('nongkrong malam');
  if (vibes.includes('Area Terbuka')) bestParts.push('duduk di area terbuka');
  if (bestParts.length === 0) bestParts.push('nongkrong santai dan ngopi bareng');
  const bestFor = bestParts[0].charAt(0).toUpperCase() + bestParts.join(', ').slice(1);

  const facText =
    facilities.length > 0
      ? ` Dilengkapi fasilitas ${facilities.slice(0, 3).join(', ')}.`
      : '';
  const description = `${placeType} yang berlokasi di ${area}, ${city}.${facText}`.trim();

  return { tagline, bestFor, description };
}

export function cleanCafeTitle(rawTitle) {
  return String(rawTitle || '')
    .replace(/^[\uFE00-\uFE0F\u200B-\u200D\u2600-\u27BF\s]+/g, '')
    .replace(/\s*\|\s*The Best.*$/i, '')
    .replace(/\s*-\s*Cafe\s*&\s*Coffee Shop\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function convertScrapedCafe(item, context) {
  const { city, menuByCid, priceByCid, usedIds, includeImages } = context;
  const title = cleanCafeTitle(item?.title);
  if (!title) return { cafe: null, reason: 'missing_title' };
  if (item.permanently_closed) return { cafe: null, reason: 'permanently_closed' };

  const lat = Number(item.latitude);
  const lng = Number(item.longitude);
  if (!isIndonesiaCoord(lat, lng)) return { cafe: null, reason: 'invalid_coordinates' };

  const cid = String(item.cid || '');
  const menuRecord = cid ? menuByCid.get(cid) : undefined;
  const priceRecord = cid ? priceByCid.get(cid) : undefined;

  let id = slugify(title);
  if (usedIds.has(id)) {
    let suffix = 2;
    while (usedIds.has(`${id}-${suffix}`)) suffix += 1;
    id = `${id}-${suffix}`;
  }
  usedIds.add(id);

  const area = resolveArea(item, city);
  const address = String(item.address || '').trim() || `${area}, ${city}`;
  const hours = parseOpenHours(item.open_hours);
  const pricing = resolvePricing(item, menuRecord, priceRecord);
  const facilities = extractFacilities(item.about);
  const vibes = deriveVibes(item, facilities, hours);
  const menuHighlights = extractMenuHighlights(item, menuRecord, priceRecord);
  const copy = buildIndonesianCopy(title, area, city, vibes, facilities, item.category);

  const rawRating = Number(item.review_rating);
  const rating = Number.isFinite(rawRating)
    ? Math.min(5, Math.max(1, Math.round(rawRating * 10) / 10))
    : 4.5;
  const reviewCount = Math.max(0, Math.round(Number(item.review_count || 0)));

  const fallbackMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
  const mapsUrl = sanitizeHttpsUrl(item.link, fallbackMapsUrl);
  const accentColor = ACCENT_PALETTE[hashString(id) % ACCENT_PALETTE.length];

  const cafe = {
    id,
    name: title,
    tagline: copy.tagline,
    city,
    area,
    address,
    vibes,
    facilities,
    priceRange: pricing.priceRange,
    priceLevel: pricing.priceLevel,
    opensAt: hours.opensAt,
    closesAt: hours.closesAt,
    ...(hours.open24 ? { open24: true } : {}),
    rating,
    reviewCount,
    bestFor: copy.bestFor,
    description: copy.description,
    menuHighlights,
    mapsUrl,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    accentColor,
  };

  if (includeImages && item.thumbnail) {
    const safeThumb = sanitizeHttpsUrl(item.thumbnail, '');
    if (safeThumb) cafe.image = safeThumb;
  }

  return {
    cafe,
    reason: null,
    meta: { hoursParsed: hours.parsed, priceSource: pricing.source },
  };
}

function loadJsonlMap(filePath) {
  const map = new Map();
  if (!filePath || !existsSync(filePath)) return map;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj?.cid) map.set(String(obj.cid), obj);
    } catch {
      // Ignore partial line from interrupted runs.
    }
  }
  return map;
}

export function exportCafesDataset(records, options) {
  const {
    city = 'Pontianak',
    minReviews = 10,
    limit = null,
    menuByCid = new Map(),
    priceByCid = new Map(),
    includeImages = false,
  } = options;

  const usedIds = new Set();
  const cafes = [];
  const skipped = {
    low_reviews: 0,
    missing_title: 0,
    permanently_closed: 0,
    invalid_coordinates: 0,
  };
  const coverage = { hoursParsed: 0, priceVision: 0, pricePanel: 0, priceFallback: 0, withImage: 0 };

  for (const item of records) {
    if (Number(item?.review_count || 0) < minReviews) {
      skipped.low_reviews += 1;
      continue;
    }

    const result = convertScrapedCafe(item, {
      city,
      menuByCid,
      priceByCid,
      usedIds,
      includeImages,
    });

    if (!result.cafe) {
      skipped[result.reason] = (skipped[result.reason] || 0) + 1;
      continue;
    }

    cafes.push(result.cafe);
    if (result.meta.hoursParsed) coverage.hoursParsed += 1;
    if (result.meta.priceSource === 'vision') coverage.priceVision += 1;
    else if (result.meta.priceSource === 'panel') coverage.pricePanel += 1;
    else coverage.priceFallback += 1;
    if (result.cafe.image) coverage.withImage += 1;

    if (limit && cafes.length >= limit) break;
  }

  return { cafes, skipped, coverage };
}

function runCli() {
  const opts = parseArgs(process.argv.slice(2));
  const inputPath = resolve(opts.input);
  if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    console.error('Run Stage 1b (node tools/scraper/normalize-pontianak.mjs) first or pass --input <path>.');
    process.exit(1);
  }

  const records = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(records)) {
    throw new Error(`Expected JSON array in ${inputPath}`);
  }

  const menuByCid = loadJsonlMap(resolve(opts.menus));
  const priceByCid = loadJsonlMap(resolve(opts.prices));
  const { cafes, skipped, coverage } = exportCafesDataset(records, {
    city: opts.city,
    minReviews: opts.minReviews,
    limit: opts.limit,
    menuByCid,
    priceByCid,
    includeImages: opts.includeImages,
  });

  const outPath = resolve(opts.output);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(cafes, null, 2)}\n`, 'utf8');

  if (opts.tsOutput) {
    const tsPath = resolve(opts.tsOutput);
    mkdirSync(dirname(tsPath), { recursive: true });
    const tsBody =
      `import type { Cafe } from '../../src/data/cafes';\n\n` +
      `export const SCRAPED_CAFES: Cafe[] = ${JSON.stringify(cafes, null, 2)};\n`;
    writeFileSync(tsPath, tsBody, 'utf8');
  }

  console.log('=== STAGE 4 EXPORT SUMMARY ===');
  console.log(`Input records        : ${records.length}`);
  console.log(`Exported cafes       : ${cafes.length}`);
  console.log(`Skipped (reviews)    : ${skipped.low_reviews}`);
  console.log(`Skipped (coords)     : ${skipped.invalid_coordinates}`);
  console.log(`Skipped (closed)     : ${skipped.permanently_closed}`);
  console.log(`Parsed open_hours    : ${coverage.hoursParsed}/${cafes.length}`);
  console.log(`Prices (vision/panel/fallback): ${coverage.priceVision}/${coverage.pricePanel}/${coverage.priceFallback}`);
  console.log(`Output JSON          : ${outPath}`);
  if (opts.tsOutput) console.log(`Output TS            : ${resolve(opts.tsOutput)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli();
}
