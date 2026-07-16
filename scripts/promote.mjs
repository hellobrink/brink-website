#!/usr/bin/env node
// Explicit merge step for scripts/scrape.mjs's staging output.
//
// `npm run scrape` only ever writes to `.scraped/` — it never touches
// src/content or public/images directly. This script is the one place that
// copies scraped content into the real tree, and by default it never
// overwrites a file that already differs from the staged version. That's
// what protects hand-added brand assets (e.g. public/images/brink-logo-white.webp)
// and hand-edited content (e.g. sector copy once the TODOs are written) from
// being clobbered by a re-scrape.
//
// Run with: npm run promote            (copy new files, report conflicts)
//           npm run promote -- --force  (also overwrite conflicting files)

import { readdir, readFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STAGING_DIR = path.join(ROOT, '.scraped');
const TARGETS = [
  { from: path.join(STAGING_DIR, 'images'), to: path.join(ROOT, 'public/images') },
  { from: path.join(STAGING_DIR, 'content'), to: path.join(ROOT, 'src/content') },
];

const FORCE = process.argv.includes('--force');

async function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full, base)));
    else files.push(path.relative(base, full));
  }
  return files;
}

async function filesEqual(a, b) {
  const [bufA, bufB] = await Promise.all([readFile(a), readFile(b)]);
  return bufA.equals(bufB);
}

async function promote({ from, to }) {
  const files = await walk(from);
  const added = [];
  const unchanged = [];
  const conflicts = [];

  for (const rel of files) {
    const src = path.join(from, rel);
    const dest = path.join(to, rel);
    if (!existsSync(dest)) {
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(src, dest);
      added.push(rel);
    } else if (await filesEqual(src, dest)) {
      unchanged.push(rel);
    } else if (FORCE) {
      await copyFile(src, dest);
      added.push(`${rel} (overwritten)`);
    } else {
      conflicts.push(rel);
    }
  }
  return { added, unchanged, conflicts };
}

async function main() {
  if (!existsSync(STAGING_DIR)) {
    console.error('No .scraped/ directory found — run `npm run scrape` first.');
    process.exit(1);
  }

  let anyConflicts = false;
  for (const target of TARGETS) {
    const label = path.relative(ROOT, target.to);
    console.log(`\n=== ${label} ===`);
    const { added, unchanged, conflicts } = await promote(target);
    console.log(`  copied: ${added.length}, unchanged: ${unchanged.length}, skipped (conflict): ${conflicts.length}`);
    if (added.length) console.log(added.map((f) => `    + ${f}`).join('\n'));
    if (conflicts.length) {
      anyConflicts = true;
      console.log('  ! these differ from the scraped version and were left alone (hand-edited?):');
      console.log(conflicts.map((f) => `    ! ${f}`).join('\n'));
    }
  }

  if (anyConflicts) {
    console.log('\nRe-run with `npm run promote -- --force` to overwrite the conflicting files above,');
    console.log('or merge the changes by hand — they are not touched by default.');
  }
  console.log('\nDone. Review `git diff` before committing promoted content.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
