import { defineConfig } from 'astro/config';

// Served as a GitHub Pages *project* site for now (hellobrink.github.io
// already has its own user site taken, and hellobrink.github.io/brink-website
// is the beta URL) — so every internal link needs the `/brink-website`
// prefix. Switch base back to '/' once this moves to a custom domain.
const BASE = '/brink-website';

// Astro's `base` config prefixes routes it generates itself, but not raw
// hrefs/srcs baked into scraped Markdown bodies (case studies, static
// pages) — those need a rehype pass. Astro components handle their own
// prefixing via src/lib/base.ts.
function rehypeBasePath(base) {
  return () => (tree) => {
    function visit(node) {
      if (node.type === 'element') {
        for (const attr of ['src', 'href']) {
          const value = node.properties?.[attr];
          if (typeof value === 'string' && value.startsWith('/') && !value.startsWith(base)) {
            node.properties[attr] = base + value;
          }
        }
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}

export default defineConfig({
  site: 'https://hellobrink.github.io',
  base: BASE,
  markdown: {
    rehypePlugins: [rehypeBasePath(BASE)],
  },
});
