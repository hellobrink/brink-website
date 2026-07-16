#!/usr/bin/env node
// Parity audit: structurally compares each live hellobrink.co page with its
// equivalent on the deployed beta, and writes a per-page checklist to
// reports/parity/. It diffs *structure* (headings, images), not pixels —
// it's a punch-list generator, not a substitute for the side-by-side
// screenshot check in CLAUDE.md.
//
// Run with: npm run audit

import * as cheerio from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LIVE = 'https://www.hellobrink.co';
const BETA = 'https://hellobrink.github.io/brink-website';
const OUT_DIR = path.resolve(import.meta.dirname, '../reports/parity');

// live path → beta path. `note` explains intentional differences so the
// checklist doesn't demand a layout copy where the brief restructured it.
const PAGES = [
  { live: '/', beta: '/', name: 'home' },
  { live: '/about', beta: '/about', name: 'about' },
  { live: '/team', beta: '/team', name: 'team' },
  { live: '/foundation', beta: '/foundation', name: 'foundation' },
  { live: '/careers', beta: '/careers', name: 'careers' },
  { live: '/privacy-policy', beta: '/privacy-policy', name: 'privacy-policy' },
  {
    live: '/our-offers',
    beta: '/offers',
    name: 'offers',
    note: 'Beta intentionally splits the single live page into an index plus three detail pages (per the restructure brief). Check that all live copy exists across the four beta pages.',
    extraBeta: ['/offers/open-innovation', '/offers/carve-outs', '/offers/missions'],
  },
  {
    live: '/our-work',
    beta: '/our-work',
    name: 'our-work',
    note: 'Beta intentionally merges Our Work + Case Studies into one filterable index (brief Decision 1). Check content coverage, not layout.',
  },
  {
    live: '/case-studies',
    beta: '/our-work',
    name: 'case-studies-index',
    note: 'Live case-studies index is merged into /our-work on the beta (brief Decision 1). Every case study listed live must appear on the beta index.',
  },
  {
    live: '/health',
    beta: '/sectors/health',
    name: 'sector-health',
    note: 'Sector template intentionally restructured per brief section 4A.3. Check all live content (stats, principles, case-study links, behavioural panel copy) is present, not layout order.',
  },
  {
    live: '/climate',
    beta: '/sectors/climate',
    name: 'sector-climate',
    note: 'Sector template intentionally restructured per brief section 4A.3. Check content coverage, not layout order.',
  },
  {
    live: '/education',
    beta: '/sectors/education',
    name: 'sector-education',
    note: 'Sector template intentionally restructured per brief section 4A.3. Check content coverage, not layout order.',
  },
];

// Case-study detail pages get discovered from the live index and appended.

function collapse(str = '') {
  return str.replace(/[­​‌‍﻿]/g, '').replace(/\s+/g, ' ').trim();
}

function norm(str) {
  return collapse(str).toLowerCase().replace(/[^\w\s]/g, '');
}

// Strip the Webflow asset-hash prefix ("66cc9ae3...15415_brink_logo.webp"
// → "brink_logo.webp") so live and scraped filenames compare cleanly.
function imageKey(src = '') {
  const base = decodeURIComponent(src.split('?')[0].split('/').pop() || '');
  return base
    .replace(/^[0-9a-f]{20,}_/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-');
}

async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const $ = cheerio.load(await res.text());
  $('script, style, noscript').remove();
  // Site chrome — present on every page, not part of page content. Scoped
  // to the site header/footer specifically: a bare `header` selector would
  // also strip in-page <header> elements (the sector template wraps its
  // hero, h1 included, in one).
  $('.site-header, .site-footer, .navbar, .footer, nav, [class*="w-nav"], [class*="cookie"], [id*="cookie"]').remove();
  return $;
}

function extract($) {
  const headings = [];
  $('h1, h2, h3').each((_, el) => {
    const text = collapse($(el).text());
    if (text) headings.push({ tag: el.tagName, text });
  });
  const images = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!src || src.includes('placeholder') || src.startsWith('data:')) return;
    images.push({ key: imageKey(src), src, alt: collapse($(el).attr('alt') || '') });
  });
  const bodyText = norm($('body').text());
  return { headings, images, bodyText };
}

