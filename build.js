// Builds the site into dist/ from src/ (design) and content/ (what the CMS edits).
// - Renders index.html from content/site.json and content/projects.json
// - Resizes / compresses every project image so uploads of any size stay fast
// Run locally with:  npm install && npm run build
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
// Every image is published in several widths; each browser picks the one it needs
// (cards on a phone ≈ 700px, cards on a retina laptop ≈ 1050px, pop-up on a big retina screen ≈ 2800px).
const WIDTHS = [800, 1200, 1600, 2200, 2800];
const WEBP = { quality: 90, smartSubsample: true, effort: 5 }; // keeps small UI text crisp
const VERSION = Date.now().toString(36);
const crypto = require('crypto');
const CACHE_DIR = path.join(__dirname, 'node_modules', '.cache', 'portfolio-images');
const SETTINGS_KEY = crypto.createHash('sha1').update(JSON.stringify(WEBP)).digest('hex').slice(0, 6);
let cacheHits = 0;
// How wide a card is at each layout (matches styles.css): phone 1 col, tablet 2 cols, desktop 3 cols
const CARD_SIZES = '(max-width: 760px) calc(100vw - 40px), (max-width: 1100px) calc((100vw - 112px) / 3), calc((min(100vw, 1920px) - 136px) / 4)';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name), dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else if (entry.name !== 'index.html') fs.copyFileSync(src, dst);
  }
}

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'image';

async function processImage(publicPath) {
  // CMS writes paths like "/images/foo.png"
  const rel = String(publicPath || '').replace(/^\/+/, '');
  const srcFile = path.join(ROOT, rel);
  if (!rel || !fs.existsSync(srcFile)) return null;

  const ext = path.extname(srcFile).toLowerCase();
  const base = slug(path.basename(srcFile, ext));
  fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });

  // Animated GIFs and SVGs are copied untouched
  if (ext === '.gif' || ext === '.svg') {
    const outName = base + ext;
    fs.copyFileSync(srcFile, path.join(OUT, 'images', outName));
    let width = 1032, height = 774;
    if (ext === '.gif') ({ width, height } = await sharp(srcFile).metadata());
    return { src: '/images/' + outName, srcset: '', full: '/images/' + outName, width, height };
  }

  const meta = await sharp(srcFile, { failOn: 'none' }).metadata();
  const rotated = meta.orientation >= 5;
  const srcW = (rotated ? meta.height : meta.width) || 0;
  const srcH = (rotated ? meta.width : meta.height) || 0;

  // Fingerprint the file so a replaced image always gets a new URL (no stale caches)
  const hash = crypto.createHash('sha1').update(fs.readFileSync(srcFile)).digest('hex').slice(0, 8);

  // Widths to publish: the standard steps below the original, plus the original width itself
  const widths = WIDTHS.filter((w) => w < srcW);
  if (srcW <= WIDTHS[WIDTHS.length - 1] || !widths.length) widths.push(Math.min(srcW, WIDTHS[WIDTHS.length - 1]));

  const variants = [];
  for (const w of widths) {
    const outName = `${base}-${hash}-${w}.webp`;
    const outFile = path.join(OUT, 'images', outName);
    // Reuse sizes made by an earlier build (Netlify keeps node_modules between builds)
    const cached = path.join(CACHE_DIR, `${hash}-${SETTINGS_KEY}-${w}.webp`);
    if (fs.existsSync(cached)) {
      fs.copyFileSync(cached, outFile);
      cacheHits++;
    } else {
      await sharp(srcFile, { failOn: 'none' })
        .rotate() // respect phone photo orientation
        .resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
        .webp(WEBP)
        .toFile(outFile);
      try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.copyFileSync(outFile, cached); } catch (e) { /* cache is optional */ }
    }
    variants.push({ w, url: '/images/' + outName });
  }

  const srcset = variants.map((v) => `${v.url} ${v.w}w`).join(', ');
  const fallback = (variants.find((v) => v.w >= 1200) || variants[variants.length - 1]).url;
  const largest = variants[variants.length - 1].url;
  return { src: fallback, srcset, full: largest, width: srcW, height: srcH };
}

async function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'src'), OUT);

  const site = readJSON('content/site.json');
  const { projects = [] } = readJSON('content/projects.json');

  const cards = [];
  const perColumn = { 1: 0, 2: 0, 3: 0 };
  for (const p of projects) {
    const img = await processImage(p.image);
    if (!img) {
      console.warn(`⚠ Skipping "${p.title || 'untitled'}": image not found (${p.image || 'none'})`);
      continue;
    }
    const col = ['1', '2', '3'].includes(String(p.column)) ? String(p.column) : '1';
    const eager = perColumn[col]++ < 2; // first two of each column are above the fold
    cards.push(
      `      <article class="item" data-col="${col}">` +
      `<a class="item__open" href="${img.full}" aria-label="Open ${esc(p.title)} full size">` +
      `<img src="${img.src}"${img.srcset ? ` srcset="${img.srcset}" sizes="${CARD_SIZES}"` : ''} width="${img.width}" height="${img.height}" alt="${esc(p.title)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` +
      `</a>` +
      `<div class="cap"><h2>${esc(p.title)}</h2>${p.subtitle ? `<p>${esc(p.subtitle)}</p>` : ''}</div></article>`
    );
  }

  const intro = (site.intro || [])
    .map((para) => (typeof para === 'string' ? para : para.text))
    .filter(Boolean)
    .map((t) => `          <p>${esc(t)}</p>`)
    .join('\n');

  const link = site.button_link || '#';
  const external = /^https?:\/\//i.test(link);

  const html = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8')
    .replace(/{{projects}}/g, cards.join('\n'))
    .replace(/{{intro}}/g, intro)
    .replace(/{{button_target}}/g, external ? ' target="_blank" rel="noopener"' : '')
    .replace(/{{button_link}}/g, esc(link))
    .replace(/{{button_label}}/g, esc(site.button_label || 'Get in touch'))
    .replace(/{{page_title}}/g, esc(site.page_title || site.name))
    .replace(/{{description}}/g, esc(site.description || ''))
    .replace(/{{name}}/g, esc(site.name))
    .replace(/{{version}}/g, VERSION);

  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`✓ Built ${cards.length} projects into dist/ (${cacheHits} image sizes reused from cache)`);
}

build().catch((err) => { console.error(err); process.exit(1); });
