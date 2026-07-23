# Content editor (CMS) — setup & how it works

The site is edited through **Sveltia CMS**, a friendly form-based editor that
lives in this repo at `/admin`. Editors sign in with GitHub, fill in forms, and
save — their change is committed to a branch, which rebuilds the site.

> **How review works (important):** Sveltia commits a save **directly to the
> branch** named in `config.yml` — it does *not* open a pull request per edit.
> The review-before-live step therefore comes from **which branch the CMS
> writes to**: have it write to a `staging` branch, review there, then promote
> to the live branch with a merge. See "Staging vs live" below.

- **Editor URL (once live):** https://hellobrink.github.io/brink-website/admin/
- **Config:** `public/admin/config.yml` (the collections and their fields)
- **Loader:** `public/admin/index.html`

Because the site is a static site on GitHub Pages, logging in needs one small
free piece of infrastructure — a Cloudflare Worker that handles the GitHub
sign-in handshake. **This is a one-time setup.** Until it's done, the `/admin`
page loads but login fails.

---

## One-time setup (≈15 minutes)

### 1. Create a GitHub OAuth App

GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
(or directly: https://github.com/settings/developers)

- **Application name:** `Brink CMS`
- **Homepage URL:** `https://hellobrink.github.io/brink-website`
- **Authorization callback URL:** `https://brink-cms-auth.<your-subdomain>.workers.dev/callback`
  (you'll get the real worker URL in step 2 — come back and fix this after)

Register it, then note the **Client ID** and generate a **Client Secret**.

### 2. Deploy the sign-in worker (Cloudflare, free)

The worker is an open-source project: https://github.com/sveltia/sveltia-cms-auth

The quickest route:

1. Sign in / create a free account at https://dash.cloudflare.com
2. **Workers & Pages → Create → Worker.** Name it e.g. `brink-cms-auth`, deploy
   the starter, then **Edit code** and paste in the contents of
   `src/index.js` from the sveltia-cms-auth repo (or use the "Deploy to
   Cloudflare" button in its README).
3. In the worker's **Settings → Variables**, add:
   - `GITHUB_CLIENT_ID` — from step 1
   - `GITHUB_CLIENT_SECRET` — from step 1 (mark it **Encrypt**)
   - `ALLOWED_DOMAINS` — `hellobrink.github.io` (add your custom domain later)
4. Note the worker's URL, e.g. `https://brink-cms-auth.<you>.workers.dev`.
5. Go back to the GitHub OAuth App (step 1) and set the callback URL to
   `https://brink-cms-auth.<you>.workers.dev/callback`.

### 3. Point the CMS at the worker

In `public/admin/config.yml`, set:

```yaml
backend:
  name: github
  repo: hellobrink/brink-website
  branch: main
  base_url: https://brink-cms-auth.<you>.workers.dev   # ← your worker URL
```

Commit that change. That's it — `/admin` login now works.

### 4. Give editors access

Each editor needs a GitHub account with **write access** to this repo:
GitHub → repo **Settings → Collaborators → Add people**. They then open
`/admin/`, click **Sign in with GitHub**, and start editing.

> The same worker can serve **any number of sites** (e.g. a future Foundation
> site). Add each new site's domain to `ALLOWED_DOMAINS` — you don't need a new
> worker per site.

---

## How editing works day to day

1. An editor opens `/admin/`, picks a collection (Blog posts, Team, Work, etc.),
   and edits or creates an entry using the form fields.
2. On **Save**, Sveltia commits the change **straight to the branch** named in
   `config.yml` (`backend.branch`) and the site rebuilds from that branch.
   Sveltia makes a clean, minimal commit — it only writes the fields that
   changed, it does not reformat the rest of the file.

**There is no per-save pull request.** So the review step is a branch decision:

- **Pre-cutover (now):** the CMS writes to `main`, which deploys to the
  github.io preview. Since the real site is still on Webflow, nothing public is
  affected — edits simply appear on the preview. This is fine for now.
- **Post-cutover:** point the CMS at a `staging` branch. Editors' saves land on
  staging (and the staging site), you review, and you **promote to live by
  merging `staging → main`**. That merge is your "work in the background, then
  publish" gate.

---

## Images

Uploading an image in the editor saves it into `public/images/` and writes a
path like `/images/your-file.jpg` into the content. The site adds the
`/brink-website` prefix automatically at build time, so **don't** include it in
paths yourself.

---

## Staging vs live (at cutover)

Today the GitHub Pages site (`hellobrink.github.io/brink-website`) is effectively
the **staging** site — the real hellobrink.co still runs on Webflow. When we cut
over to make this the live site, the plan is:

- Move hosting to **Cloudflare Pages** (free, same GitHub repo as the source).
- `main` → **live** (hellobrink.co); a `staging` branch → **staging**
  (e.g. staging.hellobrink.co).
- Every pull request automatically gets its **own preview URL**, so a change can
  be *browsed* before it's merged — not just read as a diff.

None of that changes the CMS or these instructions; it only adds environments
around it. Point the CMS `branch:` at whichever branch editors should write to.

---

## Fields reference

The editable fields for each collection mirror the schemas in
`src/content.config.ts`. If you add a field there, add it to
`public/admin/config.yml` too so editors can set it.
