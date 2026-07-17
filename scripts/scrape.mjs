#!/usr/bin/env node
// Scraper: pulls text and images from the live hellobrink.co (Webflow)
// site and writes first-pass content files into a disposable `.scraped/`
// staging directory — never directly into src/content or public/images.
//
// This produces a DRAFT. Anything the brief says needs actual writing
// (sector positioning lines, "what we do" blocks, varied impact metrics)
// is written as an explicit TODO placeholder rather than guessed at —
// see CONTENT_GUIDE.md for what still needs a human pass.
//
// `.scraped/` is wiped and regenerated on every run — that's fine, it's
// gitignored and disposable. Promoting its contents into the real tree is a
// separate, explicit, non-destructive step: run `npm run promote` to copy
// staged files in, which skips (rather than clobbers) anything already in
// src/content or public/images that differs from the freshly scraped
// version — see scripts/promote.mjs. This is what protects hand-added
// brand assets and hand-edited content from a careless re-scrape.
//
// Run with: npm run scrape

import * as cheerio from 'cheerio';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://www.hellobrink.co';
const ROOT = path.resolve(import.meta.dirname, '..');
const STAGING_DIR = path.join(ROOT, '.scraped');
const IMG_DIR = path.join(STAGING_DIR, 'images');
const CONTENT_DIR = path.join(STAGING_DIR, 'content');

const SECTOR_NAMES = ['climate', 'health', 'education'];
const OFFER_NAMES = {
  'open innovation': 'open-innovation',
  'innovation carve-outs': 'carve-outs',
  'innovation carve outs': 'carve-outs',
  'innovation missions': 'missions',
};

const stats = { pagesFetched: 0, imagesDownloaded: 0, imagesFailed: 0 };
const imageUrlToLocal = new Map();

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// Strips Webflow's invisible characters at source. The old version missed
// U+200D (zero-width joiner) and U+FEFF, which is why "explor e how we can
// work together" survived into content and had to be cleaned afterwards by
// scripts/lint-content.mjs — reintroducing itself on every re-scrape and
// causing spurious promote conflicts. Kept in sync with INVISIBLES there.
const INVISIBLE_CHARS = /[​‌‍﻿­]/g;

function collapse(str = '') {
  return str.replace(INVISIBLE_CHARS, '').replace(/\s+/g, ' ').trim();
}

