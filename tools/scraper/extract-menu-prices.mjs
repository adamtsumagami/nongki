import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

function parseArgs(argv) {
  const opts = {
    input: 'tools/scraper/output/pontianak-menus.jsonl',
    output: 'tools/scraper/output/pontianak-menu-prices.jsonl',
    limit: null,
    model: 'gemini-2.5-flash',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) opts.input = argv[++i];
    else if (arg === '--output' && argv[i + 1]) opts.output = argv[++i];
    else if (arg === '--limit' && argv[i + 1]) opts.limit = Number(argv[++i]);
    else if (arg === '--model' && argv[i + 1]) opts.model = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node tools/scraper/extract-menu-prices.mjs [options]
  --input <path>    Input JSONL from scrape-menus.mjs (default: tools/scraper/output/pontianak-menus.jsonl)
  --output <path>   Output JSONL with extracted menu prices (default: tools/scraper/output/pontianak-menu-prices.jsonl)
  --limit <n>       Max cafes to process
  --model <name>    Gemini model (default: gemini-2.5-flash)

Requires env GEMINI_API_KEY (or GOOGLE_API_KEY).
Example PowerShell:
  $env:GEMINI_API_KEY="your-key"
  node tools/scraper/extract-menu-prices.mjs --limit 10`);
      process.exit(0);
    }
  }
  return opts;
}

function mimeFromPath(filePath, contentType) {
  const ext = extname(filePath || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (contentType && contentType.startsWith('image/')) return contentType.split(';')[0].trim();
  return 'image/jpeg';
}

async function loadImagePart(img) {
  if (img.local_path && existsSync(resolve(img.local_path))) {
    const data = readFileSync(resolve(img.local_path)).toString('base64');
    return {
      inlineData: {
        mimeType: mimeFromPath(img.local_path, ''),
        data,
      },
    };
  }

  for (const candidateUrl of [img.url, img.original_url].filter(Boolean)) {
    const res = await fetch(candidateUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      inlineData: {
        mimeType: mimeFromPath('', res.headers.get('content-type')),
        data: buf.toString('base64'),
      },
    };
  }

  throw new Error(`Gagal memuat gambar: ${img.local_path || img.url}`);
}

const PROMPT = `You are a careful menu-price data extractor for Indonesian cafes and coffee shops.
Analyze the attached menu photos for one cafe and extract ONLY menu items whose prices are visibly printed in the photos.
Rules:
- Convert Indonesian shorthand prices accurately (e.g., "25K" or "25rb" or "25" in a menu context where prices are in thousands -> 25000; "18.000" -> 18000).
- Do not invent or guess items or prices that are unreadable or cut off.
- If the photos are NOT menu lists (e.g. only food/interior photos without prices), set "is_menu_photo": false and "items": [].
- Return strict JSON matching this schema:
{
  "items": [{ "name": "string", "category": "string", "price_idr": 25000, "variant": "string", "notes": "string" }],
  "price_min_idr": 0,
  "price_max_idr": 0,
  "currency": "IDR",
  "is_menu_photo": true
}`;

const opts = parseArgs(process.argv.slice(2));
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
if (!apiKey) {
  console.error(
    'Error: GEMINI_API_KEY belum diset.\n' +
      'Set dulu di PowerShell:\n' +
      '  $env:GEMINI_API_KEY="<your-gemini-api-key>"\n' +
      'Lalu jalankan ulang:\n' +
      '  node tools/scraper/extract-menu-prices.mjs',
  );
  process.exit(1);
}

const inputPath = resolve(opts.input);
const outputPath = resolve(opts.output);
if (!existsSync(inputPath)) {
  console.error(`Input tidak ditemukan: ${inputPath}`);
  process.exit(1);
}
mkdirSync(dirname(outputPath), { recursive: true });

const doneCids = new Set();
if (existsSync(outputPath)) {
  for (const line of readFileSync(outputPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      if (obj?.cid) doneCids.add(String(obj.cid));
    } catch {
      // Ignore partial line.
    }
  }
}

const cafesWithMenus = readFileSync(inputPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((c) => Array.isArray(c.menu_images) && c.menu_images.length > 0 && !doneCids.has(String(c.cid)));

const batch = opts.limit ? cafesWithMenus.slice(0, opts.limit) : cafesWithMenus;
console.log(`Cafes queued for Vision extraction: ${batch.length}`);

for (let i = 0; i < batch.length; i += 1) {
  const cafe = batch[i];
  const out = {
    cid: cafe.cid,
    title: cafe.title,
    extracted_at: new Date().toISOString(),
    source_images: cafe.menu_images.map((m) => m.local_path || m.url),
    extracted: null,
    error: '',
  };

  try {
    const imageParts = [];
    for (const img of cafe.menu_images.slice(0, 6)) {
      imageParts.push(await loadImagePart(img));
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, ...imageParts] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    out.extracted = JSON.parse(rawText);
    console.log(
      `[${i + 1}/${batch.length}] ${cafe.title}: ${out.extracted?.items?.length ?? 0} menu items (is_menu_photo=${out.extracted?.is_menu_photo})`,
    );
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
    console.log(`[${i + 1}/${batch.length}] ${cafe.title}: ERR=${out.error}`);
  }

  appendFileSync(outputPath, `${JSON.stringify(out)}\n`, 'utf8');
}
