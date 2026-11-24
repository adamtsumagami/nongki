import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

function parseArgs(argv) {
  const opts = {
    queries: 'tools/scraper/queries-pontianak.txt',
    urls: '',
    output: 'tools/scraper/output/pontianak-raw.json',
    profileDir: 'tools/scraper/chrome-profile',
    perQuery: 15,
    maxPlaces: 60,
    queryLimit: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--queries' && argv[++i]) opts.queries = argv[i];
    else if (arg === '--urls' && argv[++i]) opts.urls = argv[i];
    else if (arg === '--output' && argv[++i]) opts.output = argv[i];
    else if (arg === '--profile-dir' && argv[++i]) opts.profileDir = argv[i];
    else if (arg === '--per-query' && argv[++i]) opts.perQuery = Number(argv[i]);
    else if (arg === '--max-places' && argv[++i]) opts.maxPlaces = Number(argv[i]);
    else if (arg === '--query-limit' && argv[++i]) opts.queryLimit = Number(argv[i]);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node tools/scraper/scrape-places.mjs [options]
  --queries <path>     Query list file (default: tools/scraper/queries-pontianak.txt)
  --urls <path>        Optional direct Google Maps URLs file (supports maps.app.goo.gl)
  --output <path>      Output JSONL file (default: tools/scraper/output/pontianak-raw.json)
  --profile-dir <path> Persistent browser profile dir (default: tools/scraper/chrome-profile)
  --per-query <n>      Max place links collected per query (default: 15)
  --max-places <n>     Max unique places to inspect in this run (default: 60)
  --query-limit <n>    Optional max number of queries to execute`);
      process.exit(0);
    }
  }
  return opts;
}

async function resolveShortMapsUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  if (!/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(trimmed)) return trimmed;
  try {
    const res = await fetch(trimmed, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return res.url || trimmed;
  } catch {
    return trimmed;
  }
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

  throw new Error('Browser executable not found. Set CHROME_PATH to chrome.exe or msedge.exe.');
}

function loadExistingKeys(outputPath) {
  const keys = new Set();
  if (!existsSync(outputPath)) return keys;
  const text = readFileSync(outputPath, 'utf8').trim();
  if (!text) return keys;
  const rows = text.startsWith('[')
    ? JSON.parse(text)
    : text.split(/\r?\n/).filter(Boolean).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    });

  for (const row of rows) {
    if (!row) continue;
    if (row.cid) keys.add(String(row.cid));
    if (row.link) keys.add(cleanPlaceUrl(row.link));
  }
  return keys;
}

function cleanPlaceUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return `${u.origin}${u.pathname}`;
  } catch {
    return String(rawUrl || '').split('?')[0];
  }
}

function extractCidFromUrl(rawUrl) {
  const hexMatch = String(rawUrl || '').match(/!1s0x[0-9a-f]+:0x([0-9a-f]+)/i);
  if (hexMatch) {
    try {
      return BigInt(`0x${hexMatch[1]}`).toString(10);
    } catch {
      return hexMatch[1];
    }
  }
  const cidParam = String(rawUrl || '').match(/[?&]cid=(\d+)/i);
  return cidParam ? cidParam[1] : '';
}

function extractCoordsFromUrl(rawUrl) {
  const exact = String(rawUrl || '').match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (exact) {
    return { latitude: Number(exact[1]), longitude: Number(exact[2]) };
  }
  const viewport = String(rawUrl || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+),/);
  if (viewport) {
    return { latitude: Number(viewport[1]), longitude: Number(viewport[2]) };
  }
  return { latitude: null, longitude: null };
}

async function assertNotBlocked(page) {
  const url = page.url();
  if (/google\.[^/]+\/sorry\//i.test(url)) {
    throw new Error('BLOCKED_CAPTCHA: Google Maps returned an anti-bot/CAPTCHA challenge page.');
  }
  const blocked = await page.evaluate(() => {
    const text = (document.body?.innerText || '').slice(0, 2000);
    return /unusual traffic|bukan robot|verify you are human|captcha/i.test(text);
  });
  if (blocked) {
    throw new Error('BLOCKED_CAPTCHA: Google Maps presented a human-verification challenge.');
  }
}

async function collectPlaceLinksForQuery(page, query, limit) {
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=id`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2200);
  await assertNotBlocked(page);

  const collected = new Map();
  const feed = page.locator('div[role="feed"]').first();

  if ((await feed.count()) === 0) {
    // Query jumped directly to a single place page.
    if (page.url().includes('/maps/place/')) {
      const title = ((await page.locator('h1').first().innerText().catch(() => '')) || '').trim();
      if (title) collected.set(cleanPlaceUrl(page.url()), { title, url: page.url() });
    }
    return Array.from(collected.values());
  }

  const maxRounds = Math.min(28, Math.max(8, Math.ceil(limit * 0.9)));
  let stagnantRounds = 0;

  for (let round = 0; round < maxRounds && collected.size < limit; round += 1) {
    const prevSize = collected.size;
    const anchors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div[role="feed"] a[href*="/maps/place/"]')).map((a) => {
        const card = a.closest('div[jsaction]')?.parentElement || a.parentElement;
        const cardText = (card?.innerText || '').replace(/\u00a0/g, ' ');
        let feedRating = null;
        let feedReviews = 0;
        const revMatch = cardText.match(/(\d[.,]\d)\s*\(([\d.,]+)\)/);
        if (revMatch) {
          feedRating = Number(revMatch[1].replace(',', '.'));
          feedReviews = Number(revMatch[2].replace(/[.,]/g, ''));
        }
        let feedPrice = '';
        const priceMatch = cardText.match(/Rp\s?[\d.,]+(?:\s?[–-]\s?(?:Rp\s?)?[\d.,]+)?(?:\s*(?:rb|ribu))?/i);
        if (priceMatch) feedPrice = priceMatch[0].trim();

        return {
          href: a.getAttribute('href') || '',
          label: a.getAttribute('aria-label') || a.textContent || '',
          feedRating,
          feedReviews,
          feedPrice,
        };
      });
    });

    for (const item of anchors) {
      if (!item.href) continue;
      const key = cleanPlaceUrl(item.href);
      if (!collected.has(key)) {
        collected.set(key, {
          title: item.label.trim(),
          url: item.href,
          feedRating: item.feedRating,
          feedReviews: item.feedReviews,
          feedPrice: item.feedPrice,
        });
        if (collected.size >= limit) break;
      }
    }

    if (collected.size >= limit) break;
    if (collected.size === prevSize) stagnantRounds += 1;
    else stagnantRounds = 0;

    const reachedEnd = await page.evaluate(() => {
      const el = document.querySelector('div[role="feed"]');
      if (!el) return true;
      const text = el.innerText || '';
      if (/mencapai akhir daftar|reached the end of the list/i.test(text)) return true;
      el.scrollTop += 2200;
      return false;
    });
    if (reachedEnd || stagnantRounds >= 3) break;
    await page.waitForTimeout(1200);
  }

  return Array.from(collected.values());
}

