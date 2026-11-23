import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

function parseArgs(argv) {
  const opts = {
    input: 'tools/scraper/output/pontianak-cafes.json',
    output: 'tools/scraper/output/pontianak-menus.jsonl',
    profileDir: 'tools/scraper/chrome-profile',
    login: false,
    limit: null,
    offset: 0,
    download: false,
    maxImages: 8,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) opts.input = argv[++i];
    else if (arg === '--output' && argv[i + 1]) opts.output = argv[++i];
    else if (arg === '--profile-dir' && argv[i + 1]) opts.profileDir = argv[++i];
    else if (arg === '--login') opts.login = true;
    else if (arg === '--limit' && argv[i + 1]) opts.limit = Number(argv[++i]);
    else if (arg === '--offset' && argv[i + 1]) opts.offset = Number(argv[++i]);
    else if (arg === '--max-images' && argv[i + 1]) opts.maxImages = Number(argv[++i]);
    else if (arg === '--download') opts.download = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node tools/scraper/scrape-menus.mjs [options]
  --login              Open visible browser with persistent profile to sign in to Google Maps
  --profile-dir <path> Persistent browser profile dir (default: tools/scraper/chrome-profile)
  --input <path>       Input JSON array (default: tools/scraper/output/pontianak-cafes.json)
  --output <path>      Output JSONL file (default: tools/scraper/output/pontianak-menus.jsonl)
  --limit <n>          Max cafes to process in this run
  --offset <n>         Start index in input array (default: 0)
  --download           Download menu images locally under tools/scraper/output/menu-images/<cid>/
  --max-images <n>     Max menu images per cafe (default: 8)`);
      process.exit(0);
    }
  }
  return opts;
}

function findBrowserExecutable() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const localAppData = process.env.LOCALAPPDATA || '';
  const msPlaywrightDir = join(localAppData, 'ms-playwright');
  if (localAppData && existsSync(msPlaywrightDir)) {
    const dirs = readdirSync(msPlaywrightDir).filter((d) => d.startsWith('chromium-')).sort().reverse();
    for (const dir of dirs) {
      for (const candidate of [
        join(msPlaywrightDir, dir, 'chrome-win64', 'chrome.exe'),
        join(msPlaywrightDir, dir, 'chrome-win', 'chrome.exe'),
      ]) {
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  for (const fallback of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]) {
    if (existsSync(fallback)) return fallback;
  }

  throw new Error('Browser executable tidak ditemukan. Set env CHROME_PATH ke lokasi chrome.exe/msedge.exe.');
}

function loadExistingCids(outputPath) {
  const cids = new Set();
  if (!existsSync(outputPath)) return cids;
  const lines = readFileSync(outputPath, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj?.cid) cids.add(String(obj.cid));
    } catch {
      // Ignore partial trailing line if a previous run was interrupted.
    }
  }
  return cids;
}

function normalizeImageUrl(rawUrl) {
  const clean = String(rawUrl || '').trim();
  if (!clean || !clean.includes('googleusercontent.com')) return null;
  if (/\/a-\/|\/a\//.test(clean)) return null;
  if (/=s\d+-c-rp-mo/.test(clean)) return null;

  const isPlacePhoto = /\/(p|gps-cs-s|grass-cs|geougc-cs)\//.test(clean);
  if (!isPlacePhoto) return null;

  const base = clean.split('=')[0];
  return {
    base,
    original_url: clean,
    url: `${base}=w1600`,
  };
}

function dedupeAndCapImages(rawUrls, maxImages) {
  const byBase = new Map();
  for (const raw of rawUrls) {
    const norm = normalizeImageUrl(raw);
    if (!norm) continue;
    if (!byBase.has(norm.base)) {
      byBase.set(norm.base, { url: norm.url, original_url: norm.original_url });
    }
    if (byBase.size >= maxImages) break;
  }
  return Array.from(byBase.values());
}

async function detectLimitedView(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || '';
    return /tampilan terbatas|limited view of google maps/i.test(text);
  });
}

async function extractPriceRangeFromPanel(page) {
  return page.evaluate(() => {
    const main = document.querySelector('div[role="main"]') || document.body;
    const ariaEls = Array.from(main.querySelectorAll('[aria-label]'));
    for (const el of ariaEls) {
      const label = el.getAttribute('aria-label') || '';
      if (/harga|price/i.test(label) && /(Rp|\$)/i.test(label)) {
        return label.trim();
      }
    }
    const text = main.innerText || '';
    const match = text.match(/Rp\s?[\d.,]+(?:\s?[–-]\s?(?:Rp\s?)?[\d.,]+)?(?:\s*per orang|\s*\/orang)?/i);
    if (match) return match[0].trim();
    const dollarMatch = text.match(/(?:^|\n)\s*(\${1,4}|Rp\s?\$+)\s*(?:\n|$)/m);
    return dollarMatch ? dollarMatch[1].trim() : '';
  });
}

async function collectMenuImagesFromPage(page) {
  return page.evaluate(() => {
    const urls = [];
    const main = document.querySelector('div[role="main"]') || document.body;

    for (const img of Array.from(main.querySelectorAll('img'))) {
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.width < 60 && rect.height > 0 && rect.height < 60) continue;
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (src.includes('googleusercontent.com')) urls.push(src);
    }

    for (const el of Array.from(main.querySelectorAll('[style*="background-image"]'))) {
      const style = el.getAttribute('style') || '';
      const m = style.match(/url\(["']?(https:\/\/[^"')]+googleusercontent\.com[^"')]+)["']?\)/i);
      if (m && m[1]) urls.push(m[1]);
    }

    return urls;
  });
}

async function collectStructuredMenuItems(page) {
  return page.evaluate(() => {
    const main = document.querySelector('div[role="main"]') || document.body;
    const lines = (main.innerText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const items = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (/^Rp\s?[\d.,]+$/i.test(lines[i]) && i > 0) {
        items.push({ name: lines[i - 1], price: lines[i] });
      }
    }
    return items.slice(0, 40);
  });
}

async function scrollMainContainer(page) {
  await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('div[role="main"] div')).filter((el) => {
      const st = getComputedStyle(el);
      return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 50;
    });
    for (const el of candidates.slice(0, 3)) {
      el.scrollTop += 900;
    }
  });
}

function extFromContentType(contentType) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  return '.jpg';
}

async function downloadMenuImages(cid, images, baseDir) {
  const cafeDir = join(baseDir, String(cid));
  mkdirSync(cafeDir, { recursive: true });
  const results = [];

  for (let i = 0; i < images.length; i += 1) {
    const item = images[i];
    let savedPath = '';
    for (const candidateUrl of [item.url, item.original_url]) {
      try {
        const res = await fetch(candidateUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1500) continue;
        const ext = extFromContentType(res.headers.get('content-type'));
        const fileName = `menu-${String(i + 1).padStart(2, '0')}${ext}`;
        const fullPath = join(cafeDir, fileName);
        writeFileSync(fullPath, buf);
        savedPath = `tools/scraper/output/menu-images/${cid}/${fileName}`;
        break;
      } catch {
        // Fallback to original_url if =w1600 fails.
      }
    }
    results.push({
      url: item.url,
      original_url: item.original_url,
      local_path: savedPath,
    });
  }
  return results;
}

const opts = parseArgs(process.argv.slice(2));
const executablePath = findBrowserExecutable();
const profileDir = resolve(opts.profileDir);
mkdirSync(profileDir, { recursive: true });

if (opts.login) {
  console.log(`Using browser: ${executablePath}`);
  console.log(`Using profile: ${profileDir}`);
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath,
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: 'id-ID',
    args: ['--no-sandbox'],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://www.google.com/maps?hl=id', { waitUntil: 'domcontentloaded' });
  console.log('Silakan login akun Google di jendela browser yang terbuka, lalu tutup browser atau tekan Ctrl+C jika Google Maps sudah tampil penuh.');
  await new Promise((r) => context.on('close', r));
  process.exit(0);
}

const inputPath = resolve(opts.input);
const outputPath = resolve(opts.output);
const imagesBaseDir = resolve('tools/scraper/output/menu-images');
mkdirSync(dirname(outputPath), { recursive: true });

const allCafes = JSON.parse(readFileSync(inputPath, 'utf8'));
const doneCids = loadExistingCids(outputPath);

const sliced = allCafes.slice(opts.offset, opts.limit ? opts.offset + opts.limit : undefined);
const todo = sliced.filter((c) => !doneCids.has(String(c.cid)));

console.log(`Loaded ${allCafes.length} cafes. Slice: ${sliced.length}, already done: ${sliced.length - todo.length}, to process: ${todo.length}`);

if (todo.length === 0) {
  console.log('Nothing to process.');
  process.exit(0);
}

console.log(`Using browser: ${executablePath}`);
console.log(`Using profile: ${profileDir}`);

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath,
  headless: true,
  viewport: { width: 1280, height: 900 },
  locale: 'id-ID',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  args: ['--no-sandbox'],
});

const page = context.pages()[0] || (await context.newPage());

let processed = 0;
let limitedViewCount = 0;
let withPricePanel = 0;
let withMenuPhotos = 0;
let totalImages = 0;
let warnedLimitedView = false;
const samples = [];

try {
  for (const cafe of todo) {
    const record = {
      cid: String(cafe.cid || ''),
      title: cafe.title || '',
      link: cafe.link || '',
      limited_view: false,
      price_range_panel: '',
      menu_tab_found: false,
      menu_photo_source: 'none',
      menu_text_items: [],
      menu_images: [],
      scraped_at: new Date().toISOString(),
      error: '',
    };

    try {
      await page.goto(cafe.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('h1').first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(1200);

      record.limited_view = await detectLimitedView(page);
      if (record.limited_view) {
        limitedViewCount += 1;
        if (!warnedLimitedView) {
          console.warn('PERINGATAN: Google Maps menampilkan tampilan terbatas (Limited View). Jalankan `node tools/scraper/scrape-menus.mjs --login` terlebih dahulu.');
          warnedLimitedView = true;
        }
      }

      record.price_range_panel = await extractPriceRangeFromPanel(page);

      const tabs = page.locator('button[role="tab"]');
      const tabCount = await tabs.count();
      let menuTabIdx = -1;
      for (let i = 0; i < tabCount; i += 1) {
        const txt = ((await tabs.nth(i).innerText().catch(() => '')) || '').trim();
        if (/^Menu$/i.test(txt)) {
          menuTabIdx = i;
          break;
        }
      }

      let rawUrls = [];
      if (menuTabIdx >= 0) {
        record.menu_tab_found = true;
        await tabs.nth(menuTabIdx).click();
        await page.waitForTimeout(2000);
        await scrollMainContainer(page);
        await page.waitForTimeout(1000);
        await scrollMainContainer(page);
        await page.waitForTimeout(800);

        record.menu_text_items = await collectStructuredMenuItems(page);
        rawUrls = await collectMenuImagesFromPage(page);
        if (dedupeAndCapImages(rawUrls, opts.maxImages).length > 0) {
          record.menu_photo_source = 'menu_tab';
        }
      }

      if (dedupeAndCapImages(rawUrls, opts.maxImages).length === 0) {
        const photoTrigger = page
          .locator('button[jsaction*="heroHeaderImage"], button[aria-label*="Foto"], button[aria-label*="Photo"]')
          .first();
        if ((await photoTrigger.count()) > 0) {
          await photoTrigger.click().catch(() => {});
          await page.waitForTimeout(2200);

          const menuFilter = page
            .locator('button, [role="tab"], [role="radio"]')
            .filter({ hasText: /^Menu$/i })
            .first();

          if ((await menuFilter.count()) > 0) {
            await menuFilter.click().catch(() => {});
            await page.waitForTimeout(2000);
            await scrollMainContainer(page);
            await page.waitForTimeout(1000);
            rawUrls = await collectMenuImagesFromPage(page);
            if (dedupeAndCapImages(rawUrls, opts.maxImages).length > 0) {
              record.menu_photo_source = 'photos_menu_filter';
            }
          }
        }
      }

      let finalImages = dedupeAndCapImages(rawUrls, opts.maxImages).map((img) => ({
        ...img,
        local_path: '',
      }));

      if (opts.download && finalImages.length > 0) {
        finalImages = await downloadMenuImages(record.cid, finalImages, imagesBaseDir);
      }

      record.menu_images = finalImages;
    } catch (err) {
      record.error = err instanceof Error ? err.message : String(err);
    }

    appendFileSync(outputPath, `${JSON.stringify(record)}\n`, 'utf8');
    processed += 1;
    if (record.price_range_panel) withPricePanel += 1;
    if (record.menu_images.length > 0) withMenuPhotos += 1;
    totalImages += record.menu_images.length;
    if (samples.length < 5) samples.push(record);

    console.log(
      `[${processed}/${todo.length}] ${record.title} | limited=${record.limited_view} | price=${record.price_range_panel || '-'} | src=${record.menu_photo_source} | imgs=${record.menu_images.length}${record.error ? ` | ERR=${record.error}` : ''}`,
    );

    const delayMs = 1200 + Math.floor(Math.random() * 600);
    await page.waitForTimeout(delayMs);
  }
} finally {
  await context.close();
}

console.log('\n=== STAGE 2 MENU SCRAPE SUMMARY ===');
console.log(`Processed       : ${processed}`);
console.log(`Limited view    : ${limitedViewCount}/${processed}`);
console.log(`With price panel: ${withPricePanel}/${processed}`);
console.log(`With menu photos: ${withMenuPhotos}/${processed}`);
console.log(`Total images    : ${totalImages}`);
console.log('\nSample results:');
for (const s of samples) {
  console.log(`- ${s.title}: limited=${s.limited_view}, price="${s.price_range_panel || '-'}", source=${s.menu_photo_source}, images=${s.menu_images.length}`);
  if (s.menu_images[0]) {
    console.log(`  first: ${s.menu_images[0].local_path || s.menu_images[0].url}`);
  }
}
