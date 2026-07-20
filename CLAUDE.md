# CLAUDE.md — Brink Website (Astro rebuild of hellobrink.co)

## What this is

A static rebuild of hellobrink.co (currently Webflow), built with Astro and
deployed to GitHub Pages. The repo doubles as the CMS: all content is
Markdown with frontmatter in `src/content/`, edited either directly, via
github.com, or through Claude sessions. Push to `main` → GitHub Actions
builds and deploys automatically.

- **Live beta:** https://hellobrink.github.io/brink-website/
- **Reference site (source of truth for design + content):** https://www.hellobrink.co
- **Repo:** https://github.com/hellobrink/brink-website

The project's goal and content model come from the internal "Website
restructure brief": unify Offers / Our Work / Case Studies / Sectors into
one tagged Work collection so each engagement is written once and surfaces
everywhere it belongs.

## Commands

```
npm run dev       # dev server on :4321 (pages served under /brink-website/)
npm run build     # static build to dist/ — must pass before any push
npm run scrape    # scrapes live site into .scraped/ (staging only — see below)
npm run promote   # copies .scraped/ into src/content + public/images, non-destructively
npm run audit     # parity audit: diffs live site vs deployed beta, writes reports/parity/
npm run lint:content        # finds Webflow migration artifacts in src/content/
npm run lint:content -- --fix   # auto-fixes the safely fixable ones
```

Node 20 works but warns; CI uses Node 22.

## Architecture

- `src/content/` — the content collections (see `src/content.config.ts` for schemas):
  - `work/` — the core collection. One file per engagement. `hasCaseStudy: true` + body = full case study; otherwise a light summary entry. Tagged by `sector` and `offer`.
  - `sectors/` — climate, health, education page data (structured frontmatter per the brief's revised sector template).
  - `offers/` — open-innovation, carve-outs, missions.
  - `shared/behavioural-panel.md` — single shared panel shown on every sector page.
  - `pages/` — about, team, foundation, careers, privacy-policy (plain Markdown). `home.md` exists but the homepage is hand-built in `src/pages/index.astro`.
- `src/pages/` — templates. `our-work/[slug].astro` renders both case studies and light entries.
- `src/components/` — Header (dark-teal navbar + overlay menu), Footer, CaseStudyCard, ImpactMetric, LogoStrip, BehaviouralPanel, PrinciplesTrio, NamedContactCTA, StaticPageBody.
- `scripts/scrape.mjs` — the Webflow scraper (cheerio). Writes a draft into `.scraped/` only, never directly into `src/content` or `public/images` — see "Re-running the scraper" below. TODO markers in scraped content = needs human copy.
- `scripts/promote.mjs` — copies `.scraped/` into the real tree; the only step that touches `src/content`/`public/images` on the scraper's behalf.
- `CONTENT_GUIDE.md` — plain-language editing guide for non-technical teammates.

## The base-path rule (important)

The site deploys under `/brink-website/`, so **every internal href and image
src must go through `withBase()`** from `src/lib/base.ts`. Raw `/images/...`
or `/our-work` links will 404 in production while appearing to work at the
dev server root. Markdown bodies are handled automatically by a rehype
plugin in `astro.config.mjs`. If the site later moves to a custom domain
(e.g. beta.hellobrink.co), change `base` in `astro.config.mjs` — nothing
else should need touching.

## We are NOT replicating the live site's design

Important, and a change from the original plan. The live hellobrink.co has
been added to over ~2 years by non-designers: incoherent headings and
panels between page types, broken mobile on some pages. **It is being
redesigned.** So do not spend effort replicating its layout, and never
"fix" something to match a live page's look.

What we *do* want from the live site is its **content**: every heading,
image, link and piece of copy, correctly modelled in the CMS. That's what
`npm run audit` measures and what the open issues are about.

The current design is a deliberately neutral, coherent, mobile-sane
baseline using Brink's real brand assets — a placeholder until the
redesign, not an attempt at a replica.

## Design system — change `src/styles/theme.css`, nothing else

All visual decisions live in **`src/styles/theme.css`**, in two layers:

- **Layer 1 — primitives:** raw values with descriptive names
  (`--brink-coral: #ff405f`). Never referenced outside that file.
- **Layer 2 — roles:** what a thing is *for* (`--color-accent`,
  `--text-h1`, `--space-section`, `--radius`). **Components use only these.**

The split matters: if a redesign makes the accent blue, `--brand-red: blue`
would be nonsense. Roles let you repoint one file and the site follows.

**Rules for any component you write or edit:**
- Never hardcode a colour, font size, spacing value, or radius. There are
  currently **zero** raw hex/rem/px values in component styles — keep it
  that way, or the redesign gets expensive again.
- Use the type scale (`--text-h1`, `--text-body`, `--text-stat`…), the
  space scale (`--space-1`…`--space-10` and roles like `--space-section`),
  and `--radius`, `--border-width`, `--transition`, `--measure`.
- The type scale is fluid (`clamp()`), so responsiveness is structural
  rather than bolted on with media queries.

Brink's real assets, for reference: Signifier Light 300 (licensed display
serif, self-hosted at `src/assets/fonts/signifier-light.woff2` — never
substitute another serif), Libre Franklin (body), Inconsolata (mono
labels); teal `#06333d`, coral `#ff405f`, off-white `#f0f1ef`.