async function fetchDoc(urlPath) {
  const url = urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`;
  const res = await fetch(url);
  stats.pagesFetched += 1;
  if (!res.ok) {
    console.warn(`  ! ${res.status} fetching ${url}`);
    return null;
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  // <script>/<style>/<noscript> contents are never real page content, but
  // a childless <style> or <script> tag looks exactly like a text leaf to
  // extractTextBlocks' generic recursion — strip them everywhere, up
  // front, rather than filtering every call site individually.
  $('script, style, noscript').remove();
  // Webflow marks elements bound to an EMPTY CMS field with
  // `w-dyn-bind-empty` and hides them via CSS. They are invisible to a
  // visitor but look like real content to a scraper — and they carry stale
  // placeholder values (one such <img> was the same 2025 screenshot on
  // every case study). `w-condition-invisible` is the same idea for
  // conditionally hidden elements. Neither is ever real content.
  $('.w-dyn-bind-empty, .w-condition-invisible').remove();
  return $;
}

async function downloadImage(srcUrl) {
  if (!srcUrl || srcUrl.includes('placeholder')) return undefined;
  if (imageUrlToLocal.has(srcUrl)) return imageUrlToLocal.get(srcUrl);
  try {
    const clean = srcUrl.split('?')[0];
    const ext = path.extname(clean) || '.jpg';
    const base = slugify(decodeURIComponent(path.basename(clean, ext))) || 'image';
    let filename = `${base}${ext}`;
    let counter = 1;
    while (existsSync(path.join(IMG_DIR, filename))) {
      filename = `${base}-${counter}${ext}`;
      counter += 1;
    }
    const res = await fetch(srcUrl);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(IMG_DIR, filename), buf);
    const localPath = `/images/${filename}`;
    imageUrlToLocal.set(srcUrl, localPath);
    stats.imagesDownloaded += 1;
    return localPath;
  } catch (err) {
    console.warn(`  ! image failed: ${srcUrl} (${err.message})`);
    stats.imagesFailed += 1;
    return undefined;
  }
}

// Recursively breaks an element into paragraph-level blocks.
//
// Webflow's blog/case-study rich text uses real <p>/<h2>/<ul> tags, but its
// marketing pages (home, about, sectors...) build text out of nested
// <div> "text block" wrappers with no whitespace between them in the
// minified HTML. A flat `.text()` call on those runs every block together
// ("We are BrinkWe are a global team..."). Walking the tree and treating
// any childless element with text as its own paragraph fixes that without
// needing bespoke selectors per page.
// Renders a block's contents as Markdown, preserving inline markup.
//
// A plain `.text()` call silently discards every link, bold and italic —
// the whole site's body content came through with ZERO links because of
// that. Walk the child nodes instead and emit Markdown for the inline
// elements we care about.
function inlineMarkdown($, el) {
  let out = '';
  for (const node of $(el).contents().toArray()) {
    if (node.type === 'text') {
      out += node.data ?? '';
      continue;
    }
    if (node.type !== 'tag') continue;
    const $n = $(node);
    const tag = node.tagName?.toLowerCase();
    const inner = inlineMarkdown($, node);
    // Strip invisibles before the emptiness test: a <strong> holding only a
    // zero-width joiner is not "empty" to .trim() (it isn't whitespace), so
    // it emitted `**<ZWJ>**`, which collapse() then reduced to a bare
    // `****` — and YAML reads a leading `*` as an alias reference, breaking
    // the build.
    if (!inner.replace(INVISIBLE_CHARS, '').trim() && tag !== 'br') continue;

    if (tag === 'a') {
      const href = $n.attr('href');
      // Anchors without a real destination are just styling hooks.
      out += href && !href.startsWith('#') ? `[${inner.trim()}](${href})` : inner;
    } else if (tag === 'strong' || tag === 'b') {
      out += `**${inner.trim()}**`;
    } else if (tag === 'em' || tag === 'i') {
      out += `*${inner.trim()}*`;
    } else if (tag === 'br') {
      out += ' ';
    } else {
      out += inner;
    }
  }
  return out;
}

// Same, then collapsed to a single tidy line.
function inlineText($, el) {
  return collapse(inlineMarkdown($, el));
}

// Removes Markdown emphasis/link syntax, for comparing extracted text
// against a plain string.
function stripMarkdown(str = '') {
  return str
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*?/g, '')
    .trim();
}

function extractTextBlocks($, el, blocks = []) {
  const $el = $(el);
  const tag = el.tagName?.toLowerCase();
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    const text = inlineText($, el);
    if (text) blocks.push({ type: 'heading', text });
    return blocks;
  }
  if (tag === 'p') {
    const text = inlineText($, el);
    if (text) blocks.push({ type: 'paragraph', text });
    const img = $el.find('img').first();
    if (img.length) blocks.push({ type: 'image', src: img.attr('src'), alt: img.attr('alt') });
    return blocks;
  }
  if (tag === 'img') {
    blocks.push({ type: 'image', src: $el.attr('src'), alt: $el.attr('alt') });
    return blocks;
  }
  if (tag === 'ul' || tag === 'ol') {
    const items = $el
      .find('li')
      .map((_, li) => inlineText($, li))
      .get()
      .filter(Boolean);
    if (items.length) blocks.push({ type: 'list', items });
    return blocks;
  }
  if (tag === 'blockquote') {
    const text = inlineText($, el);
    if (text) blocks.push({ type: 'quote', text });
    return blocks;
  }
  const children = $el.children().toArray();
  if (children.length === 0) {
    const text = inlineText($, el);
    if (text) blocks.push({ type: 'paragraph', text });
    return blocks;
  }
  // A wrapper whose children are all inline (a <div> containing text plus
  // an <a>, say) must be read as ONE block — recursing into it would split
  // the sentence across paragraphs and strand the link on its own line.
  const INLINE = new Set(['a', 'strong', 'b', 'em', 'i', 'span', 'br', 'sup', 'sub', 'u', 'small']);
  if (children.every((c) => INLINE.has(c.tagName?.toLowerCase()))) {
    const text = inlineText($, el);
    if (text) blocks.push({ type: 'paragraph', text });
    return blocks;
  }
  for (const child of children) extractTextBlocks($, child, blocks);
  return blocks;
}

// Webflow fakes bullet lists with a literal ">" character and styling
// rather than real <ul>/<li> markup (confirmed: zero <ul> elements inside
// the Open Innovation block, despite the page clearly rendering bullets).
// Turn runs of those into a real Markdown list.
// Comes in two shapes: the ">" glued to its text in one element, or — more
// often — the marker sitting in its own element as a sibling of the text it
// belongs to. Handle both.
function normaliseWebflowBullets(blocks) {
  const out = [];
  const pushItem = (item) => {
    const prev = out[out.length - 1];
    if (prev?.type === 'list') prev.items.push(item);
    else out.push({ type: 'list', items: [item] });
  };

  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    if (b.type !== 'paragraph') {
      out.push(b);
      continue;
    }
    // Bare ">" marker: the following block is its list item.
    if (/^>\s*$/.test(b.text)) {
      const next = blocks[i + 1];
      if (next?.type === 'paragraph' && next.text.trim()) {
        pushItem(next.text.trim());
        i += 1; // consume it
      }
      continue; // never emit a lone ">" — Markdown reads it as a blockquote
    }
    // ">" glued to its text.
    if (/^>\s*\S/.test(b.text)) {
      pushItem(b.text.replace(/^>\s*/, ''));
      continue;
    }
    out.push(b);
  }
  return out;
}

async function blocksToMarkdown(blocks) {
  const lines = [];
  for (const b of blocks) {
    if (b.type === 'heading') lines.push(`## ${b.text}`);
    else if (b.type === 'paragraph') lines.push(b.text);
    else if (b.type === 'quote') lines.push(`> ${b.text}`);
    else if (b.type === 'list') lines.push(b.items.map((i) => `- ${i}`).join('\n'));
    else if (b.type === 'image') {
      const local = await downloadImage(b.src);
      if (local) lines.push(`![${collapse(b.alt || '')}](${local})`);
    }
  }
  return lines.filter(Boolean).join('\n\n');
}

