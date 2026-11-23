import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const rawPath = resolve('tools/scraper/output/pontianak-raw.json');
const outPath = resolve('tools/scraper/output/pontianak-review-candidates.jsonl');

const MENU_KEYWORD_RE = /harga|menu|daftar|price|rp\s?\d|\d+\s?rb|\d+k\b/i;

function parseInput(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function isPontianakArea(item) {
  const haystack = [
    item.address,
    item.complete_address?.city,
    item.complete_address?.borough,
    item.complete_address?.state,
  ]
    .filter(Boolean)
    .join(' ');
  return /pontianak|kubu raya|sungai raya/i.test(haystack);
}

function isPermanentlyClosed(item) {
  return /tutup permanen|permanently closed/i.test(String(item.status || ''));
}

function upgradeImageUrl(rawUrl) {
  const clean = String(rawUrl || '').trim();
  if (!clean) return null;
  const base = clean.split('=')[0];
  return {
    base,
    url: `${base}=w1600`,
    original_url: clean,
    local_path: '',
  };
}

function buildCandidates(item, maxImages = 8) {
  const reviews = Array.isArray(item.user_reviews) ? item.user_reviews : [];
  const menuReviews = reviews.filter((r) => MENU_KEYWORD_RE.test(String(r.Description || '')));

  const snippets = [];
  for (const rev of menuReviews) {
    const text = String(rev.Description || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    snippets.push(text.length > 220 ? `${text.slice(0, 217)}...` : text);
    if (snippets.length >= 5) break;
  }

  const byBase = new Map();
  const prioritized = menuReviews.filter((r) => Array.isArray(r.Images) && r.Images.length > 0);
  const sourceReviews = prioritized.length > 0 ? prioritized : reviews;
  const candidateSource = prioritized.length > 0 ? 'review_menu_keywords' : 'review_general';

  for (const rev of sourceReviews) {
    const imgs = Array.isArray(rev.Images) ? rev.Images : [];
    for (const rawUrl of imgs) {
      const norm = upgradeImageUrl(rawUrl);
      if (!norm || byBase.has(norm.base)) continue;
      byBase.set(norm.base, {
        url: norm.url,
        original_url: norm.original_url,
        local_path: norm.local_path,
      });
      if (byBase.size >= maxImages) break;
    }
    if (byBase.size >= maxImages) break;
  }

  const menuImages = Array.from(byBase.values());
  return {
    review_price_snippets: snippets,
    menu_images: menuImages,
    candidate_source: menuImages.length > 0 ? candidateSource : 'none',
  };
}

const rawRecords = parseInput(readFileSync(rawPath, 'utf8'));
const seen = new Set();
const unique = [];

for (const item of rawRecords) {
  const key = item.cid || item.place_id || item.link;
  if (key && seen.has(key)) continue;
  if (key) seen.add(key);
  unique.push(item);
}

const activePontianak = unique
  .filter((item) => isPontianakArea(item) && !isPermanentlyClosed(item))
  .sort((a, b) => Number(b.review_count || 0) - Number(a.review_count || 0));

const now = new Date().toISOString();
const rows = activePontianak.map((item) => {
  const cand = buildCandidates(item, 8);
  return {
    cid: String(item.cid || ''),
    title: item.title || '',
    link: item.link || '',
    website: item.web_site || item.website || '',
    review_price_snippets: cand.review_price_snippets,
    menu_images: cand.menu_images,
    candidate_source: cand.candidate_source,
    scraped_at: now,
  };
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');

const withKeywordPhotos = rows.filter((r) => r.candidate_source === 'review_menu_keywords').length;
const withAnyPhotos = rows.filter((r) => r.menu_images.length > 0).length;
const totalCandidatePhotos = rows.reduce((sum, r) => sum + r.menu_images.length, 0);
const withWebsite = rows.filter((r) => Boolean(r.website)).length;

console.log('=== REVIEW CANDIDATES SUMMARY ===');
console.log(`Total active cafes       : ${rows.length}`);
console.log(`Menu-keyword review imgs : ${withKeywordPhotos}/${rows.length}`);
console.log(`Any review candidate imgs: ${withAnyPhotos}/${rows.length}`);
console.log(`Total candidate photos   : ${totalCandidatePhotos}`);
console.log(`With website/IG/menu URL : ${withWebsite}/${rows.length}`);
console.log(`Output written to        : ${outPath}`);
