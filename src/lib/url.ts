// Внутренние ссылки с учётом подпапки GitHub Pages (base) и слэша на конце.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function u(path: string): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const [p, hash] = path.split('#');
  let clean = p.startsWith('/') ? p : '/' + p;
  if (!/\.[a-z0-9]+$/i.test(clean) && !clean.endsWith('/')) clean += '/';
  return BASE + clean + (hash ? '#' + hash : '');
}

/** Абсолютный адрес страницы для canonical, sitemap и разметки. */
export function abs(path: string, site: URL | string | undefined): string {
  return new URL(u(path), site).toString();
}
