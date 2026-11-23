import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rawPath = resolve('tools/scraper/output/pontianak-raw.json');
const cafesOutPath = resolve('tools/scraper/output/pontianak-cafes.json');
const statsOutPath = resolve('tools/scraper/output/pontianak-stats.json');

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

function getMenuInfo(menu) {
  if (!menu) return { link: '', source: '' };
  if (typeof menu === 'string') return { link: menu.trim(), source: '' };
  return {
    link: typeof menu.link === 'string' ? menu.link.trim() : '',
    source: typeof menu.source === 'string' ? menu.source.trim() : '',
  };
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

function countBy(items, keyFn) {
  const map = {};
  for (const item of items) {
    const key = keyFn(item) || '(kosong)';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(map).sort((a, b) => b[1] - a[1]),
  );
}

const rawRecords = parseInput(readFileSync(rawPath, 'utf8'));
const seen = new Set();
const uniqueRecords = [];

for (const item of rawRecords) {
  const key = item.cid || item.place_id || item.link;
  if (key && seen.has(key)) continue;
  if (key) seen.add(key);
  uniqueRecords.push(item);
}

const scrapedAt = new Date().toISOString();
const normalizedAll = uniqueRecords.map((item) => ({
  cid: item.cid || '',
  place_id: item.place_id || '',
  title: item.title || '',
  category: item.category || '',
  categories: Array.isArray(item.categories) ? item.categories : [],
  address: item.address || '',
  borough: item.complete_address?.borough || '',
  street: item.complete_address?.street || '',
  latitude: item.latitude ?? null,
  longitude: item.longitude ?? item.longtitude ?? null,
  phone: item.phone || '',
  website: item.web_site || item.website || '',
  link: item.link || '',
  thumbnail: item.thumbnail || '',
  review_rating: item.review_rating ?? null,
  review_count: Number(item.review_count || 0),
  price_range: typeof item.price_range === 'string' ? item.price_range.trim() : '',
  open_hours: item.open_hours && typeof item.open_hours === 'object' ? item.open_hours : {},
  about: Array.isArray(item.about) ? item.about : [],
  menu: getMenuInfo(item.menu),
  in_pontianak_area: isPontianakArea(item),
  permanently_closed: isPermanentlyClosed(item),
  scraped_at: scrapedAt,
}));

const activePontianak = normalizedAll
  .filter((item) => item.in_pontianak_area && !item.permanently_closed)
  .sort((a, b) => b.review_count - a.review_count);

const stats = {
  raw_records: rawRecords.length,
  unique_records: uniqueRecords.length,
  in_pontianak_area: normalizedAll.filter((x) => x.in_pontianak_area).length,
  outside_pontianak_area: normalizedAll.filter((x) => !x.in_pontianak_area).length,
  permanently_closed: normalizedAll.filter((x) => x.permanently_closed).length,
  active_pontianak_cafes: activePontianak.length,
  with_open_hours: activePontianak.filter((x) => Object.keys(x.open_hours).length > 0).length,
  with_price_range: activePontianak.filter((x) => Boolean(x.price_range)).length,
  with_menu_link: activePontianak.filter((x) => Boolean(x.menu.link)).length,
  with_about: activePontianak.filter((x) => x.about.length > 0).length,
  top_categories: Object.entries(countBy(activePontianak, (x) => x.category)).slice(0, 15),
  top_boroughs: Object.entries(countBy(activePontianak, (x) => x.borough)).slice(0, 15),
  generated_at: scrapedAt,
};

writeFileSync(cafesOutPath, JSON.stringify(activePontianak, null, 2), 'utf8');
writeFileSync(statsOutPath, JSON.stringify(stats, null, 2), 'utf8');

console.log('=== NORMALIZE PONTIANAK SUMMARY ===');
console.log(`Raw records            : ${stats.raw_records}`);
console.log(`Unique places          : ${stats.unique_records}`);
console.log(`Outside Pontianak area : ${stats.outside_pontianak_area}`);
console.log(`Permanently closed     : ${stats.permanently_closed}`);
console.log(`Active Pontianak cafes : ${stats.active_pontianak_cafes}`);
console.log(`With open_hours        : ${stats.with_open_hours}/${stats.active_pontianak_cafes}`);
console.log(`With price_range       : ${stats.with_price_range}/${stats.active_pontianak_cafes}`);
console.log(`With menu.link         : ${stats.with_menu_link}/${stats.active_pontianak_cafes}`);
console.log(`With about             : ${stats.with_about}/${stats.active_pontianak_cafes}`);
console.log('\nTop Categories:');
for (const [cat, count] of stats.top_categories.slice(0, 8)) {
  console.log(`  - ${cat}: ${count}`);
}
console.log('\nTop Boroughs:');
for (const [borough, count] of stats.top_boroughs.slice(0, 8)) {
  console.log(`  - ${borough}: ${count}`);
}
console.log('\nTop 5 Most-Reviewed Cafes:');
for (const c of activePontianak.slice(0, 5)) {
  console.log(`  - ${c.title} (${c.category}) | ${c.review_rating} (${c.review_count}) | ${c.borough || c.address}`);
}
