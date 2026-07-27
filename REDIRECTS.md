# URL migration & redirects

How the old Webflow URLs map to the new site, so no inbound links or SEO are
lost at cutover. The redirects themselves live in `public/_redirects`
(Cloudflare Pages format) and take effect once the site is served from
Cloudflare Pages at the custom domain.

## Redirected (path changed)

| Old (Webflow) | New | Notes |
|---|---|---|
| `/post/{slug}` | `/blog/{slug}` | Slugs preserved; 1:1 |
| `/case-studies` | `/our-work` | Case studies merged into Our Work |
| `/case-studies/{slug}` | `/our-work/{slug}` | All 11 slugs match 1:1 (verified) |
| `/our-offers` | `/offers` | |
| `/climate` | `/sectors/climate` | Sectors moved under `/sectors` |
| `/health` | `/sectors/health` | |
| `/education` | `/sectors/education` | |
| `/meet-the-team` | `/team` | Live site already 301s this |
| `/foundation`, `/brink-foundation` | brink-foundation.org | Now a separate external site |

## Unchanged (no redirect needed)

`/` · `/about` · `/blog` · `/careers` · `/privacy-policy` · `/our-work` ·
`/our-work/{slug}` · `/team` · `/team/{slug}` — same path on both sites.

## Best-effort (confirm at cutover)

`/what-we-do`, `/carve-out-whitepaper` → `/offers`; `/categories/*` → `/our-work`.
These old Webflow pages have no exact new equivalent; the maps are sensible
guesses. Review before go-live.

## Known caveat

`/post/*` redirects every old post URL to `/blog/{slug}`. The new site carries
the 94 posts the live blog index exposes; if an older post URL exists that was
never on that index, it will land on the 404 page rather than a post. Low risk,
but worth a spot-check of any high-value old post links at cutover.

## Mechanism

Cloudflare Pages reads `_redirects` from the site root. GitHub Pages does not
support it, so it is inert on the current preview — which is why the cutover
plan moves hosting to Cloudflare Pages (it also gives the staging/live split and
per-PR previews). If we ever stay on GitHub Pages instead, these become
per-path redirect stub pages via Astro's `redirects` config instead.
