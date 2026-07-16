// import.meta.env.BASE_URL always has a trailing slash (e.g.
// '/brink-website/', or '/' with no base configured). Strip it so callers
// can do `withBase('/our-work')` without worrying about double slashes.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function withBase(path: string): string {
  return `${BASE}${path}`;
}
