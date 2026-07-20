// One-off migration: turn the live case-study pages into structured
// frontmatter plus a long-form Markdown body.
//
// Every live case study follows the same shape:
//
//   H1 title
//   standfirst paragraph
//   "The Challenge"        -> prose
//   "WHAT WAS ACHIEVED"    -> bullets
//   pull quote (sometimes)
//   "HOW WE DID IT"        -> prose + bullets
//   "The story in more detail" -> the long narrative, with its own H2s
//
// The first four go into frontmatter so the template can style them (results
// as a list, the quote as a pull quote). The narrative stays Markdown,
// because it is genuinely long-form prose and varies from 0 to 1,500 words.
import { load } from 'cheerio';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = '/tmp/cs';
const OUT = 'src/content/work';

const ZW = /[​-‏⁠﻿]/g;

/** Site furniture that appears on every page and is never story content. */
const CHROME = /brink[_-]?logo|b-corp|favicon|linkedin|close|sticker|quote_(start|end)|placeholder/i;
const tidy = (s) => (s ?? '').replace(ZW, '').replace(/\s+/g, ' ').trim();

/** Section headings we split on, normalised. */
const isHead = (t, ...names) => {
  const n = tidy(t).toLowerCase().replace(/[^a-z ]/g, '');
  return names.some((x) => n === x || n.startsWith(x));
};

function inlineMarkdown($, el) {
  // Keep links and bold; everything else becomes text.
  const $el = $(el).clone();
  $el.find('a').each((_, a) => {
    const href = $(a).attr('href');
    const text = tidy($(a).text());
    if (text) $(a).replaceWith(href ? `[${text}](${href})` : text);
  });
  $el.find('strong, b').each((_, b) => {
    const text = tidy($(b).text());
    $(b).replaceWith(text ? `**${text}**` : '');
  });
  $el.find('em, i').each((_, i) => {
    const text = tidy($(i).text());
    $(i).replaceWith(text ? `*${text}*` : '');
  });
  return tidy($el.text());
}

