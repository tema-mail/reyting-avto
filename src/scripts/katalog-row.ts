// Строка полного каталога города: одна функция и для сборки (первые строки в HTML), и для браузера (остальные из
// /<город>/catalog.json). Данные – компактными массивами (lib/katalog-polnyy.ts → toJ), без фреймворка.

/** [название, адрес карточки | '', адрес, ещё филиалов, районы (индексы), услуги (индексы), оценка, отзывов, партнёр, статус]
 *  статус: [индекс ниши, место, ещё рейтингов] – в рейтинге; число – индекс причины «пока не в рейтинге». */
export type J = [string, string, string, number, number[], number[], number, number, 0 | 1, [number, number, number] | number];
export interface D {
  keys: string[]; // ключи ниш
  crumbs: string[]; // названия услуг
  rayony: string[];
  why: string[];
  city: string;
  rows: J[];
}

const NBSP = ' ';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n: number) => (String(n).length > 3 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) : String(n));
const plural = (n: number, f: [string, string, string]) => {
  const a = n % 100;
  const b = a % 10;
  return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2];
};
const rt = (r: number) => (Math.abs(r * 10 - Math.round(r * 10)) < 1e-9 ? r.toFixed(1) : r.toFixed(2)).replace('.', ',');
const SHOW = 4; // услуг в строке, остальные – «и ещё N»

export function rowHtml(r: J, d: D, base: string): string {
  const [name, url, addr, more, ray, nis, rating, reviews, partner, st] = r;
  const link = (p: string) => base + p;
  const head = url ? `<a href="${esc(link(url))}"><b>${esc(name)}</b></a>` : `<b>${esc(name)}</b>`;
  const where = esc(addr) + (more > 0 ? ` и ещё ${more}` : '') + (ray.length ? ` · ${ray.map((i) => esc(d.rayony[i])).join(', ')}` : '');
  const svc = nis.slice(0, SHOW).map((i) => esc(d.crumbs[i])).join(', ') + (nis.length > SHOW ? ` и ещё ${nis.length - SHOW}` : '');
  const nums = partner ? '' : `<span class="small mono">Я ${rt(rating)} · ${num(reviews)} ${plural(reviews, ['отзыв', 'отзыва', 'отзывов'])}</span>`;
  let stat: string;
  if (Array.isArray(st)) {
    const [ni, place, rest] = st;
    const pl = partner ? 'выбор редакции' : `${place}-е место`;
    stat = `<span class="small kat__in">В рейтинге <a href="${esc(link(`/${d.city}/${d.keys[ni]}/`))}">«${esc(d.crumbs[ni])}»</a> – ${pl}${rest > 0 ? `, ещё в ${rest} ${plural(rest, ['рейтинге', 'рейтингах', 'рейтингах'])}` : ''}</span>`;
  } else stat = `<span class="small muted">Пока не в рейтинге: ${esc(d.why[st])}</span>`;
  return `<li>${head}<span class="small muted">${where}</span>${svc ? `<span class="small">${svc}</span>` : ''}${nums}${stat}</li>`;
}
