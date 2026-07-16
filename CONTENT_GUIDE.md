# Editing this site

All content lives as Markdown files in `src/content/`. Edit directly on
github.com: open the file, click the pencil icon, make your change, and
commit to `main` (or open a pull request if you want someone to check it
first). A GitHub Action rebuilds and republishes the site automatically a
minute or two after you commit.

You don't need to know Astro. You do need to be comfortable with:

- **Frontmatter**: the `---`-fenced block at the top of every file, with
  `field: value` pairs.
- **Basic Markdown**: blank lines between paragraphs, `## Heading`,
  `![alt text](/images/file.jpg)` for images, `- item` for bullet lists.

If a commit breaks the frontmatter (e.g. a missing colon, wrong indentation
under a list), the site build will fail and the live site won't update —
it won't take the broken content live. Check the "Actions" tab on GitHub if
a change doesn't appear after a few minutes.

## Re-running the scraper

The site was scraped from the old Webflow version of hellobrink.co as a
starting draft. That scraper (`npm run scrape`) can be re-run any time to
check for updates on the live site — it's non-destructive: it writes to a
disposable `.scraped/` staging folder, never straight into `src/content/` or
`public/images/`.

Getting a fresh scrape into the real site is a separate, deliberate step:
run `npm run promote` afterwards. It copies new files in but **will not
overwrite an image or content file that already differs from the scraped
version** — so hand-added logos and hand-written sector copy are safe from
a careless re-scrape. If it reports a conflict, it means that file was
edited by hand since the last scrape; merge it manually, or re-run with
`npm run promote -- --force` if you're sure you want the live site's
version instead. Either way, check `git diff` before committing.

## Known TODOs from the initial migration

Anything marked `TODO` in a file still needs a human pass — search the repo
for `TODO` to find them all. The biggest ones:

- **Sector pages** (`src/content/sectors/*.md`): `positioningLine` and
  `whatWeDo` are placeholders. The restructure brief's diagnosis was that
  the old pages "set a mood without landing what Brink offers or who
  should call" — these fields exist specifically to fix that, and need
  real writing, not scraped copy. `stats` labels also need checking (the
  numbers scraped correctly, e.g. "50", but what each one *means* didn't).
- **`namedContact`** on each sector: not scraped at all, needs a name/role
  per sector.
- **Case-study coverage**: Education has few full case studies right now.
  See the `<!-- Related case studies found on the live page -->` comment
  at the bottom of each sector file for what the old site had.
- A few `externalLink` values point at dead pages on the old site (e.g. the
  Oxfam America case study — that link 404s on live hellobrink.co too, it
  was already stale before migration).

## Adding a new piece of work (`src/content/work/`)

Copy this into a new file, e.g. `src/content/work/my-new-project.md`
(the filename becomes the URL: `/our-work/my-new-project`):

```markdown
---
title: A short, descriptive project title
summary: One or two sentences — shows on the Our Work index and search results.
heroImage: /images/your-image.jpg
heroAlt: Description of the image for screen readers
sector: [climate]
offer: [open-innovation]
status: current
funders: [Funder Name]
partners: [Partner Name]
hasCaseStudy: true
headlineResult: "£2m unlocked for 12 teams"
year: "2026"
sortOrder: 0
---

## A subheading

The full case-study narrative goes here in Markdown, if you have one.
Leave this empty and set `hasCaseStudy: false` for a lighter entry that's
just a title + summary + optional external link.
```

Field notes:
- `sector` and `offer` are lists — a project can belong to more than one
  (e.g. `sector: [climate, health]`). Valid sectors right now: `climate`,
  `health`, `education` (Futures isn't built yet — see below).
  Valid offers: `open-innovation`, `carve-outs`, `missions`.
- `status` is `current` or `past` — controls the badge/filter on the work
  index, not chronological sorting.
- `hasCaseStudy: true` shows the full Markdown body as a narrative page.
  `false` shows just the summary and (if set) a link to `externalLink`.
- To upload an image: add the file to `public/images/` in the same commit
  (GitHub's web editor lets you drag files into a folder), then reference
  it as `/images/your-file.jpg`.

## Adding a sector, offer, or editing the shared panel

- `src/content/sectors/{climate,health,education}.md` — see the field list
  at the top of this guide; `stats`, `whatWeDo`, and `principles` are all
  lists, follow the existing YAML structure in those files.
- `src/content/offers/{open-innovation,carve-outs,missions}.md` — just
  `name`, `summary`, and a Markdown body.
- `src/content/shared/behavioural-panel.md` — one file, shown identically
  on every sector page.

## What's deliberately not built yet

- **Futures** — excluded from this build (Decision 2 in the restructure
  brief was left open; add a `content/sectors/futures.md` and a `futures`
  option to the `sector` enum in `src/content.config.ts` once that's
  resolved).
- **Nav redesign** — the top nav keeps roughly today's structure (Decision
  3 deferred), except "Our Work" and "Case Studies" are merged into one
  item, since they're now one collection.
- **A "Blog" section** — the old nav had one; there's no blog collection
  in this build. Add `src/content/blog/` + a schema in
  `src/content.config.ts` if that's wanted later.
- **Real funder/partner logos** — `LogoStrip` currently renders names as
  text badges, not actual logo images (none were scraped). Swap in real
  logomarks in `src/components/LogoStrip.astro` when available.