function extract(file) {
  const html = readFileSync(join(SRC, file), 'utf8');
  const $ = load(html);
  $('script, style, nav, footer, header').remove();

  // Walk every block element in document order, tagging which section it is in.
  const blocks = [];
  $('h1, h2, h3, h4, p, li, blockquote, img, figure').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') {
      const src = $(el).attr('src') || '';
      if (src.includes('website-files') && !src.includes('-p-') && !src.endsWith('.svg')) {
        blocks.push({ tag, src: src.split('/').pop(), alt: tidy($(el).attr('alt')) });
      }
      return;
    }
    const text = inlineMarkdown($, el);
    if (text) blocks.push({ tag, text });
  });

  const out = {
    title: '', standfirst: '', challenge: [], results: [], approach: [],
    approachIntro: [], quote: null, story: [], images: [],
  };

  let section = 'intro';
  let seenTitle = false;
  const seen = new Set();

  for (const b of blocks) {
    if (b.tag === 'img') {
      // Only images that sit inside the story sections. Taking the first N in
      // document order gave every case study the same four pictures: the logo
      // watermark, the b-corp badge and other page furniture that appears
      // before any content.
      if (section === 'intro') continue;
      if (CHROME.test(b.src)) continue;
      if (!seen.has(b.src)) { seen.add(b.src); out.images.push({ ...b, section }); }
      continue;
    }
    if (seen.has(b.tag + b.text)) continue;
    seen.add(b.tag + b.text);

    if (/^h[1-4]$/.test(b.tag)) {
      // Once inside the long-form narrative, never switch section again.
      // Several pages reuse the structural headings as subheadings inside
      // the story ("What was achieved", "How it delivered impact"), which
      // flipped the parser back and dragged narrative into the results list.
      if (section === 'story') { out.story.push({ tag: b.tag, text: b.text }); continue; }
      if (isHead(b.text, 'the challenge')) { section = 'challenge'; continue; }
      if (isHead(b.text, 'what was achieved')) { section = 'results'; continue; }
      if (isHead(b.text, 'how we did it')) { section = 'approach'; continue; }
      if (isHead(b.text, 'the story in more detail')) { section = 'story'; continue; }
      if (!seenTitle && b.tag === 'h1') { out.title = b.text; seenTitle = true; continue; }
      if (section === 'story') { out.story.push({ tag: b.tag, text: b.text }); continue; }
      continue;
    }

    if (section === 'intro') {
      if (!out.standfirst && b.tag === 'p') out.standfirst = b.text;
      continue;
    }
    if (section === 'challenge') {
      // Photo captions sit in this block on several pages; they read as
      // "Left: ... Right: ..." and are not part of the narrative.
      if (/^(left|right|above|below)\s*:/i.test(b.text)) continue;
      if (b.tag === 'p') out.challenge.push(b.text);
      continue;
    }
    if (section === 'results') {
      if (b.tag === 'blockquote' || /^["“]/.test(b.text)) {
        out.quote = { text: b.text.replace(/^["“]|["”]$/g, '') };
      } else if (out.quote && !out.quote.name && b.text.length < 80
                 && !/^(a |the |members|photo)/i.test(b.text)) {
        // Attribution follows the quote, but so do photo captions. A short
        // line that doesn't read like a caption is the speaker.
        out.quote.name = b.text;
      } else if (b.tag === 'li') {
        out.results.push(b.text);
      } else if (b.tag === 'p') {
        // Longer case studies write the achievement as prose rather than a
        // bullet list. Both shapes end up in the same field.
        out.results.push(b.text);
      }
      continue;
    }
    if (section === 'approach') {
      if (/^(left|right|above|below)\s*:/i.test(b.text)) continue;
      if (b.tag === 'li') { out.approach.push(b.text); continue; }
      if (b.tag !== 'p') continue;
      // "A concentrator built to last: Convened our pool of experts..." is an
      // approach item with a label, not an intro paragraph. Distinguished by
      // a short leading clause before the colon.
      // Strip any bold the source already applied, or the label ends up
      // double-emphasised: "**Label.** **rest of the sentence**".
      const plain = b.text.replace(/\*\*/g, '');
      const m = plain.match(/^([^:]{3,70}?):\s*(.+)$/);
      if (m && out.approachIntro.length > 0) {
        out.approach.push(`**${m[1].trim()}.** ${m[2].trim()}`);
      } else {
        out.approachIntro.push(b.text);
      }
      continue;
    }
    if (section === 'story') {
      if (/^(left|right|above|below)\s*:/i.test(b.text)) continue;
      out.story.push({ tag: b.tag, text: b.text });
    }
  }

  // The last approach paragraph is usually a closing statement, not a lead-in.
  if (out.approach.length > 0 && out.approachIntro.length > 1) {
    out.conclusion = out.approachIntro.pop();
  }
  return out;
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.html'));
const results = {};
for (const f of files) {
  const slug = f.replace(/\.html$/, '');
  try {
    results[slug] = extract(f);
  } catch (e) {
    console.error(`  FAILED ${slug}: ${e.message}`);
  }
}
// Any image that turns up on more than one case study is a shared module
// (a related-work rail, a stray portrait), not this story's photography.
// Filename filters can't catch these: the offending file was a legitimate
// project photo, just one that appears on seven pages.
const seenOn = new Map();
for (const r of Object.values(results)) {
  for (const img of r.images) seenOn.set(img.src, (seenOn.get(img.src) ?? 0) + 1);
}
const shared = [...seenOn.entries()].filter(([, n]) => n > 1).map(([src]) => src);
for (const r of Object.values(results)) {
  r.images = r.images.filter((img) => seenOn.get(img.src) === 1);
}
if (shared.length) {
  console.log(`dropped ${shared.length} image(s) appearing on multiple pages:`);
  shared.forEach((s) => console.log('   ' + s.slice(0, 62)));
  console.log('');
}

writeFileSync('/tmp/cs-extracted.json', JSON.stringify(results, null, 1));

for (const [slug, r] of Object.entries(results)) {
  const storyWords = r.story.reduce((n, s) => n + s.text.split(' ').length, 0);
  console.log(
    `${slug.slice(0, 46).padEnd(48)} ` +
    `chal=${String(r.challenge.length).padStart(2)} ` +
    `res=${String(r.results.length).padStart(2)} ` +
    `appr=${String(r.approach.length).padStart(2)} ` +
    `quote=${r.quote ? 'Y' : 'n'} ` +
    `story=${String(storyWords).padStart(4)}w ` +
    `imgs=${r.images.length}`
  );
}