Legacy aliases (`--brand-red` → `--color-accent` etc.) exist in
`global.css` so older branches keep building. Don't use them in new code.

## The brand book is the source of truth

`(START HERE) Brand book.pdf` (29pp) is Brink's official brand guide. Where
it and the old Webflow site disagree, **the book wins** — the live site was
built by non-designers over ~2 years and drifted.

**Core thought: "Innovation as if people matter."** The book's own words:
"If you remember just one thing from this brand book, this should be it."
It describes behavioural innovation, the projects, and the team culture at
once. It is the homepage hero headline — treat it as fixed, not as copy to
be A/B'd.

Purpose: *to accelerate better futures by championing behavioural
innovation.* Personality: **incisive, worldly, playful, experimental.**
Beliefs: safe spaces for truth and trial and error; making hard stuff feel
possible; always learning; the power of the collective.

**Colour.** The palette is *intentionally minimal* "to allow our diversity
of projects to be the hero." Primary: deep teal `#06333d`, electric coral
`#ff405f` (highlights), paper white `#f0f1ef`. Draft blue `#4472ec` and CC
pink `#e99cd1` are **secondary — small accents, charts and graphs only.**
Don't promote them to surfaces or body text.

The book gives WCAG AA/AAA contrast pairings and calls accessibility
"B.P.M — because people matter." Contrast is a brand value here, not just a
lint rule.

**Illustration** (answers "what goes behind a transparent PNG?"): keep to
`#06333d` with accents of `#ff405f` on the paper tone `#f0f1ef`. So a
transparent illustration sits on **paper white**, not white and not an
arbitrary tint. Represented people must be diverse. "Playful yes, cute no."

**Imagery.** Real people and real projects over stock, always; capture
spirit and agency; pick the frame that makes the story legible. Blog images
are small — keep them simple, crop closer.

**Tone of voice.** Make it shorter. Use the simpler word. Focus on what
Brink has *done* and the impact it made. Then make it shorter again.

**NO EM DASHES. Ever.** Not in copy, not as `—`, not as `&mdash;`. Rob's
standing rule. Use a colon where the second clause explains the first, a
comma where it's an aside, or just start a new sentence. This applies to
anything that renders on screen, including alt text, meta descriptions and
aria-labels. Check with `grep -rn '—\|&mdash;' src/pages src/components
src/content/sectors` before committing copy.

**The Brinkle** is the brand's signature framing device: the logo's K form
used to crop an image, with the K's stem read in negative space, pointing at
the subject. Rules: real people, frame what matters, and the subject should
be "framed not constrained" — break them out of the crop and play with
depth. **Currently unused on the site.** It's the most distinctive unused
asset Brink has.

**Accepted deviations from the book — ruled on by Rob, do not "fix" these:**
- **Inconsolata, not Roboto Mono.** The book specifies Roboto Mono
  notationally; Brink has shipped Inconsolata for two years and it stays.
  Keep `--font-mono: var(--font-inconsolata)`.
- **`--brink-grey: #789096` stays** as `--color-text-muted`, despite not
  being in the book's palette. It came from the Webflow stylesheet and is
  used throughout.

Both are conscious exceptions, not oversights. Don't open PRs to align them.

**Not yet, but wanted eventually:** the Brinkle. Deferred until structure
and content are finished — revisit as a later design pass.

