#!/usr/bin/env node
// Content linter: finds Webflow migration artifacts in src/content/.
//
// The scraped content carries junk from the old Webflow site that is easy
// to miss by eye but obvious once you know the patterns — invisible
// zero-width characters that render as "explor e", sentences run together
// where Webflow had no whitespace between elements ("...idea alone.Brink
// has..."), leftover placeholder captions, and so on.
//
// Run with: npm run lint:content          (report only)
//           npm run lint:content -- --fix (auto-fix the safely fixable ones)
//
// Exit code 1 if unfixed issues remain, so CI can gate on it.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src/content');
const FIX = process.argv.includes('--fix');

// Zero-width and invisible characters Webflow's editor scatters through
// copy. These are what produce "explor e" and "Our me thods".
const INVISIBLES = /[​‌‍﻿­]/g;

const CHECKS = [
  {
    id: 'invisible-chars',
    label: 'Invisible/zero-width characters (render as stray gaps: "explor e")',
    fixable: true,
    find: (text) => {
      const hits = [];
      // Deliberately not a /g regex with .exec in a loop — a zero-length
      // match never advances lastIndex and spins forever.
      [...text].forEach((ch, i) => {
        if (/[​‌‍﻿­]/.test(ch)) {
          hits.push({ index: i, context: snippet(text, i) });
        }
      });
      return hits;
    },
    fix: (text) => text.replace(INVISIBLES, ''),
  },
  {
    id: 'run-together',
    label: 'Sentences run together with no space ("...idea alone.Brink has...")',
    // Not auto-fixed: inserting a space is usually right, but "e.g.Foo" or
    // a genuine "U.S.Government" would be mangled. Report for a human.
    fixable: false,
    find: (text) => {
      const hits = [];
      const re = /([a-z]{2})\.([A-Z][a-z]{2})/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        hits.push({ index: m.index, context: snippet(text, m.index) });
      }
      return hits;
    },
  },
  {
    id: 'placeholder-copy',
    label: 'Placeholder copy left over from Webflow (flagged in the restructure brief)',
    fixable: false,
    find: (text) => {
      const hits = [];
      const re = /(this caption needs updating|lorem ipsum)/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        hits.push({ index: m.index, context: snippet(text, m.index) });
      }
      return hits;
    },
  },
  {
    id: 'stray-bullet-marker',
    label: 'Webflow ">" pseudo-bullets that should be Markdown "-" list items',
    fixable: false,
    find: (text) => {
      const hits = [];
      const re = /(^|[^\n>])>([A-Z][a-z])/gm;
      let m;
      while ((m = re.exec(text)) !== null) {
        hits.push({ index: m.index, context: snippet(text, m.index) });
      }
      return hits;
    },
  },
  {
    id: 'empty-alt',
    label: 'Images with no alt text (accessibility; brief 4B.3 asks for real alt text)',
    fixable: false,
    find: (text) => {
      const hits = [];
      const re = /!\[\]\(/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        hits.push({ index: m.index, context: snippet(text, m.index) });
      }
      return hits;
    },
  },
];

function snippet(text, index, pad = 38) {
  return text
    .slice(Math.max(0, index - pad), index + pad)
    .replace(/\n/g, '⏎')
    .replace(INVISIBLES, '␣');
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

async function main() {
  const files = await walk(CONTENT_DIR);
  const totals = {};
  let filesFixed = 0;
  let unfixedRemain = 0;

  for (const file of files) {
    const original = await readFile(file, 'utf8');
    let text = original;
    const report = [];

    for (const check of CHECKS) {
      const hits = check.find(text);
      if (!hits.length) continue;
      totals[check.id] = (totals[check.id] ?? 0) + hits.length;
      if (FIX && check.fixable) {
        text = check.fix(text);
      } else {
        report.push({ check, hits });
        if (!check.fixable) unfixedRemain += hits.length;
      }
    }

    if (FIX && text !== original) {
      await writeFile(file, text);
      filesFixed += 1;
    }

    if (report.length) {
      console.log(`\n${path.relative(ROOT, file)}`);
      for (const { check, hits } of report) {
        console.log(`  ${check.fixable ? '[fixable]' : '[review] '} ${check.label} × ${hits.length}`);
        for (const hit of hits.slice(0, 3)) console.log(`      …${hit.context}…`);
        if (hits.length > 3) console.log(`      (+${hits.length - 3} more)`);
      }
    }
  }

  console.log('\n=== Summary ===');
  if (Object.keys(totals).length === 0) {
    console.log('No Webflow artifacts found.');
    return;
  }
  for (const [id, count] of Object.entries(totals)) {
    const check = CHECKS.find((c) => c.id === id);
    console.log(`  ${count.toString().padStart(4)} × ${id}${check.fixable ? ' (fixable)' : ''}`);
  }
  if (FIX) {
    console.log(`\nFixed the auto-fixable issues in ${filesFixed} file(s). Review \`git diff\`.`);
    if (unfixedRemain) console.log(`${unfixedRemain} issue(s) still need a human — listed above.`);
  } else {
    console.log('\nRun `npm run lint:content -- --fix` to auto-fix the [fixable] ones.');
  }
  if (unfixedRemain) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
