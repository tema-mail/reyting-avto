// robots.txt: на тесте (PUBLIC_NOINDEX=1) закрыто всё; на бою – Clean-param для фильтров и sitemap.
// На GitHub Pages файл лежит в подпапке и роботами не читается – там закрывает meta robots на каждой странице.
import type { APIRoute } from 'astro';
import { NOINDEX_ALL } from '../lib/site';
import { abs } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const body = NOINDEX_ALL
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /spasibo/\nClean-param: rayon&sort\n\nSitemap: ${abs('/sitemap.xml', site)}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