**Open accessibility issue — coral on light grounds.** Electric coral
`#ff405f` on paper white `#f0f1ef` measures **3.01:1**. That passes for
large text but **fails WCAG AA (4.5:1) for anything under ~18.66px** — which
is exactly how it's mostly used: mono kickers, "read more" links, card meta,
author bylines. There are ~20 `color: var(--color-accent)` declarations in
`src/`; the ones on teal grounds (header, footer) are fine, the ones on
white or paper are not. `IllustratedGrid` already avoids it (teal label,
coral on hover). The rest is unresolved and needs a site-wide decision —
darken the coral for text use, only use it above a size threshold, or accept
large-text-only. Flagged to Rob, not yet ruled on.

Measured contrast for reference: white on coral 3.41, white on draft blue
4.32, teal on coral 3.97, teal on paper white ~13, white on teal 13.56.
**No coloured ground carries small text at AA** — put copy on paper white.

Still unused from the book's own website mockup (p23): the blog is called
**"Latest (re)thinking"** there, and it shows a hashtag filter system
(`#Health #Education #Funding #Inclusion #Culture`) plus an "I'M IN." CTA.

## The panel toolkit — build pages by assembly

The About page (`src/pages/about.astro`) is the reference implementation.
Pages are composed from these blocks rather than designed from scratch; add
to this set rather than writing one-off section CSS.

