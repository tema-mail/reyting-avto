// Данные полного каталога города для подгрузки на странице /<город>/ (первые строки – в HTML).
import type { APIRoute } from 'astro';
import { READY } from '../../lib/goroda';
import { toD } from '../../lib/katalog-polnyy';

export function getStaticPaths() {
  return READY.map((c) => ({ params: { gorod: c.slug } }));
}
export const GET: APIRoute = ({ params }) => new Response(JSON.stringify(toD(params.gorod!)), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
