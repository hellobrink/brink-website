// Second half of the one-off migration: take the extracted structure and
// write it into the existing content files, preserving every field the
// files already carry (funders, partners, sector, logo, links) and adding
// the case-study fields the template needs.
//
// Images are downloaded from the CDN. Two buckets are in play and only one
// serves any given asset, so both are tried; anything that fails falls back
// to the shared placeholder so a page is never left with a broken image.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const extracted = JSON.parse(readFileSync('/tmp/cs-extracted.json', 'utf8'));

// The programme each case study belongs to, for the micro-heading above the
// title. Only where it's known; the rest render without a kicker.
const PROGRAMME = {
  'realising-the-potential-of-technology-to-transform-education': 'EdTech Hub',
  'thin-air-that-saves-lives': 'Oxygen CoLab',
  'a-city-problem-not-a-citizen-problem': 'ASToN',
  'addressing-health-inequalities-through-inclusive-design': 'Macmillan CoLab',
  'strengthening-the-digital-maturity-of-science-organisations': 'ISC Digital Journeys',
  'supporting-emobility-pioneers-in-africa': 'Frontier Tech Hub',
  'testing-the-production-of-hydroponic-fodder-for-cattle': 'Frontier Tech Hub',
  'creating-community-across-conflict-zones': 'Humanitarian Grand Challenge',
  'reimagining-the-future-of-work-in-kenyas-economy': 'TRANSFORM',
  'repair-reuse-kenya': 'Repair & Reuse CoLab',
};

// Bold that isn't a leading label ("**word** mid-sentence") is scrape noise.
// Keep bold only when it opens the string and closes at a colon.
function stripStrayBold(text) {
  const label = text.match(/^\*\*[^*]+:\*\*/);
  const rest = label ? text.slice(label[0].length) : text;
  return (label ? label[0] : '') + rest.replace(/\*\*/g, '');
}
const OUT = 'src/content/work';
const IMG = 'public/images';
const BUCKETS = ['66ce261592dea901d76ce690', '66c73a082f737ed8f94cfb47'];
const PLACEHOLDER = '/images/placeholder.svg';

const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

async function download(name, dest) {
  if (existsSync(dest) && statSync(dest).size > 1024) return true;
  for (const b of BUCKETS) {
    try {
      const res = await fetch(
        `https://cdn.prod.website-files.com/${b}/${encodeURIComponent(name)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://hellobrink.co/' } }
      );
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) continue;      // never leave a 0-byte file behind
      writeFileSync(dest, buf);
      return true;
    } catch {}
  }
  return false;
}

/** Story blocks -> Markdown. */
function storyToMarkdown(story) {
  const out = [];
  for (const b of story) {
    if (/^h[1-4]$/.test(b.tag)) {
      out.push(`## ${b.text.replace(/\*\*/g, '')}`);
    } else if (b.tag === 'li') {
      out.push(`- ${b.text}`);
    } else {
      out.push(b.text);
    }
  }
  return out.join('\n\n');
}

let missingImages = [];

for (const [slug, r] of Object.entries(extracted)) {
  const path = join(OUT, `${slug}.md`);
  if (!existsSync(path)) { console.log(`  no content file: ${slug}`); continue; }

  const src = readFileSync(path, 'utf8');
  const fmEnd = src.indexOf('\n---', 4);
  const fm = src.slice(4, fmEnd);

  // Keep every existing field except the ones we are about to rewrite.
  const drop = /^(standfirst|challenge|results|approach|approachIntro|conclusion|quote|gallery):/;
  const kept = [];
  let skipping = false;
  for (const line of fm.split('\n')) {
    if (drop.test(line)) { skipping = true; continue; }
    if (skipping && /^\s+/.test(line)) continue;   // nested list/object lines
    skipping = false;
    if (line.trim()) kept.push(line);
  }

  // --- images: hero stays, the rest become the gallery
  const gallery = [];
  for (const img of r.images.slice(0, 4)) {
    const ext = (img.src.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0];
    const file = `cs-${slug.slice(0, 40)}-${gallery.length + 1}${ext}`;
    const ok = await download(decodeURIComponent(img.src), join(IMG, file));
    if (!ok) { missingImages.push(`${slug}: ${img.src}`); continue; }
    gallery.push({ image: `/images/${file}`, alt: img.alt || r.title, caption: img.caption || '' });
  }

  const lines = [...kept];
  if (PROGRAMME[slug] && !kept.some((l) => l.startsWith('programmeName:'))) {
    lines.push(`programmeName: ${q(PROGRAMME[slug])}`);
  }
  if (r.standfirst) lines.push(`standfirst: ${q(r.standfirst)}`);
  if (r.challenge.length) {
    lines.push('challenge:');
    r.challenge.forEach((c) => lines.push(`  - ${q(c)}`));
  }
  if (r.results.length) {
    lines.push('results:');
    r.results.forEach((c) => lines.push(`  - ${q(stripStrayBold(c))}`));
  }
  if (r.approachIntro.length) {
    lines.push('approachIntro:');
    r.approachIntro.forEach((c) => lines.push(`  - ${q(c)}`));
  }
  if (r.approach.length) {
    lines.push('approach:');
    r.approach.forEach((c) => lines.push(`  - ${q(c)}`));
  }
  if (r.conclusion) lines.push(`conclusion: ${q(r.conclusion)}`);
  if (r.quote?.text) {
    lines.push('quote:');
    lines.push(`  text: ${q(r.quote.text)}`);
    // Never invent an attribution. An unattributed quote is honest; one
    // credited to the wrong person is not.
    if (r.quote.name) lines.push(`  name: ${q(r.quote.name)}`);
    else lines.push('  name: "TODO: who said this?"');
  }
  if (r.storyQuotes?.length) {
    lines.push('storyQuotes:');
    r.storyQuotes.forEach((sq) => lines.push(`  - ${q(sq)}`));
  }
  if (gallery.length) {
    lines.push('gallery:');
    gallery.forEach((g) => {
      lines.push(`  - image: ${q(g.image)}`);
      lines.push(`    alt: ${q(g.alt)}`);
      if (g.caption) lines.push(`    caption: ${q(g.caption)}`);
    });
  }

  const body = storyToMarkdown(r.story);
  writeFileSync(path, `---\n${lines.join('\n')}\n---\n\n${body}\n`);

  console.log(
    `  ${slug.slice(0, 44).padEnd(46)} gallery=${gallery.length} story=${body.split(/\s+/).length}w`
  );
}

if (missingImages.length) {
  console.log(`\n${missingImages.length} images could not be downloaded:`);
  missingImages.forEach((m) => console.log('   ' + m));
}