function comparePage(live, betaPages) {
  const betaHeadingNorms = betaPages.flatMap((b) => b.headings.map((h) => norm(h.text)));
  const betaImageKeys = new Set(betaPages.flatMap((b) => b.images.map((i) => i.key)));
  const betaText = betaPages.map((b) => b.bodyText).join(' ');

  const missingHeadings = [];
  const demotedHeadings = [];
  for (const h of live.headings) {
    const n = norm(h.text);
    if (!n) continue;
    if (betaHeadingNorms.some((bh) => bh === n || bh.includes(n) || n.includes(bh))) continue;
    if (betaText.includes(n)) demotedHeadings.push(h);
    else missingHeadings.push(h);
  }

  const missingImages = [];
  for (const img of live.images) {
    if (betaImageKeys.has(img.key)) continue;
    // fuzzy: any beta key sharing a long-enough stem
    const stem = img.key.replace(/\.[a-z0-9]+$/, '');
    const fuzzy = [...betaImageKeys].some(
      (k) => stem.length > 6 && k.includes(stem.slice(0, Math.min(stem.length, 18)))
    );
    if (!fuzzy) missingImages.push(img);
  }

  return { missingHeadings, demotedHeadings, missingImages };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Discover case-study detail pages from the live index.
  const $index = await fetchPage(`${LIVE}/case-studies`);
  const csSlugs = new Set();
  if ($index) {
    $index('a[href*="/case-studies/"]').each((_, a) => {
      const m = $index(a).attr('href')?.match(/\/case-studies\/([^/?#]+)/);
      if (m) csSlugs.add(m[1]);
    });
  }
  for (const slug of csSlugs) {
    PAGES.push({
      live: `/case-studies/${slug}`,
      beta: `/our-work/${slug}`,
      name: `case-study-${slug}`,
      group: 'case-studies',
    });
  }

  const summary = [];
  for (const page of PAGES) {
    const liveDoc = await fetchPage(`${LIVE}${page.live}`);
    if (!liveDoc) {
      summary.push({ page, error: `live page ${page.live} failed to fetch` });
      console.log(`ERROR ${page.name} — live fetch failed`);
      continue;
    }
    const betaUrls = [page.beta, ...(page.extraBeta ?? [])];
    const betaDocs = [];
    for (const b of betaUrls) {
      const doc = await fetchPage(`${BETA}${b}`);
      if (doc) betaDocs.push(extract(doc));
    }
    if (betaDocs.length === 0) {
      summary.push({ page, error: `beta page ${page.beta} failed to fetch` });
      console.log(`ERROR ${page.name} — beta fetch failed (${page.beta})`);
      continue;
    }

    const liveData = extract(liveDoc);
    const diff = comparePage(liveData, betaDocs);
    const clean = diff.missingHeadings.length === 0 && diff.missingImages.length === 0;
    summary.push({
      page,
      diff,
      clean,
      liveCounts: { headings: liveData.headings.length, images: liveData.images.length },
    });

    const lines = [
      `# Parity: ${page.name}`,
      '',
      `- Live: ${LIVE}${page.live}`,
      `- Beta: ${betaUrls.map((b) => `${BETA}${b}`).join(' , ')}`,
      page.note ? `- Note: ${page.note}` : null,
      '',
      `Live page has ${liveData.headings.length} headings and ${liveData.images.length} images.`,
      '',
    ].filter((l) => l !== null);

    if (clean && diff.demotedHeadings.length === 0) {
      lines.push('No structural gaps found. Do the side-by-side screenshot check (CLAUDE.md) before closing.');
    } else {
      if (diff.missingHeadings.length) {
        lines.push('## Missing headings (text not found anywhere on beta page)', '');
        for (const h of diff.missingHeadings) lines.push(`- [ ] ${h.tag}: "${h.text}"`);
        lines.push('');
      }
      if (diff.demotedHeadings.length) {
        lines.push('## Headings present only as body text (check hierarchy/styling)', '');
        for (const h of diff.demotedHeadings) lines.push(`- [ ] ${h.tag}: "${h.text}"`);
        lines.push('');
      }
      if (diff.missingImages.length) {
        lines.push('## Missing images', '');
        for (const img of diff.missingImages) {
          lines.push(`- [ ] \`${img.key}\`${img.alt ? ` (alt: "${img.alt}")` : ''}`);
          lines.push(`      ${img.src}`);
        }
        lines.push('');
      }
      lines.push(
        '## Acceptance',
        '',
        '- [ ] Side-by-side screenshot vs live page shows matching structure (or brief-intended structure)',
        '- [ ] `npm run build` passes',
        ''
      );
    }

    await writeFile(path.join(OUT_DIR, `${page.name}.md`), lines.join('\n') + '\n');
    console.log(
      `${clean ? '  ok ' : 'GAPS '} ${page.name}  (missing: ${diff.missingHeadings.length} headings, ${diff.missingImages.length} images)`
    );
  }

  const sumLines = ['# Parity audit summary', '', `Generated: ${new Date().toISOString()}`, ''];
  for (const s of summary) {
    if (s.error) sumLines.push(`- **${s.page.name}** — ERROR: ${s.error}`);
    else
      sumLines.push(
        `- ${s.clean ? '✅' : '🔴'} **${s.page.name}** — missing ${s.diff.missingHeadings.length} headings, ${s.diff.missingImages.length} images${s.diff.demotedHeadings.length ? `, ${s.diff.demotedHeadings.length} demoted headings` : ''} ([detail](./${s.page.name}.md))`
      );
  }
  await writeFile(path.join(OUT_DIR, 'summary.md'), sumLines.join('\n') + '\n');
  console.log(`\nWrote ${summary.length} reports to reports/parity/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
