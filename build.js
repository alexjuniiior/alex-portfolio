// Builds the site into dist/ from src/ (design) and content/ (what the CMS edits).
// - Renders index.html from content/site.json and content/projects.json
// - Resizes / compresses every project image so uploads of any size stay fast
// Run locally with:  npm install && npm run build
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const MAX_WIDTH = 1032;  // 3× the 344px card in the design — sharp on retina screens
const FULL_WIDTH = 2400; // pop-up (lightbox) version
const VERSION = Date.now().toString(36);

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
    return { src: '/images/' + outName, full: '/images/' + outName, width, height };
  }

  const meta = await sharp(srcFile, { failOn: 'none' }).metadata();
  // Figma PNGs usually carry an alpha channel even when nothing is transparent
  const transparent = meta.hasAlpha && !(await sharp(srcFile).stats()).isOpaque;
  const fmt = transparent ? '.webp' : '.jpg';

  const render = (width, outName) => {
    const pipeline = sharp(srcFile, { failOn: 'none' })
      .rotate() // respect phone photo orientation
      .resize({ width, withoutEnlargement: true });
    const file = path.join(OUT, 'images', outName);
    return transparent
      ? pipeline.webp({ quality: 85 }).toFile(file)
      : pipeline.jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(file);
  };

  // Card-size image for the grid…
  const info = await render(MAX_WIDTH, base + fmt);
  // …and a bigger one for the pop-up, only when the original is larger than the card size
  let full = '/images/' + base + fmt;
  const origWidth = (meta.orientation >= 5 ? meta.height : meta.width) || 0;
  if (origWidth > MAX_WIDTH) {
    await render(FULL_WIDTH, base + '-full' + fmt);
    full = '/images/' + base + '-full' + fmt;
  }
  return { src: '/images/' + base + fmt, full, width: info.width, height: info.height };
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
      `<img src="${img.src}" data-full="${img.full}" width="${img.width}" height="${img.height}" alt="${esc(p.title)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` +
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
  console.log(`✓ Built ${cards.length} projects into dist/`);
}

build().catch((err) => { console.error(err); process.exit(1); });
