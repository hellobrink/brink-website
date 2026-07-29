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

// The long-form magazine layout only pins an image that stands alone in its own
// paragraph. But the CMS rich-text editor happily lets an editor glue an image
// onto a text line — `**Heading**![](img)` → `<p><strong>…</strong><img></p>` —
// or drop one inside a heading — `#### ![](img)` → `<h4><img></h4>`. Those
// images fail the "paragraph that is only an image" test, so they silently fell
// out of the pinned column and rendered inline, mixing stuck and un-stuck
// images in one section. This pass rewrites the tree so every image becomes its
// own paragraph, emitted just before the text it was attached to (which then
// acts as that image's scroll anchor). Images that are already on their own line
// are left untouched, so it is a no-op on well-formed posts.
function rehypeIsolateImages() {
  const isEl = (n) => n && n.type === 'element';
  const hasText = (n) =>
    n.type === 'text' ? n.value.trim().length > 0 : (n.children ?? []).some(hasText);
  const hasImg = (n) =>
    isEl(n) && n.tagName === 'img' ? true : (n.children ?? []).some(hasImg);
  // A child that is purely an image: an <img>, or a wrapper (<a>, <picture>)
  // holding an image and no text of its own.
  const isImageChild = (n) =>
    isEl(n) && (n.tagName === 'img' || (hasImg(n) && !hasText(n)));
  const asParagraph = (img) => ({
    type: 'element',
    tagName: 'p',
    properties: {},
    children: [img],
  });
  const newline = () => ({ type: 'text', value: '\n' });

  return () => (tree) => {
    const out = [];
    for (const node of tree.children) {
      const isP = isEl(node) && node.tagName === 'p';
      const isHeading = isEl(node) && /^h[1-6]$/.test(node.tagName);
      if ((isP || isHeading) && hasImg(node)) {
        const images = (node.children ?? []).filter(isImageChild);
        const rest = (node.children ?? []).filter((c) => !isImageChild(c));
        const restHasText = rest.some(hasText);
        // Only act when the image is *mixed* with something else (glued text, or
        // wrapped in a heading). A paragraph that is already just an image needs
        // no change and falls through untouched.
        if (images.length && (restHasText || isHeading)) {
          for (const img of images) out.push(asParagraph(img), newline());
          // Keep the leftover text as its own block; an image-only heading has
          // no text left, so it is simply dropped (the editor meant an image).
          if (restHasText) {
            node.children = rest;
            out.push(node, newline());
          }
          continue;
        }
      }
      out.push(node);
    }
    tree.children = out;
  };
}

export default defineConfig({
  site: 'https://hellobrink.github.io',
  base: BASE,
  markdown: {
    // Isolate images first (structural), then prefix any root-relative URLs.
    rehypePlugins: [rehypeIsolateImages(), rehypeBasePath(BASE)],
  },
});
