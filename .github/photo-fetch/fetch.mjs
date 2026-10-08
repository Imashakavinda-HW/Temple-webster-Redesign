// One-off helper run by GitHub Actions: downloads the free photos listed in sources.txt
// into photos/ (named slug--<original file name> so credits can be read), and saves small
// previews of every candidate into photo-previews/ for checking.
import fs from 'node:fs';
import sharp from 'sharp';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const lines = fs.readFileSync(new URL('./sources.txt', import.meta.url), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
fs.mkdirSync('photos', { recursive: true });
fs.mkdirSync('photo-previews', { recursive: true });

const chosen = new Set();
const count = {};
const report = [];
for (const line of lines) {
  const [slug, source, id, who] = line.split(/\s+/);
  count[slug] = (count[slug] || 0) + 1;
  const tag = `${slug}-${count[slug]}-${id}`;
  try {
    let url, name;
    if (source === 'unsplash') {
      const r = await fetch(`https://unsplash.com/photos/${id}/download?force=true&w=2000`, { redirect: 'manual', headers: { 'user-agent': UA } });
      const loc = r.headers.get('location');
      if (!loc || !new URL(loc).hostname.endsWith('images.unsplash.com')) throw new Error(`no free download (HTTP ${r.status}, location ${loc})`);
      url = loc;
      name = new URL(loc).searchParams.get('dl') || `unknown-${id}-unsplash.jpg`;
    } else {
      url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=2000`;
      name = `pexels-${who}-${id}.jpg`;
    }
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) throw new Error(`HTTP ${res.status} ${type}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const { width, height } = await sharp(buf).metadata();
    await sharp(buf).rotate().resize({ width: 360 }).jpeg({ quality: 70 }).toFile(`photo-previews/${tag}-full.jpg`);
    await sharp(buf).rotate().resize(240, 240, { fit: 'cover', position: sharp.strategy.attention })
      .jpeg({ quality: 70 }).toFile(`photo-previews/${tag}-square.jpg`);
    const use = !chosen.has(slug);
    if (use) { fs.writeFileSync(`photos/${slug}--${name}`, buf); chosen.add(slug); }
    report.push(`ok    ${tag}  ${width}x${height}  ${name}${use ? '  <- USED' : ''}`);
  } catch (e) {
    report.push(`FAIL  ${tag}  ${e.message}`);
  }
}
fs.writeFileSync('photo-previews/REPORT.txt', `${report.join('\n')}\n`);
console.log(report.join('\n'));
