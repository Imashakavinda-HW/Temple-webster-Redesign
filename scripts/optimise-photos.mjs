// Turns original photos into fast, web-ready images.
//
//   1. Put photos in the `photos/` folder, named after the product they show:
//        sofa.jpg  dining-table.jpg  bed.jpg  bedside-tables.jpg  rattan-lounge.jpg
//        lamp.jpg  rug.jpg  office-chair.jpg  standing-desk.jpg  hero.jpg
//      (.jpg, .jpeg, .png or .webp all work)
//   2. Run: npm run photos
//
// Product photos are cropped to squares with "attention" cropping (keeps the most
// interesting part of the picture in frame) and saved as WebP at 480px and 960px, so
// phones download the small one and sharp screens the large one (UI/UX Pro Max:
// image-optimization, responsive srcset). The home-page banner keeps its shape.
// Output goes to client/public/images/, which Vite copies into the built site.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(root, process.argv[2] || 'photos');
const out = path.join(root, 'client/public/images');
const PRODUCTS = ['sofa', 'dining-table', 'bed', 'bedside-tables', 'rattan-lounge', 'lamp', 'rug', 'office-chair', 'standing-desk'];

if (!fs.existsSync(src)) {
  console.error(`No "${path.relative(root, src)}" folder found. Create it and add photos named e.g. sofa.jpg`);
  process.exit(1);
}
fs.mkdirSync(path.join(out, 'products'), { recursive: true });

const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const find = (slug) => files.find((f) => path.parse(f).name.toLowerCase() === slug);
let done = 0;

for (const slug of PRODUCTS) {
  const file = find(slug);
  if (!file) { console.log(`  - ${slug}: no photo yet (the line drawing will be shown)`); continue; }
  const { width, height } = await sharp(path.join(src, file)).metadata();
  if (Math.min(width, height) < 960) console.log(`  ! ${slug}: the photo is small (${width}×${height}) and may look soft; a larger download is better`);
  for (const size of [480, 960]) {
    await sharp(path.join(src, file)).rotate() // respect camera orientation
      .resize(size, size, { fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 80 })
      .toFile(path.join(out, 'products', `${slug}-${size}.webp`));
  }
  console.log(`  ✓ ${slug}  (from ${file})`);
  done++;
}

const hero = find('hero');
if (hero) {
  for (const width of [960, 1600]) {
    await sharp(path.join(src, hero)).rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(path.join(out, `hero-${width}.webp`));
  }
  console.log(`  ✓ hero  (from ${hero})`);
  done++;
} else {
  console.log('  - hero: no photo yet (the drawing will be shown)');
}

console.log(`\n${done} photo(s) optimised into client/public/images. Run "npm run build" to include them in the built site.`);
