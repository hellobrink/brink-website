// Build-time search index. There's no server to query, so every searchable
// record is baked into one JSON file at build and filtered client-side.
// This keeps search working on GitHub Pages with no backend and no
// third-party search dependency — the whole site is currently ~95 records,
// which is a trivial payload to filter in the browser.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { withBase } from '../lib/base';

interface Doc {
  title: string;
  url: string;
  kind: string;
  text: string;
}

/** Strip Markdown noise so a body search matches words, not syntax. */
const plain = (body: string | undefined) =>
  (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600); // enough to match on; not so much the index balloons

export const GET: APIRoute = async () => {
  const [work, sectors, offers, team, blog, pages] = await Promise.all([
    getCollection('work'),
    getCollection('sectors'),
    getCollection('offers'),
    getCollection('team'),
    getCollection('blog'),
    getCollection('pages'),
  ]);

  const docs: Doc[] = [
    ...work.map((e) => ({
      title: e.data.title,
      url: withBase(`/our-work/${e.id}`),
      kind: e.data.hasCaseStudy ? 'Case study' : 'Our work',
      // Credits are {name, url} objects, so index the names.
      text: [
        e.data.summary,
        e.data.headlineResult,
        ...e.data.funders.map((c) => c.name),
        ...e.data.partners.map((c) => c.name),
        plain(e.body),
      ]
        .filter(Boolean)
        .join(' '),
    })),
    ...sectors.map((e) => ({
      title: e.data.name,
      url: withBase(`/sectors/${e.id}`),
      kind: 'Sector',
      text: [e.data.headline, e.data.positioningLine, plain(e.body)].filter(Boolean).join(' '),
    })),
    ...offers.map((e) => ({
      title: e.data.name,
      url: withBase(`/offers/${e.id}`),
      kind: 'Offer',
      text: [e.data.summary, plain(e.body)].filter(Boolean).join(' '),
    })),
    ...team.map((e) => ({
      title: e.data.name,
      url: withBase(`/team/${e.id}`),
      kind: 'Team',
      text: [e.data.role, e.data.location, plain(e.body)].filter(Boolean).join(' '),
    })),
    ...blog.map((e) => ({
      title: e.data.title,
      url: withBase(`/blog/${e.id}`),
      kind: 'Blog',
      text: [e.data.summary, e.data.authorName, plain(e.body)].filter(Boolean).join(' '),
    })),
    ...pages.map((e) => ({
      title: e.data.title,
      url: withBase(`/${e.id}`),
      kind: 'Page',
      text: plain(e.body),
    })),
  ];

  return new Response(JSON.stringify(docs), {
    headers: { 'Content-Type': 'application/json' },
  });
};
