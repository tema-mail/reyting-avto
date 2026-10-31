// Сборка ниш «только Яндекс Карты» одного города: съём src/data/source/<папка города>/<ключ>.json + отбор (otbor.mjs)
// + формула (formula-ya.mjs) + тексты src/data/nishi/<ключ>.ts (подстановка города – gorod-tekst.ts)
// + цены с сайтов src/data/ceny/<ключ>.json (в балл не входят; съём цен – только Новосибирск).
// Вынесено из ya.ts 01.11.2026, когда городов стало два.
import { computeYa, TOP } from './formula-ya.mjs';
import { NICHES_YA } from './otbor.mjs';
import { GOROD_DANNYE } from './gorod-dannye.mjs';
import { rayon } from './rayony.mjs';
import { partnersOf, partnerPhone } from '../data/partnery';
import type { NicheTextYa } from '../data/nishi/tip';
import type { Gorod } from './goroda';
import { tekstGoroda } from './gorod-tekst';
import type { Branch, Price, YaRow, NicheYa } from './ya-tip';

const SRC = import.meta.glob('../data/source/*/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const CENY = import.meta.glob('../data/ceny/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const TXT = import.meta.glob(['../data/nishi/*.ts', '!../data/nishi/tip.ts'], { eager: true, import: 'default' }) as Record<string, NicheTextYa>;

type GD = { dir: string; suffix: RegExp; rayony: boolean; old: boolean };
const gdOf = (c: Gorod): GD => (GOROD_DANNYE as Record<string, GD>)[c.slug];

/** Выбор редакции: партнёры встают первыми, их цифры – настоящие с Яндекс Карт; остальные сдвигаются вниз. */
function pinPartners(c: Gorod, key: string, rows: YaRow[], day: string) {
  const ps = partnersOf(key, c.slug);
  if (!ps.length) return;
  const pinned: YaRow[] = ps.map((p) => {
    const i = rows.findIndex((r) => r.ids.includes(p.ya.id));
    if (i >= 0) return { ...rows.splice(i, 1)[0], partner: true };
    const b: Branch = { id: p.ya.id, name: p.name, address: p.address, rayon: rayon(p.ya.coords), rating: p.ya.rating, ratings: p.ya.ratings, reviews: p.ya.reviews, last: p.ya.last, recent: p.ya.recent, site: p.site, phones: [p.phone], hours: p.ya.hours, allDay: false, rubrics: [], card: p.yandex || '', good: false, owner: false };
    const days = p.ya.last ? Math.round((Date.parse(day) - Date.parse(p.ya.last)) / 864e5) : null;
    return { city: c, niche: key, place: 0, score: NaN, raw: NaN, parts: { rating: 0, reviews: 0, fresh: 0, open: 0 }, name: p.name, display: p.name, rating: p.ya.rating, ratings: p.ya.ratings, reviews: p.ya.reviews, last: p.ya.last, days, recent: p.ya.recent, site: true, hours: !!p.ya.hours, owner: false, good: false, allDay: false, branches: [b], ids: [p.ya.id], rayony: [b.rayon], url: null, prices: [], priceFrom: null, partner: true };
  });
  rows.unshift(...pinned);
  rows.forEach((r, i) => (r.place = i + 1));
}

const branchOf = (gd: GD) => (c: any): Branch => ({
  id: c.id,
  name: c['название'],
  address: c['адрес'].replace(gd.suffix, ''),
  rayon: gd.rayony ? rayon(c['координаты']) : '',
  rating: c['рейтинг'],
  ratings: c['оценок'] || 0,
  reviews: c['отзывов'] || 0,
  last: c['последний_отзыв'] || null,
  recent: c['отзывов_за_12_мес_из_загруженных'] || 0,
  site: (c['сайты'] || [])[0] || null,
  phones: partnerPhone(String(c.id)) ? [partnerPhone(String(c.id))!] : c['телефоны'] || [],
  hours: c['часы'] || '',
  allDay: !!c['круглосуточно'],
  rubrics: c['рубрики'] || [],
  card: c['карточка'],
  good: !!c['хорошее_место'],
  owner: !!c['владелец_подтвердил'],
});

/** Цены компании из съёма ниши: ищем по id главной точки, затем остальных филиалов. */
function pricesOf(ceny: any, ids: string[]): Price[] {
  if (!ceny) return [];
  for (const id of ids) {
    const c = ceny['компании'].find((x: any) => String(x.id) === String(id));
    if (!c) continue;
    const seen = new Set<string>();
    const out: Price[] = [];
    for (const p of c['цены'] || []) {
      if (p['вид'] !== 'услуга' || !(p['от_руб'] > 0) || !p.url) continue;
      const name = String(p['услуга']).replace(/\s+/g, ' ').trim();
      const k = `${name.toLowerCase()}|${p['от_руб']}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ name, from: p['от_руб'], url: p.url });
    }
    if (out.length) return out.sort((a, b) => a.from - b.from);
  }
  return [];
}

export function build(c: Gorod): NicheYa[] {
  const gd = gdOf(c);
  if (!gd) throw new Error(`Нет данных города ${c.slug} в gorod-dannye.mjs`);
  const path = (key: string) => `../data/source/${gd.dir}/${key}.json`;
  // ниша без съёма (ещё снимается) пропускается: правило и тексты могут лечь раньше данных
  return Object.entries(NICHES_YA).filter(([key]) => SRC[path(key)]).map(([key, cfg]: [string, any]) => {
    const src = SRC[path(key)];
    const t0 = TXT[`../data/nishi/${key}.ts`];
    if (!t0) throw new Error(`Нет текстов ниши ${key}`);
    if (t0.key !== key) throw new Error(`Тексты ${key}: key = ${t0.key}`);
    const t = tekstGoroda(t0, c);
    // H1 по SEO-проверке 28.10: «{Ниша} в Новосибирске – рейтинг лучших {кого} {год}», как у магнитол
    const year = src['дата_съёма'].slice(0, 4);
    const tt: NicheTextYa = { ...t, h1: `${t.crumb} ${c.in} – рейтинг лучших ${cfg.who[2]} ${year}` };
    const r = computeYa(src, cfg);
    // цены с сайтов сняты только по компаниям Новосибирска
    const ceny = gd.old ? CENY[`../data/ceny/${key}.json`] || null : null;
    const toBranch = branchOf(gd);
    const rows: YaRow[] = r.rows.map((x: any) => {
      const branches = x.branches.map(toBranch);
      return {
        city: c,
        niche: key,
        place: x.place,
        score: x.score,
        raw: x.raw,
        parts: x.parts,
        name: x.name,
        display: x.display,
        rating: x.rating,
        ratings: x.ratings,
        reviews: x.reviews,
        last: x.last,
        days: x.days,
        recent: x.recent,
        site: x.site,
        hours: x.hours,
        owner: x.owner,
        good: x.good,
        allDay: x.allDay,
        branches,
        ids: x.ids,
        rayony: [...new Set(branches.map((b: Branch) => b.rayon).filter(Boolean))] as string[],
        url: null,
        prices: pricesOf(ceny, x.ids),
        priceFrom: null,
      };
    });
    for (const x of rows) x.priceFrom = x.prices.length ? x.prices[0].from : null;
    pinPartners(c, key, rows, src['дата_съёма']);
    return {
      kind: 'ya' as const,
      city: c,
      key,
      url: `/${c.slug}/${key}/`,
      t: tt,
      group: cfg.group,
      schema: cfg.schema,
      who: cfg.who,
      rule: cfg.rule,
      date: src['дата_съёма'],
      found: r.found,
      rejected: r.rejected,
      published: r.published,
      rows,
      top: rows.slice(0, TOP),
      rest: rows.slice(TOP),
      reviews: rows.reduce((s, x) => s + x.reviews, 0),
      priceDate: ceny ? ceny['дата_съёма'] : null,
      byRayon: !!src['расширено_по_районам'] || src['компании'].some((c: any) => !!c['найдено_по']),
    };
  });
}

/** Порог дубля: новая ниша, чей состав (id организаций) на 70%+ совпадает с уже опубликованной, не публикуется. */
export const DUP_SHARE = 0.7;
export function dedupe(all: NicheYa[]): NicheYa[] {
  const pub: NicheYa[] = [];
  // правило для третьей волны (задание 28.10); волны 1–2 уже опубликованы – у пересекающихся ссылки «Коротко».
  // Одно правило для всех городов (01.11.2026): порядок ниш – NICHES_YA.
  const order = Object.keys(NICHES_YA);
  const from = order.indexOf('servis-yaponskikh-avtomobiley');
  for (const n of all) if (n.published && order.indexOf(n.key) < from) pub.push(n);
  for (const n of all.filter((x) => order.indexOf(x.key) >= from)) {
    if (!n.published) continue;
    if ((NICHES_YA as any)[n.key]?.own) continue; // узкий запрос со своим спросом (otbor.mjs)
    const ids = new Set(n.rows.flatMap((r) => r.ids));
    for (const o of pub) {
      const oIds = new Set(o.rows.flatMap((r) => r.ids));
      const share = [...ids].filter((i) => oIds.has(i)).length / ids.size;
      if (share > DUP_SHARE) {
        n.published = false;
        n.dup = { key: o.key, crumb: o.t.crumb, share };
        break;
      }
    }
    if (n.published) pub.push(n);
  }
  return all;
}
