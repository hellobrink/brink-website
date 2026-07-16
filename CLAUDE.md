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
npm run scrape    # one-off migration scraper (already run; re-run only deliberately)
npm run audit     # parity audit: diffs live site vs deployed beta, writes reports/parity/
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
- `scripts/scrape.mjs` — the Webflow migration scraper (cheerio). Content it produced is a draft; TODO markers = needs human copy.
- `CONTENT_GUIDE.md` — plain-language editing guide for non-technical teammates.

## The base-path rule (important)

The site deploys under `/brink-website/`, so **every internal href and image
src must go through `withBase()`** from `src/lib/base.ts`. Raw `/images/...`
or `/our-work` links will 404 in production while appearing to work at the
dev server root. Markdown bodies are handled automatically by a rehype
plugin in `astro.config.mjs`. If the site later moves to a custom domain
(e.g. beta.hellobrink.co), change `base` in `astro.config.mjs` — nothing
else should need touching.

## Design system (extracted from the live Webflow site — do not invent)

Tokens (verbatim from the live stylesheet, defined in `src/styles/global.css`):

| Variable | Value | Use |
|---|---|---|
| `--brand-green` / `--type-main` | `#06333d` | dark teal: navbar, text |
| `--brand-red` | `#ff405f` | coral: links, accents, section rules, footer border |
| `--background-muted` | `#f0f1ef` | off-white panels |
| `--background-faded` | `#dadedd` | card borders |
| `--text-muted` | `#789096` | secondary text |

Typography:
- **Signifier Light (300)** — display serif for h1/big headings. Served from `src/assets/fonts/signifier-light.woff2` (Brink's licensed font, same file the live site serves). Never substitute another serif.
- **Libre Franklin** — body (1.1rem/1.6) and bold h2/h3.
- **Inconsolata** — `.mono` uppercase labels, tags, buttons-adjacent text.

Aesthetic rules: everything is **square** (no border-radius except circular
photos), **flat** (1px borders, no drop shadows), thin coral rules between
homepage sections, 10px coral top border on the footer, white page
background. Buttons are square outlines, uppercase, letter-spaced.

## Verification standard (applies to every visual change)

A visual change is done when a **side-by-side check against the equivalent
live page** shows matching structure: same headings, same images, same
section order (unless the page is intentionally restructured per the brief
— sectors, our-work — in which case check content coverage, not layout).

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

## Known state / gaps

- Sector pages carry `TODO` placeholder copy (positioning line, whatWeDo,
  stat labels, named contacts) — editorial work per the brief, not agent work.
- Blog is not migrated; homepage blog/newsletter cards link to the live
  Webflow blog.
- Futures (sector-or-offer question) deferred; nav restructure deferred.
- `reports/parity/` holds the current page-by-page parity punch list.
- Git identity/credentials: repo-local credential helper uses the active
  `gh` account, which must be `hellobrink` (check `gh auth status`).
