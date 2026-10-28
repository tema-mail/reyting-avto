// sitemap.xml – только индексируемые адреса, lastmod = дата съёма (не дата сборки).
import type { APIRoute } from 'astro';
import { indexableAll } from '../lib/katalog';
import { abs } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const urls = indexableAll().map((p) => `  <url><loc>${abs(p.path, site)}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
