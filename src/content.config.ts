import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The core collection. A single "engagement" record — every project Brink
// has run, current or past. Case studies are engagements with
// hasCaseStudy: true and a full narrative in the Markdown body; everything
// else is a lighter summary. Sector and offer pages pull from here by tag
// rather than maintaining separate content. See brief section "Possible
// content model" / Decision 1.
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    // The name a visitor would recognise from the live /our-work index
    // (e.g. "ASToN", "Macmillan CoLab") when it differs from the
    // case-study title it was merged into. See brief Decision 1 / issue #5.
    programmeName: z.string().optional(),
    summary: z.string(),
    heroImage: z.string().optional(),
    heroAlt: z.string().optional(),
    sector: z.array(z.enum(['climate', 'health', 'education'])).default([]),
    offer: z
      .array(z.enum(['open-innovation', 'carve-outs', 'missions']))
      .default([]),
    status: z.enum(['current', 'past']).default('past'),
    funders: z.array(z.string()).default([]),
    partners: z.array(z.string()).default([]),
    externalLink: z.string().url().optional(),
    hasCaseStudy: z.boolean().default(false),
    // Headline result shown on case-study cards, e.g. "£2.4m unlocked for
    // 12 climate-tech teams". Only meaningful when hasCaseStudy is true.
    headlineResult: z.string().optional(),
    year: z.string().optional(),
    sortOrder: z.number().default(0),
  }),
});

// Sector pages (climate, health, education). Futures is deferred — see
// Decision 2 in the brief.
const sectors = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sectors' }),
  schema: z.object({
    name: z.string(),
    headline: z.string(),
    // Plain, not poetic: "who this is for and what Brink does". See brief
    // section 4A.3's diagnosis — pages currently set a mood without
    // landing the proposition.
    positioningLine: z.string(),
    stats: z
      .array(
        z.object({
          value: z.string(),
          label: z.string(),
          caseStudySlug: z.string().optional(),
        })
      )
      .default([]),
    whatWeDo: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
        })
      )
      .default([]),
    challengeText: z.string(),
    // The brief calls for exactly 3 ("principles trio"), but that's an
    // editorial target, not something worth hard-failing the whole site
    // build over if an editor is mid-edit with 2 or 4.
    principles: z.array(z.string()).max(3).optional(),
    namedContact: z
      .object({
        name: z.string(),
        role: z.string(),
        photo: z.string().optional(),
      })
      .optional(),
  }),
});

// The three editorial offer pages (Open Innovation, Innovation Carve-Outs,
// Innovation Missions). Futures excluded from v1 per Decision 2.
const offers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/offers' }),
  schema: z.object({
    name: z.string(),
    summary: z.string(),
    // The Webflow "sticker" illustration for this offer, shown on the
    // detail page (e.g. the experiment/pilot/octopus stickers scraped
    // from the live /our-offers page).
    image: z.string().optional(),
  }),
});

// Single shared record for the behavioural-innovation panel that appears
// identically on every sector page. Referenced, not duplicated.
const shared = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/shared' }),
  schema: z.object({
    title: z.string(),
  }),
});

// Simple one-off pages: About, Brink Foundation, Careers, Team, Privacy
// Policy. No special fields — just a title and Markdown body.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = { work, sectors, offers, shared, pages };