async function extractPlaceDetails(page, candidate) {
  const candidateUrl = candidate.url;
  const targetUrl = candidateUrl.includes('hl=') ? candidateUrl : `${candidateUrl}${candidateUrl.includes('?') ? '&' : '?'}hl=id`;
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('h1').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1400);
  await assertNotBlocked(page);

  // Wait briefly for URL to settle with !3d...!4d... coordinates when redirected.
  await page.waitForTimeout(500);
  const currentUrl = page.url();
  const cid = extractCidFromUrl(currentUrl) || extractCidFromUrl(candidateUrl);
  const coords = extractCoordsFromUrl(currentUrl);
  const fallbackCoords = extractCoordsFromUrl(candidateUrl);
  const latitude = coords.latitude ?? fallbackCoords.latitude;
  const longitude = coords.longitude ?? fallbackCoords.longitude;

  const baseInfo = await page.evaluate(() => {
    const main = document.querySelector('div[role="main"]') || document.body;
    const title = (main.querySelector('h1')?.textContent || '').trim();
    const category = (main.querySelector('button[jsaction*="category"]')?.textContent || '').trim();

    const addressBtn = main.querySelector('button[data-item-id="address"]');
    const address = (
      addressBtn?.getAttribute('aria-label') ||
      addressBtn?.textContent ||
      ''
    )
      .replace(/^Alamat:\s*/i, '')
      .trim();

    const phoneBtn = main.querySelector('button[data-item-id^="phone:"]');
    const phone = (
      phoneBtn?.getAttribute('aria-label') ||
      phoneBtn?.textContent ||
      ''
    )
      .replace(/^Telepon:\s*/i, '')
      .trim();

    const websiteEl = main.querySelector('a[data-item-id="authority"]');
    const website = (websiteEl?.getAttribute('href') || '').trim();

    // Rating & review count
    let reviewRating = null;
    let reviewCount = 0;
    const ratingEl = main.querySelector('[aria-label*="bintang"], [aria-label*="stars"]');
    if (ratingEl) {
      const label = ratingEl.getAttribute('aria-label') || '';
      const rMatch = label.match(/(\d[.,]\d)/);
      if (rMatch) reviewRating = Number(rMatch[1].replace(',', '.'));
    }
    const reviewBtn = main.querySelector('button[aria-label*="ulasan"], button[aria-label*="review"], span[aria-label*="ulasan"]');
    if (reviewBtn) {
      const label = reviewBtn.getAttribute('aria-label') || reviewBtn.textContent || '';
      const cMatch = label.match(/([\d.,]+)\s*(ulasan|review)/i);
      if (cMatch) reviewCount = Number(cMatch[1].replace(/[.,]/g, ''));
    }
    if (!reviewCount) {
      const text = (main.innerText || '').replace(/\u00a0/g, ' ');
      const parenMatch = text.match(/(\d[.,]\d)\s*\(([\d.,]+)\)/);
      if (parenMatch) {
        if (reviewRating === null) reviewRating = Number(parenMatch[1].replace(',', '.'));
        reviewCount = Number(parenMatch[2].replace(/[.,]/g, ''));
      } else {
        const plainParen = text.match(/\(([\d.,]{1,7})\)/);
        if (plainParen) reviewCount = Number(plainParen[1].replace(/[.,]/g, ''));
      }
    }

    // Price range
    let priceRange = '';
    for (const el of Array.from(main.querySelectorAll('[aria-label]'))) {
      const label = el.getAttribute('aria-label') || '';
      if (/harga|price/i.test(label) && /(Rp|\$)/i.test(label)) {
        priceRange = label.replace(/^Harga:\s*/i, '').trim();
        break;
      }
    }
    if (!priceRange) {
      const text = main.innerText || '';
      const rpMatch = text.match(/Rp\s?[\d.,]+(?:\s?[–-]\s?(?:Rp\s?)?[\d.,]+)?(?:\s*(?:rb|ribu))?(?:\s*per orang)?/i);
      if (rpMatch) priceRange = rpMatch[0].trim();
    }

    const bodyText = main.innerText || '';
    const status = /tutup permanen|permanently closed/i.test(bodyText) ? 'Tutup permanen' : '';

    // Hero thumbnail
    let thumbnail = '';
    const heroImg = main.querySelector('button[jsaction*="heroHeaderImage"] img, img[src*="googleusercontent.com"]');
    if (heroImg) {
      const src = heroImg.getAttribute('src') || '';
      if (src.includes('googleusercontent.com') && !/\/a-\/|\/a\//.test(src)) {
        thumbnail = `${src.split('=')[0]}=w800`;
      }
    }

    // Inline open hours table or aria-label
    const openHours = {};
    const hoursTable = main.querySelector('table');
    if (hoursTable) {
      for (const tr of Array.from(hoursTable.querySelectorAll('tr'))) {
        const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.innerText || '').trim());
        if (cells.length >= 2 && cells[0] && cells[1]) {
          openHours[cells[0]] = cells[1].split(/\n+/).map((s) => s.trim()).filter(Boolean);
        }
      }
    }
    if (Object.keys(openHours).length === 0) {
      const hoursEl = main.querySelector('[aria-label*="Senin"], [aria-label*="Monday"], [data-item-id="oh"]');
      const label = hoursEl?.getAttribute('aria-label') || '';
      for (const seg of label.split(';')) {
        const parts = seg.trim().split(',');
        if (parts.length >= 2) {
          const day = parts[0].trim();
          const span = parts.slice(1).join(',').replace(/\.?\s*Sembunyikan.*$/i, '').trim();
          if (day && span) openHours[day] = [span];
        }
      }
    }

    return {
      title,
      category,
      address,
      phone,
      website,
      reviewRating,
      reviewCount,
      priceRange,
      status,
      thumbnail,
      openHours,
    };
  });

  // Expand open hours panel if empty on overview
  if (Object.keys(baseInfo.openHours).length === 0) {
    const hoursToggle = page
      .locator('button[data-item-id="oh"], div[jsaction*="openhours"] button, button[aria-label*="Jam buka"]')
      .first();
    if ((await hoursToggle.count()) > 0) {
      await hoursToggle.click().catch(() => { });
      await page.waitForTimeout(700);
      const expandedHours = await page.evaluate(() => {
        const hours = {};
        for (const tr of Array.from(document.querySelectorAll('div[role="main"] table tr'))) {
          const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.innerText || '').trim());
          if (cells.length >= 2 && cells[0] && cells[1]) {
            hours[cells[0]] = cells[1].split(/\n+/).map((s) => s.trim()).filter(Boolean);
          }
        }
        return hours;
      });
      if (Object.keys(expandedHours).length > 0) {
        baseInfo.openHours = expandedHours;
      }
    }
  }

  // Click Tentang / About tab for facilities & atmosphere
  let about = [];
  const tabs = page.locator('button[role="tab"]');
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i += 1) {
    const txt = ((await tabs.nth(i).innerText().catch(() => '')) || '').trim();
    if (/^(Tentang|About)$/i.test(txt)) {
      await tabs.nth(i).click().catch(() => { });
      await page.waitForTimeout(900);
      await page.evaluate(() => {
        const scroller =
          document.querySelector('div[role="main"] div.m6QErb.DxyBCb') ||
          document.querySelector('div[role="main"]');
        if (scroller) scroller.scrollTop += 1200;
      });
      await page.waitForTimeout(450);
      about = await page.evaluate(() => {
        const groups = [];
        const headings = Array.from(document.querySelectorAll('div[role="main"] h2'));
        for (const h2 of headings) {
          const groupName = (h2.textContent || '').trim();
          const list = h2.nextElementSibling;
          if (!list) continue;
          const options = Array.from(list.querySelectorAll('li'))
            .map((li) => {
              const aria = li.getAttribute('aria-label') || '';
              const name = (li.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim();
              const disabled = /^Tidak\b|^No\b/i.test(aria);
              return name ? { name, enabled: !disabled } : null;
            })
            .filter(Boolean);
          if (options.length > 0) {
            groups.push({ id: groupName.toLowerCase(), name: groupName, options });
          }
        }
        return groups;
      });
      break;
    }
  }

  // Parse rough street/borough from Indonesian Google Maps address
  const addrParts = baseInfo.address.split(',').map((s) => s.trim()).filter(Boolean);
  const street = addrParts[0] || '';
  const borough =
    addrParts.find((part) => /kec\.|pontianak\s+(kota|selatan|barat|timur|utara|tenggara)|sungai\s+raya/i.test(part)) ||
    addrParts[1] ||
    '';

  const inferredCity =
    addrParts.find((part) => /^(kota|kabupaten|kab\.)\s+/i.test(part)) ||
    (/jakarta/i.test(baseInfo.address)
      ? 'Jakarta'
      : /yogyakarta/i.test(baseInfo.address)
        ? 'Kota Yogyakarta'
        : /bandung/i.test(baseInfo.address)
          ? 'Kota Bandung'
          : /bogor/i.test(baseInfo.address)
            ? 'Kota Bogor'
            : /surabaya/i.test(baseInfo.address)
              ? 'Kota Surabaya'
              : /pontianak/i.test(baseInfo.address)
                ? 'Kota Pontianak'
                : '');

  const inferredState = /kalimantan barat/i.test(baseInfo.address)
    ? 'Kalimantan Barat'
    : /jakarta/i.test(baseInfo.address)
      ? 'DKI Jakarta'
      : /yogyakarta/i.test(baseInfo.address)
        ? 'DI Yogyakarta'
        : /jawa barat|bandung|bogor/i.test(baseInfo.address)
          ? 'Jawa Barat'
          : /jawa timur|surabaya/i.test(baseInfo.address)
            ? 'Jawa Timur'
            : '';

  return {
    cid,
    place_id: '',
    title: baseInfo.title,
    category: baseInfo.category,
    categories: baseInfo.category ? [baseInfo.category] : [],
    address: baseInfo.address,
    complete_address: {
      borough,
      street,
      city: inferredCity,
      state: inferredState,
    },
    latitude,
    longitude,
    phone: baseInfo.phone,
    web_site: baseInfo.website,
    link: cleanPlaceUrl(currentUrl),
    thumbnail: baseInfo.thumbnail,
    review_rating: baseInfo.reviewRating ?? candidate.feedRating ?? null,
    review_count: baseInfo.reviewCount || candidate.feedReviews || 0,
    price_range: baseInfo.priceRange || candidate.feedPrice || '',
    open_hours: baseInfo.openHours,
    about,
    status: baseInfo.status,
    menu: { link: '', source: '' },
    scraped_at: new Date().toISOString(),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const queriesPath = resolve(opts.queries);
  const urlsPath = opts.urls ? resolve(opts.urls) : '';
  const outputPath = resolve(opts.output);
  const profileDir = resolve(opts.profileDir);

  if (!existsSync(queriesPath) && (!urlsPath || !existsSync(urlsPath))) {
    throw new Error(`Queries or URLs file not found: ${queriesPath}`);
  }

  let queries = existsSync(queriesPath)
    ? readFileSync(queriesPath, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [];
  if (opts.queryLimit && opts.queryLimit > 0) {
    queries = queries.slice(0, opts.queryLimit);
  }

  const directUrls =
    urlsPath && existsSync(urlsPath)
      ? readFileSync(urlsPath, 'utf8')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'))
      : [];

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(profileDir, { recursive: true });

  const existingKeys = loadExistingKeys(outputPath);
  const executablePath = findBrowserExecutable();
  console.log(`Using browser: ${executablePath}`);
  console.log(`Queries: ${queries.length}, Direct URLs: ${directUrls.length}, per-query: ${opts.perQuery}, max-places: ${opts.maxPlaces}, already-done keys: ${existingKeys.size}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath,
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: 'id-ID',
    args: ['--no-sandbox', '--lang=id-ID'],
  });

  const page = context.pages()[0] || (await context.newPage());
  const candidates = new Map();

  try {
    for (const rawUrl of directUrls) {
      const resolvedUrl = await resolveShortMapsUrl(rawUrl);
      const key = cleanPlaceUrl(resolvedUrl);
      const cid = extractCidFromUrl(resolvedUrl);
      if (existingKeys.has(key) || (cid && existingKeys.has(cid))) continue;
      if (!candidates.has(key)) {
        candidates.set(key, { title: rawUrl, url: resolvedUrl, feedRating: null, feedReviews: 0, feedPrice: '' });
      }
    }

    const perQueryBuckets = [];
    for (let qi = 0; qi < queries.length; qi += 1) {
      const q = queries[qi];
      const found = await collectPlaceLinksForQuery(page, q, opts.perQuery);
      const bucket = [];
      for (const item of found) {
        const key = cleanPlaceUrl(item.url);
        const cid = extractCidFromUrl(item.url);
        if (existingKeys.has(key) || (cid && existingKeys.has(cid))) continue;
        bucket.push({ key, item });
      }
      perQueryBuckets.push(bucket);
      console.log(`[Query ${qi + 1}/${queries.length}] "${q}" -> found ${found.length}, unseen ${bucket.length}`);
      await page.waitForTimeout(700);
    }

    // Round-robin interleave across queries so later corridors are never starved.
    let roundIdx = 0;
    while (candidates.size < opts.maxPlaces) {
      let addedInRound = false;
      for (const bucket of perQueryBuckets) {
        if (roundIdx < bucket.length) {
          const { key, item } = bucket[roundIdx];
          if (!candidates.has(key)) {
            candidates.set(key, item);
            addedInRound = true;
            if (candidates.size >= opts.maxPlaces) break;
          }
        }
      }
      if (!addedInRound) break;
      roundIdx += 1;
    }

    const queue = Array.from(candidates.values());
    console.log(`\nInspecting ${queue.length} unique places...`);
    let saved = 0;

    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];
      try {
        const record = await extractPlaceDetails(page, item);
        if (!record.title) {
          console.log(`[${i + 1}/${queue.length}] SKIP empty title (${item.url})`);
          continue;
        }
        appendFileSync(outputPath, `${JSON.stringify(record)}\n`, 'utf8');
        saved += 1;
        console.log(
          `[${i + 1}/${queue.length}] ${record.title} | ${record.review_rating ?? '-'} (${record.review_count}) | hours=${Object.keys(record.open_hours).length}d | about=${record.about.length} | price=${record.price_range || '-'}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith('BLOCKED_CAPTCHA:')) {
          console.error(msg);
          process.exitCode = 2;
          break;
        }
        console.log(`[${i + 1}/${queue.length}] ERR ${item.title || item.url}: ${msg}`);
      }
      await page.waitForTimeout(900 + Math.floor(Math.random() * 400));
    }

    console.log(`\n=== STAGE 1 PLACE SCRAPE SUMMARY ===`);
    console.log(`Saved new places : ${saved}`);
    console.log(`Output written   : ${outputPath}`);
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