// Converts a Webflow content block into rough Markdown: headings,
// paragraphs, lists and images, in document order. Good enough for a
// first-pass draft — see the CONTENT_GUIDE note on editorial review.
async function richTextToMarkdown($, el) {
  const blocks = [];
  for (const child of $(el).children().toArray()) extractTextBlocks($, child, blocks);
  return blocksToMarkdown(normaliseWebflowBullets(blocks));
}

// Same tree-walk, but returns short plain text (blocks joined with a
// space) — for frontmatter summary fields rather than a Markdown body.
function extractPlainText($, el, maxLen = 400) {
  const blocks = [];
  extractTextBlocks($, el, blocks);
  const text = blocks
    .map((b) => (b.type === 'list' ? b.items.join('. ') : b.text))
    .filter(Boolean)
    .join(' ');
  return text.slice(0, maxLen);
}

function frontmatter(obj) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      if (typeof value[0] === 'object') {
        lines.push(`${key}:`);
        for (const item of value) {
          const entries = Object.entries(item).filter(([, v]) => v !== undefined && v !== '');
          lines.push(`  - ${entries.map(([k, v]) => `${k}: ${yamlScalar(v)}`).join('\n    ')}`);
        }
      } else {
        lines.push(`${key}: [${value.map(yamlScalar).join(', ')}]`);
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) {
        if (v === undefined || v === '') continue;
        lines.push(`  ${k}: ${yamlScalar(v)}`);
      }
    } else {
      lines.push(`${key}: ${yamlScalar(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

const YAML_LOOKS_NUMERIC_OR_BOOL = /^(-?\d+(\.\d+)?|true|false|null|yes|no)$/i;

function yamlScalar(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const str = String(value);
  // Content schemas define several of these fields (e.g. sector stat
  // "value") as strings even though they look numeric ("50", "1.5m").
  // An unquoted "50" in YAML parses back as a number, so quote anything
  // that would otherwise round-trip as the wrong type.
  if (YAML_LOOKS_NUMERIC_OR_BOOL.test(str)) {
    return JSON.stringify(str);
  }
  // Characters YAML treats as indicators when they LEAD a scalar. `*` and
  // `&` are the dangerous ones — a summary starting with "**bold" parses as
  // an alias reference and hard-fails the build. `-`/`?` start block
  // sequences/keys; the rest are anchors, tags, directives and reserved.
  if (/^[*&!%@`>|#{}\[\],'"-?]/.test(str)) {
    return JSON.stringify(str);
  }
  // Characters that are special anywhere in the scalar.
  if (/[:#\[\]{}"'|>]/.test(str) || str.trim() !== str) {
    return JSON.stringify(str);
  }
  return str;
}

async function writeContentFile(collection, slug, fm, body = '') {
  const dir = path.join(CONTENT_DIR, collection);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${slug}.md`);
  const content = `${frontmatter(fm)}\n\n${body}\n`;
  await writeFile(file, content);
  console.log(`  wrote ${path.relative(ROOT, file)}`);
}

function classifyTags(tagTexts) {
  const sector = [];
  const offer = [];
  for (const raw of tagTexts) {
    const t = collapse(raw).toLowerCase();
    if (SECTOR_NAMES.includes(t)) sector.push(t);
    else if (OFFER_NAMES[t]) offer.push(OFFER_NAMES[t]);
  }
  return { sector, offer };
}

// --- Fuzzy title matching ---------------------------------------------

const STOPWORDS = new Set(['the', 'a', 'an', 'to', 'in', 'of', 'for', 'and', 'is', 'on', 'at']);

function titleTokens(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w && !STOPWORDS.has(w))
  );
}

function jaccard(a, b) {
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

// The recognisable name from /our-work ("ASToN", "Macmillan CoLab") to show
// alongside the case-study title it merged into — but ONLY when it's
// genuinely a different name. A plain `match.title !== title` check isn't
// enough: /our-work calls the oxygen programme "Improving THE access to
// medical oxygen..." against a case-study title of "Improving access to
// medical oxygen...", and rendering that as a kicker above the near-identical
// title is just noise. Requires the titles to be mostly disjoint.
function programmeNameFor(match, title) {
  if (!match || match.title === title) return undefined;
  const similarity = jaccard(titleTokens(match.title), titleTokens(title));
  return similarity < 0.5 ? match.title : undefined;
}

// --- Our work index (fetched first so case studies can be enriched with
// funder/partner/status info, and so near-duplicate titles — e.g. "Improving
// access to..." vs "Improving the access to..." — merge into one record
// instead of producing two. See brief Decision 1.) -------------------------

async function fetchOurWorkEntries() {
  const $ = await fetchDoc('/our-work');
  if (!$) return [];
  const entries = [];

  const parse = (el, status) => {
    const $el = $(el);
    const title = collapse($el.find('h2, h3').first().text());
    if (!title) return;
    const link = $el.find('a').first().attr('href');
    const text = extractPlainText($, el, 1000).replace(title, '');
    const funders = text.match(/Funders?:\s*([^:]+?)(?=Partners?:|Read more|$)/i)?.[1]?.trim();
    const partners = text.match(/Partners?:\s*([^:]+?)(?=Funders?:|Read more|$)/i)?.[1]?.trim();
    // Some past-programme links point straight at a case study, sometimes
    // via a legacy URL missing the /case-studies/ prefix
    // (hellobrink.co/{slug}/ instead of hellobrink.co/case-studies/{slug}).
    // That's a much more reliable match signal than title wording, so
    // capture the candidate slug for scrapeCaseStudies to check first.
    let linkSlug;
    if (link?.includes('hellobrink.co')) {
      const segments = new URL(link).pathname.split('/').filter(Boolean);
      linkSlug = segments[segments[0] === 'case-studies' ? 1 : 0];
    }
    entries.push({ title, link, text, status, funders, partners, linkSlug, tokens: titleTokens(title) });
  };

  $('.w-layout-layout.our-work-padding-light, .w-layout-layout.our-work-padding-dark').each((_, el) =>
    parse(el, 'current')
  );
  $('.green-box').each((_, el) => parse(el, 'past'));
  console.log(`Found ${entries.length} entries on /our-work (current + past).`);
  return entries;
}

function findMatch(title, slug, ourWorkEntries) {
  const bySlug = ourWorkEntries.find((entry) => entry.linkSlug === slug);
  if (bySlug) return bySlug;

  const tokens = titleTokens(title);
  let best = null;
  let bestScore = 0;
  for (const entry of ourWorkEntries) {
    const score = jaccard(tokens, entry.tokens);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

// --- Case studies ---------------------------------------------------------

async function scrapeCaseStudies(ourWorkEntries) {
  console.log('\n=== Case studies ===');
  const $index = await fetchDoc('/case-studies');
  if (!$index) return { slugs: [], titleToSlug: new Map(), matched: new Set() };
  const hrefs = new Set();
  $index('a[href*="/case-studies/"]').each((_, a) => {
    const href = $index(a).attr('href');
    const match = href?.match(/\/case-studies\/([^/?#]+)/);
    if (match) hrefs.add(match[1]);
  });
  console.log(`Found ${hrefs.size} case studies on the index.`);

  const titleToSlug = new Map();
  const matched = new Set();
  let sortOrder = 0;
  for (const slug of hrefs) {
    const $ = await fetchDoc(`/case-studies/${slug}`);
    if (!$) continue;
    const title = collapse($('.blog-heading.case-study-heading').first().text()) || slug;
    const tags = $('.tag-text').map((_, el) => collapse($(el).text())).get();
    const { sector, offer } = classifyTags(tags);
    const summaryEl = $('.blog-summary').first();
    const summary = summaryEl.length ? extractPlainText($, summaryEl.get(0), 400) : '';
    // The hero lives in section.blog-hero. Do NOT use `.image-10.casestudy`
    // — that element carries `w-dyn-bind-empty`, Webflow's marker for a CMS
    // field with no value, so it renders a leftover placeholder that is
    // identical on every case study (a stray 2025 screenshot). Selecting it
    // gave all 11 case studies the same wrong image. `.w-dyn-bind-empty` is
    // stripped globally in fetchDoc, so this is belt-and-braces.
    const heroImgEl = $('section.blog-hero img').not('.w-dyn-bind-empty').first();
    const heroImage = await downloadImage(heroImgEl.attr('src'));
    const heroAlt = collapse(heroImgEl.attr('alt') || title);
    const bodyEl = $('.blog-content').first();
    const body = bodyEl.length ? await richTextToMarkdown($, bodyEl.get(0)) : '';

    // Merge in funders/partners/current-vs-past from the /our-work index
    // entry describing the same engagement, if one matches.
    const match = findMatch(title, slug, ourWorkEntries);
    if (match) matched.add(match);

    await writeContentFile('work', slug, {
      title,
      programmeName: programmeNameFor(match, title),
      summary: summary || `TODO: write a one-line summary for "${title}".`,
      heroImage,
      heroAlt,
      sector,
      offer,
      status: match?.status ?? 'past',
      funders: match?.funders ? [match.funders] : [],
      partners: match?.partners ? [match.partners] : [],
      hasCaseStudy: true,
      sortOrder: sortOrder++,
    }, body || '<!-- TODO: case study narrative did not extract cleanly, check the live page. -->');

    titleToSlug.set(title.toLowerCase(), slug);
  }
  return { slugs: [...hrefs], titleToSlug, matched };
}

// --- Our work (entries with no matching case study) ------------------------
//
// Entries already merged into a case study (in `matched`, built during
// scrapeCaseStudies via fuzzy title matching) are skipped here so the same
// engagement isn't written twice at two different depths.

async function writeUnmatchedOurWork(ourWorkEntries, matched) {
  console.log('\n=== Our work (entries with no case study) ===');
  const seen = new Set();
  let sortOrder = 1000; // keep after case studies in default sort
  let written = 0;

  for (const entry of ourWorkEntries) {
    if (matched.has(entry)) continue;
    const slug = slugify(entry.title);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const isInternalCaseStudy = entry.link?.includes('/case-studies/');
    await writeContentFile('work', slug, {
      title: entry.title,
      summary: collapse(entry.text).slice(0, 400) || `TODO: write a one-line summary for "${entry.title}".`,
      sector: [],
      offer: [],
      status: entry.status,
      funders: entry.funders ? [entry.funders] : [],
      partners: entry.partners ? [entry.partners] : [],
      hasCaseStudy: false,
      externalLink: isInternalCaseStudy ? undefined : entry.link,
      sortOrder: sortOrder++,
    }, '');
    written += 1;
  }
  console.log(`Wrote ${written} entries (${ourWorkEntries.length - written} merged into a matching case study).`);
}

// --- Offers ----------------------------------------------------------------

async function scrapeOffers() {
  console.log('\n=== Offers ===');
  const $ = await fetchDoc('/our-offers');
  if (!$) return;
  const names = ['Open Innovation', 'Innovation Carve-Outs', 'Innovation Missions'];
  for (const name of names) {
    const heading = $('h2').filter((_, el) => collapse($(el).text()) === name).first();
    if (!heading.length) {
      console.warn(`  ! could not find offer heading "${name}"`);
      continue;
    }
    const container = heading.closest('.cell-17, .w-layout-cell');
    // Use the shared tree-walk rather than a flat `.find(...).text()` — the
    // latter drops every link and bold (this page alone carries 4 links:
    // COVIDaction, the Assistive Tech Impact Fund, Hanga, AfriLabs).
    const blocks = [];
    for (const child of container.children().toArray()) extractTextBlocks($, child, blocks);

    // Compare on plain text: the offer name now arrives wrapped in Markdown
    // emphasis ("**Innovation Carve-Outs**"), so a raw `b.text !== name`
    // check no longer excludes it — and it was being picked up as the
    // tagline.
    const textual = blocks.filter((b) => b.text && stripMarkdown(b.text) !== name);
    const tagline = textual[0]?.text ?? '';

    // The sticker illustration belongs in the `image` frontmatter field, not
    // the body — the offer template renders it in the header. Leaving it in
    // the body would duplicate it at full width.
    const sticker = blocks.find((b) => b.type === 'image' && /sticker/i.test(b.src ?? ''));
    const image = sticker ? await downloadImage(sticker.src) : undefined;

    const bodyBlocks = blocks.filter(
      (b) => b !== sticker && b.text !== tagline && stripMarkdown(b.text ?? '') !== name
    );
    const body = await blocksToMarkdown(normaliseWebflowBullets(bodyBlocks));
    const slug = OFFER_NAMES[name.toLowerCase()] ?? slugify(name);
    await writeContentFile('offers', slug, { name, summary: tagline, image }, body);
  }
}

// --- Sectors -----------------------------------------------------------

async function scrapeSectors() {
  console.log('\n=== Sectors ===');
  for (const sector of SECTOR_NAMES) {
    const $ = await fetchDoc(`/${sector}`);
    if (!$) continue;
    const headline = collapse($('h2').first().text());
    const statNodes = $('h2').filter((_, el) => /^[£$0-9][0-9a-zA-Z.%+km]*$/.test(collapse($(el).text())));
    const stats = statNodes
      .map((_, el) => ({ value: collapse($(el).text()), label: 'TODO: what does this number measure?' }))
      .get()
      .slice(0, 4);
    const headings = $('h2').map((_, el) => collapse($(el).text())).get();
    // Heuristic: the long sentence-like heading after the stats is the
    // "challenge" paragraph; the 3 short headings after it are the
    // "principles" trio described in the brief.
    const challengeText = headings.find((h) => h.split(' ').length > 6 && h !== headline) || '';
    const principleCandidates = headings.filter(
      (h) => h !== headline && h !== challengeText && !/^[£$0-9]/.test(h) && h.split(' ').length <= 8
    );

    const caseStudyLinks = new Set();
    $('a[href*="/case-studies/"]').each((_, a) => {
      const m = $(a).attr('href')?.match(/\/case-studies\/([^/?#]+)/);
      if (m) caseStudyLinks.add(m[1]);
    });

    await writeContentFile('sectors', sector, {
      name: sector[0].toUpperCase() + sector.slice(1),
      headline,
      positioningLine: 'TODO: plain positioning line — "call Brink when ___". See brief section 4A.3.',
      stats,
      whatWeDo: [
        { title: 'TODO', description: 'TODO: named, concrete services for this sector (brief 4A.3).' },
      ],
      challengeText,
      principles: principleCandidates.slice(0, 3),
    }, `<!-- Related case studies found on the live page: ${[...caseStudyLinks].join(', ') || 'none found'} -->`);
  }
}

// --- Shared behavioural-innovation panel -----------------------------------

async function scrapeSharedPanel() {
  console.log('\n=== Shared behavioural-innovation panel ===');
  const $ = await fetchDoc('/climate');
  if (!$) return;
  const heading = $('h2').filter((_, el) => /behaviour/i.test($(el).text())).first();
  const title = collapse(heading.text()) || 'Behavioural innovation';
  const container = heading.closest('.w-layout-cell, section, div');
  const body = collapse(container.text()).replace(title, '').trim();
  await writeContentFile('shared', 'behavioural-panel', { title }, body);
}

// --- Static pages ------------------------------------------------------

async function scrapeStaticPages() {
  console.log('\n=== Static pages ===');
  const pages = [
    { path: '/', slug: 'home', title: 'Home' },
    { path: '/about', slug: 'about', title: 'About Brink' },
    { path: '/team', slug: 'team', title: 'Meet the team' },
    { path: '/foundation', slug: 'foundation', title: 'Brink Foundation' },
    { path: '/careers', slug: 'careers', title: 'Careers' },
    { path: '/privacy-policy', slug: 'privacy-policy', title: 'Privacy Policy' },
  ];
  for (const page of pages) {
    const $ = await fetchDoc(page.path);
    if (!$) continue;
    // Nav and footer are site chrome the Astro Layout will provide —
    // strip them so page content doesn't duplicate "Home / About Brink /
    // Our offers / ..." at the top of every scraped page.
    $('nav, .navbar, .footer, [class*="w-nav"], [class*="cookie"], [id*="cookie"]').remove();
    const main = $('main').length ? $('main') : $('body');
    const body = await richTextToMarkdown($, main.get(0));
    await writeContentFile('pages', page.slug, { title: page.title }, body);
  }
}

async function main() {
  // .scraped/ is disposable draft output, regenerated fresh every run — safe
  // to wipe, unlike the real src/content and public/images it gets promoted
  // into (see scripts/promote.mjs).
  await rm(STAGING_DIR, { recursive: true, force: true });
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(CONTENT_DIR, { recursive: true });

  const ourWorkEntries = await fetchOurWorkEntries();
  const { matched } = await scrapeCaseStudies(ourWorkEntries);
  await writeUnmatchedOurWork(ourWorkEntries, matched);
  await scrapeOffers();
  await scrapeSectors();
  await scrapeSharedPanel();
  await scrapeStaticPages();

  console.log('\n=== Done ===');
  console.log(`Pages fetched: ${stats.pagesFetched}`);
  console.log(`Images downloaded: ${stats.imagesDownloaded} (failed: ${stats.imagesFailed})`);
  console.log(`\nDraft written to ${path.relative(ROOT, STAGING_DIR)}/ — nothing in src/content or`);
  console.log('public/images has been touched yet. Review the draft, then run `npm run promote`');
  console.log('to copy it into the real tree (it will not overwrite anything that already differs).');
  console.log('\nEverything marked TODO in the generated .md files needs a human editorial pass —');
  console.log('see CONTENT_GUIDE.md.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
