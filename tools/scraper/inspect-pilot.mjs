import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rawPath = resolve('tools/scraper/output/pilot-raw.json');
const summaryPath = resolve('tools/scraper/output/pilot-summary.json');

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

function getMenuLink(menu) {
  if (!menu) return '';
  if (typeof menu === 'string') return menu.trim();
  if (typeof menu === 'object' && typeof menu.link === 'string') return menu.link.trim();
  return '';
}

function hasOpenHours(openHours) {
  return Boolean(openHours && typeof openHours === 'object' && Object.keys(openHours).length > 0);
}

function hasAbout(about) {
  return Array.isArray(about) && about.length > 0;
}

const rawText = readFileSync(rawPath, 'utf8');
const rawRecords = parseInput(rawText);

const seen = new Set();
const uniqueRecords = [];
for (const item of rawRecords) {
  const key = item.cid || item.place_id || item.link;
  if (key && seen.has(key)) continue;
  if (key) seen.add(key);
  uniqueRecords.push(item);
}

const imageTitleCounts = {};
const priceRangeSamples = [];
const menuLinkSamples = [];

const normalized = uniqueRecords.map((item) => {
  const images = Array.isArray(item.images) ? item.images : [];
  const allImageTitles = [];

  for (const img of images) {
    const title = typeof img?.title === 'string' && img.title.trim() ? img.title.trim() : '(untitled)';
    allImageTitles.push(title);
    imageTitleCounts[title] = (imageTitleCounts[title] || 0) + 1;
  }

  const menuImages = images
    .filter((img) => typeof img?.title === 'string' && /menu/i.test(img.title))
    .map((img) => ({
      title: img.title,
      image: img.image || img.url || '',
    }))
    .filter((img) => img.image);

  const priceRange = typeof item.price_range === 'string' ? item.price_range.trim() : '';
  if (priceRange && priceRangeSamples.length < 10) {
    priceRangeSamples.push(`${item.title}: ${priceRange}`);
  }

  const menuLink = getMenuLink(item.menu);
  if (menuLink && menuLinkSamples.length < 10) {
    menuLinkSamples.push(`${item.title}: ${menuLink}`);
  }

  return {
    cid: item.cid || '',
    title: item.title || '',
    category: item.category || '',
    address: item.address || '',
    phone: item.phone || '',
    website: item.web_site || item.website || '',
    link: item.link || '',
    price_range: priceRange,
    review_rating: item.review_rating ?? null,
    review_count: item.review_count ?? 0,
    open_hours: item.open_hours || {},
    menu: item.menu || { link: '', source: '' },
    menu_images: menuImages,
    all_image_titles: [...new Set(allImageTitles)],
    image_count: images.length,
    about_count: Array.isArray(item.about) ? item.about.length : 0,
    review_images_count: Array.isArray(item.user_reviews)
      ? item.user_reviews.reduce((sum, r) => sum + (Array.isArray(r.Images) ? r.Images.length : 0), 0)
      : 0,
  };
});

const stats = {
  total_raw: rawRecords.length,
  total_unique: uniqueRecords.length,
  with_price_range: normalized.filter((x) => Boolean(x.price_range)).length,
  with_menu_link: normalized.filter((x) => Boolean(getMenuLink(x.menu))).length,
  with_open_hours: normalized.filter((x) => hasOpenHours(x.open_hours)).length,
  with_about: normalized.filter((x) => x.about_count > 0).length,
  with_images: normalized.filter((x) => x.image_count > 0).length,
  with_menu_images: normalized.filter((x) => x.menu_images.length > 0).length,
  with_review_images: normalized.filter((x) => x.review_images_count > 0).length,
  image_title_breakdown: imageTitleCounts,
};

writeFileSync(summaryPath, JSON.stringify({ stats, items: normalized }, null, 2), 'utf8');

console.log('=== PILOT SCRAPE SUMMARY ===');
console.log(`Raw records   : ${stats.total_raw}`);
console.log(`Unique cafes  : ${stats.total_unique}`);
console.log(`price_range   : ${stats.with_price_range}/${stats.total_unique}`);
console.log(`menu link     : ${stats.with_menu_link}/${stats.total_unique}`);
console.log(`open_hours    : ${stats.with_open_hours}/${stats.total_unique}`);
console.log(`about         : ${stats.with_about}/${stats.total_unique}`);
console.log(`images        : ${stats.with_images}/${stats.total_unique}`);
console.log(`menu_images   : ${stats.with_menu_images}/${stats.total_unique}`);
console.log(`review_images : ${stats.with_review_images}/${stats.total_unique}`);
console.log('Image title breakdown:', JSON.stringify(imageTitleCounts));
if (priceRangeSamples.length) {
  console.log('Price range samples:', priceRangeSamples);
}
if (menuLinkSamples.length) {
  console.log('Menu link samples:', menuLinkSamples);
}

console.log('\n=== SAMPLE CAFES (up to 5) ===');
for (const cafe of normalized.slice(0, 5)) {
  console.log(`- ${cafe.title} (${cafe.category})`);
  console.log(`  Address     : ${cafe.address}`);
  console.log(`  Rating      : ${cafe.review_rating} (${cafe.review_count} reviews)`);
  console.log(`  Price range : ${cafe.price_range || '(kosong)'}`);
  console.log(`  Menu link   : ${getMenuLink(cafe.menu) || '(kosong)'}`);
  console.log(`  Menu images : ${cafe.menu_images.length} | Gallery images: ${cafe.image_count} | Review images: ${cafe.review_images_count}`);
  if (cafe.menu_images[0]) {
    console.log(`  Sample menu : ${cafe.menu_images[0].image}`);
  }
}
