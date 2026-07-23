# Brink website — backlog

Running list of outstanding work on the new site, grouped by theme. Not in
strict priority order. Tick items off as they land.

## Launch / cutover
- [ ] **URL mapping + redirects** — map every old Webflow URL to its new home so
      nothing 404s and SEO/links survive. Includes `/post/{slug}` → `/blog/{slug}`
      (slugs already match 1:1).
- [ ] **Go live** — move hosting to Cloudflare Pages (gives a real staging/live
      split), custom domain + DNS + HTTPS. At that point set the Astro `base`
      back to `/` (from `/brink-website`).
- [ ] **Deploy the manual** to `manual.hellobrink.co` (the self-contained page in
      `public/manual/` — just point the subdomain at it).
- [ ] **Migrate or redirect** the 2 Behavioural-Innovation links not in the blog
      set: `oxfam-america` and `i-disagree` (they'll 404 at cutover otherwise).
- [ ] **Security sweep** before going public.

## CMS & enablement
- [ ] **Stand up the CMS auth worker** (Rob) — deploy `sveltia-cms-auth` on
      Cloudflare, create the GitHub OAuth app, set `base_url` in
      `public/admin/config.yml`, invite editors. See `CMS_SETUP.md`.
- [ ] **Team Claude-account onboarding doc** — short one-time "set up Claude Code
      on your machine" guide for colleagues, once the team account lands.
- [ ] (Optional) **Make bespoke pages CMS-editable** — move the About and
      homepage copy into content entries so editors can change them.

## Content
- [ ] **6 team bios** still have placeholder "questions" — awaiting real content
      from the team.
- [ ] **Case-study missing details** — awaiting docs from Rob to mass-edit.
- [ ] **Case-study details spreadsheet** — a Google-Sheets-openable file listing
      every live case study, columns: Programme, Location, Sector, Timeline
      (From / To, with an "ongoing" option), Funders, Partners. Pre-filled from
      the current site; dropdown validation on Sector (climate / health /
      education, flag anything new); From and To as separate columns. Team fills
      the gaps and returns it, then update the site from it. (This is the
      mechanism for the "missing details" item above.)
- [ ] **Alt text** on ~93 scraped images (GitHub issue #9).
- [ ] **Run-together sentences** from the Webflow scrape (issue #10), plus minor
      formatting artifacts in the migrated blog back-catalogue.

## Features & polish
- [ ] **Newsletter UX upgrade** — replace the footer link-out with an on-site
      embedded MailChimp form (name + email) submitting to the Brinkiverse list
      with the `from CD subscriber page (everything)` tag. Do a real test signup
      to confirm the tag lands before trusting it. (Currently: footer links out
      to the hosted Cognitive Download page, which works and tags correctly.)
- [ ] **Footer "Cookie settings" link** — wire it to `window.showCookieBanner()`
      so visitors can withdraw analytics consent.
- [ ] **Automatic "latest newsletter"** module on the homepage, pulled from the
      newsletter platform's RSS (its own spot, not mixed into "Latest thinking";
      needs a scheduled rebuild to stay fresh).
- [ ] **Technology sector page** (and any further sectors). Futures section is
      deferred.
- [ ] **"Our methods" vs the `/offers` page** — the page still titles itself
      "Our offers"; align the naming.
- [ ] **SEO / social** — Open Graph share cards, `sitemap.xml`, `robots.txt`, a
      404 page.

## Future projects (separate)
- [ ] **Analytics dashboard** — combine Substack + Mailchimp + Google Analytics.
- [ ] **Slack "Builder" bot** — a custom Slack → Claude Code agent so the team can
      request site changes from Slack (needs a hosted runner + guardrails).