| Component | Use for |
|---|---|
| `IllustratedGrid` | 3-up illustrated cards. Chosen over a carousel wherever all options must stay visible (e.g. the offers — they're the commercial proposition). |
| `PanelCarousel` | Full-bleed photo slides. Scopes queries to its own root, so a page can hold several. |
| `VennDiagram` | The behavioural-innovation Venn, as SVG. Inherits stroke from `currentColor`. |
| `LogoGrid` | "Our impact" — third-party logomarks with read-mores. |
| `PeopleStrip` | Team preview, pulled live from the `team` collection. |
| `ExploreCTA` / `NamedContactCTA` | Closing calls to action. |

**Page rhythm — two hard rules:**

1. **Never put a dark (teal) module directly against a full-bleed image
   module.** Both are heavy and dark-toned, so they merge into one slab with
   no edge between them. A white or paper module must break them up. On
   About this is why "Our impact" sits between the Behavioural Innovation
   panel and the sector carousel rather than after it.
2. **Never repeat the same background on adjacent modules** — white on white
   reads as one long section with a stray heading in the middle.

Alternate photographic blocks with white/paper ones throughout. The current
About order, which satisfies both: photo hero -> white offers -> teal BI ->
paper impact -> photo carousel -> paper team -> white CTA.

A section heading for a carousel belongs **inside** the carousel, over the
photography (`PanelCarousel`'s `heading` prop), not in a band above it. In
its own band it reads as an orphaned line floating over unrelated pictures,
whichever colour that band is.

**Two rules learned the hard way, both in these components' comments:**
- **Never use a percentage height to fit an image inside a fixed box.** A
  percentage height *or* max-height on a child resolves against the parent's
  height, but the child also participates in the parent's alignment — the
  dependency is cyclic, so browsers quietly resolve it to `auto`. The image
  then falls back to its intrinsic ratio and gets sliced by `overflow:
  hidden`. `max-height: 100%`, `aspect-ratio`, and `place-items: stretch`
  were all tried on `LogoGrid` and all failed for this one reason. Bound the
  image with an absolute `calc()` derived from the same tokens as the box.
- Never rely on `scrollTo({behavior: 'smooth'})` for carousel movement — it's
  a silent no-op on scroll-snap containers in some engines. Tween with rAF.

**Illustration grounds are assigned per image, never rotated by index.** Some
artwork has a colour baked in (the cranes are on coral) and will visibly
clash against the wrong ground.

**Measure loaded images, not placeholders.** `loading="lazy"` images that
haven't entered the viewport report `naturalWidth === 0`, and
`getBoundingClientRect()` then returns the CSS box rather than the laid-out
image. A fit/overflow check against those is vacuous and will report success
on genuinely broken layout — this happened on `LogoGrid` and shipped a
visible bug. Set `loading = 'eager'` and await every image's `onload` before
measuring, and assert `naturalWidth > 0` as part of the check.

**Dev-server staleness:** Vite has repeatedly served stale component CSS in
this project after edits, which looks exactly like a broken fix. If a style
change appears not to apply, restart the dev server before debugging it —
or check `dist/` after `npm run build`, which is always accurate.

## Verification standard

A change is done when the **content** is right and the build passes — not
when it matches the live site's appearance (see above; we're not
replicating it).

For content completeness, `npm run audit` diffs the live site against the
deployed beta for headings and images. Note it checks the **deployed**
site, so it can't verify unmerged work — verify those in the browser.

Practical notes for browser verification in Claude Code:
- The browser pane screenshots reliably only at scroll position 0. To
  capture a full page: inject `.hero { min-height: 420px !important }` if
  needed, resize the viewport to the document height, screenshot once.
- The live site has scroll-triggered animations; force visibility with
  `* { opacity: 1 !important; transform: none !important }` before
  screenshotting it.
- `npm run audit` produces structural diffs in `reports/parity/` — use it
  before and after fixing a page.

## Deploy

Push to `main` → `.github/workflows/deploy.yml` builds and publishes.
Check with `gh run list --repo hellobrink/brink-website --limit 1` or
`gh run watch <id> --repo hellobrink/brink-website`. Deploys take ~60–90s.
If a build fails, the live site keeps the previous version.

## CMS operations

See `CONTENT_GUIDE.md` for frontmatter templates. Short version:
- **New work item / case study:** add `src/content/work/<slug>.md`. Images go in `public/images/`, referenced as `/images/<file>` (rehype adds the base).
- **Edit a sector:** `src/content/sectors/<name>.md` — structured frontmatter (stats, whatWeDo, principles, namedContact).
- **Schema changes:** `src/content.config.ts`. The build fails loudly on frontmatter that doesn't match — that's intentional; it stops broken content going live.

## Re-running the scraper (non-destructive by design)

`npm run scrape` only ever writes to `.scraped/` (gitignored, wiped and
regenerated fresh on every run — it's disposable). It never touches
`src/content/` or `public/images/` directly, so it's safe to re-run any time
to see what's changed on the live site.

Getting scraped content into the real tree is a separate, explicit step:

```
npm run scrape     # writes a fresh draft to .scraped/
npm run promote    # copies .scraped/ into src/content/ and public/images/
```

`npm run promote` copies files that are new, and **skips any file that
already exists and differs from the scraped version** — it never silently
overwrites hand-added images (e.g. `brink-logo-white.webp`,
`hero-cranes-on-red.png`, the `brink-logotype-*` files) or hand-edited
content (e.g. sector copy once the `TODO`s are written). Conflicts are
printed so you can merge them by hand, or re-run with `npm run promote --
--force` to overwrite deliberately. Always check `git diff` after promoting,
before committing.

## Webflow migration artifacts (watch for these — there are many)

The content was scraped from Webflow and carries junk that is easy to miss
by eye. **Run `npm run lint:content` after any change that touches
`src/content/`**, and treat these as bugs to fix in passing whenever you're
already working in a file — don't leave them for someone else:

- **Invisible/zero-width characters** (U+200B/C/D, U+FEFF, U+00AD). Webflow's
  editor scatters these through copy. They render as a stray gap mid-word —
  "explor e how we can work together", "Our me thods", "Working a longside" —
  and they hide inside frontmatter too (`funders: [FCDO‍]`). Auto-fixable.
- **Run-together sentences.** Webflow's markup has no whitespace between
  block elements, so a naive text extraction yields "...single idea
  alone.Brink has proven approaches...". The scraper walks the DOM tree to
  avoid this (see `extractTextBlocks`), but some slip through. Needs a human:
  a blind space-insert would break "e.g.Foo".
- **Missing alt text.** ~93 scraped images have `![](...)`. Brief 4B.3 asks
  for real alt text throughout.
- **Placeholder copy.** The brief flags "This caption needs updating" strings
  and stale lines (e.g. the Oxygen CoLab 2024 reference).
- **`>` pseudo-bullets** where Webflow faked a list; should be Markdown `-`.

The linter runs in CI (`deploy.yml`) as advisory-only — a known backlog
exists, so it reports but never blocks a deploy.

## Known state / gaps

- Sector pages carry `TODO` placeholder copy (positioning line, whatWeDo,
  stat labels, named contacts) — editorial work per the brief, not agent work.
- Blog is not migrated; homepage blog/newsletter cards link to the live
  Webflow blog.
- Futures (sector-or-offer question) deferred; nav restructure deferred.
- `reports/parity/` holds the current page-by-page parity punch list.
- Git identity/credentials: repo-local credential helper uses the active
  `gh` account, which must be `hellobrink` (check `gh auth status`).
