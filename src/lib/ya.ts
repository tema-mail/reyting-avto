// Модель ниш «только Яндекс Карты»: съём src/data/source/avto/<ключ>.json + отбор (otbor.mjs) + формула (formula-ya.mjs)
// + тексты src/data/nishi/<ключ>.ts + цены с сайтов src/data/ceny/<ключ>.json (в балл не входят).
// Каждая компания рейтинга получает карточку (каталог 30.10, раньше – только топ-20); одна компания в нескольких нишах –
// одна карточка (связь по id организаций Яндекса), в том числе со старыми карточками ниш Я+2ГИС.
import { computeYa, TOP } from './formula-ya.mjs';
import { NICHES_YA } from './otbor.mjs';
import { rayon } from './rayony.mjs';
import { partnersOf, partnerPhone } from '../data/partnery';
import type { NicheTextYa } from '../data/nishi/tip';
import { COMPANIES } from './reyting';
import { slugify } from './slug';
import { CITY } from './site';

const SRC = import.meta.glob('../data/source/avto/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const CENY = import.meta.glob('../data/ceny/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const TXT = import.meta.glob(['../data/nishi/*.ts', '!../data/nishi/tip.ts'], { eager: true, import: 'default' }) as Record<string, NicheTextYa>;

export interface Branch {
  id: string;
  name: string;
  address: string;
  rayon: string;
  rating: number;
  ratings: number;
  reviews: number;
  last: string | null;
  recent: number;
  site: string | null;
  phones: string[];
  hours: string;
  allDay: boolean;
  rubrics: string[];
  card: string;
  good: boolean;
  owner: boolean;
}

/** Цена «от» с сайта компании (только услуги; товары в нишах услуг не показываем). */
export interface Price {
  name: string;
  from: number;
  url: string;
}

export interface YaRow {
  niche: string;
  place: number;
  score: number;
  raw: number;
  parts: { rating: number; reviews: number; fresh: number; open: number };
  name: string;
  display: string;
  rating: number;
  ratings: number;
  reviews: number;
  last: string | null;
  days: number | null;
  recent: number;
  site: boolean;
  hours: boolean;
  owner: boolean;
  good: boolean;
  allDay: boolean;
  branches: Branch[];
  ids: string[];
  rayony: string[];
  url: string | null; // карточка на сайте (топ-20 или уже есть карточка)
  prices: Price[]; // по возрастанию цены; пусто – цен на сайте не нашли
  priceFrom: number | null;
  entity?: Entity;
  partner?: boolean; // выбор редакции: закреплён первым (data/partnery.ts)
}

export interface NicheYa {
  kind: 'ya';
  key: string;
  url: string;
  t: NicheTextYa;
  group: string;
  schema: string;
  who: [string, string, string];
  rule: string;
  date: string;
  found: number;
  rejected: Record<string, number>;
  published: boolean;
  rows: YaRow[];
  top: YaRow[];
  rest: YaRow[];
  reviews: number;
  priceDate: string | null; // дата съёма цен; null – цен для ниши нет
  dup?: { key: string; crumb: string; share: number }; // не опубликована: состав дублирует другую нишу
  byRayon: boolean; // поиск шёл по городу и по 10 районам (у компаний есть поле «найдено_по»)
}

export interface Entity {
  slug: string;
  url: string;
  name: string;
  oldSlug: string | null; // карточка старой ниши (Я+2ГИС)
  rows: YaRow[]; // места в нишах Яндекса, лучшее место первым
  branches: Branch[];
  label: string; // имя для title: при совпадении названий – с улицей или нишей
  index: boolean; // индексировать: есть отзывы, цены с сайта или топ-5 хотя бы одного рейтинга (иначе noindex, follow)
}

/** Выбор редакции: партнёры встают первыми, их цифры – настоящие с Яндекс Карт; остальные сдвигаются вниз. */
function pinPartners(key: string, rows: YaRow[], day: string) {
  const ps = partnersOf(key);
  if (!ps.length) return;
  const pinned: YaRow[] = ps.map((p) => {
    const i = rows.findIndex((r) => r.ids.includes(p.ya.id));
    if (i >= 0) return { ...rows.splice(i, 1)[0], partner: true };
    const b: Branch = { id: p.ya.id, name: p.name, address: p.address, rayon: rayon(p.ya.coords), rating: p.ya.rating, ratings: p.ya.ratings, reviews: p.ya.reviews, last: p.ya.last, recent: p.ya.recent, site: p.site, phones: [p.phone], hours: p.ya.hours, allDay: false, rubrics: [], card: p.yandex || '', good: false, owner: false };
    const days = p.ya.last ? Math.round((Date.parse(day) - Date.parse(p.ya.last)) / 864e5) : null;
    return { niche: key, place: 0, score: NaN, raw: NaN, parts: { rating: 0, reviews: 0, fresh: 0, open: 0 }, name: p.name, display: p.name, rating: p.ya.rating, ratings: p.ya.ratings, reviews: p.ya.reviews, last: p.ya.last, days, recent: p.ya.recent, site: true, hours: !!p.ya.hours, owner: false, good: false, allDay: false, branches: [b], ids: [p.ya.id], rayony: [b.rayon], url: null, prices: [], priceFrom: null, partner: true };
  });
  rows.unshift(...pinned);
  rows.forEach((r, i) => (r.place = i + 1));
}

const branchOf = (c: any): Branch => ({
  id: c.id,
  name: c['название'],
  address: c['адрес'].replace(/, Новосибирск$/, ''),
  rayon: rayon(c['координаты']),
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

function build(): NicheYa[] {
  // ниша без съёма (ещё снимается) пропускается: правило и тексты могут лечь раньше данных
  return Object.entries(NICHES_YA).filter(([key]) => SRC[`../data/source/avto/${key}.json`]).map(([key, cfg]: [string, any]) => {
    const src = SRC[`../data/source/avto/${key}.json`];
    const t = TXT[`../data/nishi/${key}.ts`];
    if (!t) throw new Error(`Нет текстов ниши ${key}`);
    if (t.key !== key) throw new Error(`Тексты ${key}: key = ${t.key}`);
    // H1 по SEO-проверке 28.10: «{Ниша} в Новосибирске – рейтинг лучших {кого} {год}», как у магнитол
    const year = src['дата_съёма'].slice(0, 4);
    const tt: NicheTextYa = { ...t, h1: `${t.crumb} ${CITY.in} – рейтинг лучших ${cfg.who[2]} ${year}` };
    const r = computeYa(src, cfg);
    const ceny = CENY[`../data/ceny/${key}.json`] || null;
    const rows: YaRow[] = r.rows.map((x: any) => {
      const branches = x.branches.map(branchOf);
      return {
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
        rayony: [...new Set(branches.map((b: Branch) => b.rayon))] as string[],
        url: null,
        prices: pricesOf(ceny, x.ids),
        priceFrom: null,
      };
    });
    for (const x of rows) x.priceFrom = x.prices.length ? x.prices[0].from : null;
    pinPartners(key, rows, src['дата_съёма']);
    return {
      kind: 'ya' as const,
      key,
      url: `/${CITY.slug}/${key}/`,
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
function dedupe(all: NicheYa[]): NicheYa[] {
  const pub: NicheYa[] = [];
  // правило для третьей волны (задание 28.10); волны 1–2 уже опубликованы – у пересекающихся ссылки «Коротко»
  const from = all.findIndex((x) => x.key === 'servis-yaponskikh-avtomobiley');
  all.forEach((n, i) => {
    if (n.published && i < from) pub.push(n);
  });
  for (const n of all.slice(from)) {
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
const ALL_YA = dedupe(build());
/** Опубликованные ниши (5 и больше компаний прошли отбор). */
export const NICHES_YA_PUB: NicheYa[] = ALL_YA.filter((n) => n.published);
/** Не прошли порог – на сайте их нет, причина в ~/Sites/reytingi/docs/sayty/resheniya-avto.md (закрытый репо) и на /metodika/. */
export const NICHES_YA_HIDDEN: NicheYa[] = ALL_YA.filter((n) => !n.published);

const idOf = (url: string) => (url.match(/\/(\d+)\/?$/) || [])[1];

/** Компании: объединяем строки разных ниш с общим id организации Яндекса. */
function entities(): Entity[] {
  const rows = NICHES_YA_PUB.flatMap((n) => n.rows);
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const byId = new Map<string, number>();
  rows.forEach((r, i) => {
    for (const id of r.ids) {
      if (byId.has(id)) parent[find(i)] = find(byId.get(id)!);
      else byId.set(id, i);
    }
  });
  const groups = new Map<number, YaRow[]>();
  rows.forEach((r, i) => {
    const k = find(i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  });
  const oldById = new Map<string, string>();
  for (const c of COMPANIES) for (const card of c.y.cards) oldById.set(idOf(card)!, c.slug);
  const used = new Set(COMPANIES.map((c) => c.slug));
  const out: Entity[] = [];
  STATS.groups = groups.size;
  STATS.matchedOld = new Set([...groups.values()].map((g) => g.flatMap((r) => r.ids).map((id) => oldById.get(id)).find(Boolean)).filter(Boolean)).size;
  for (const g of groups.values()) {
    g.sort((a, b) => a.place - b.place || b.score - a.score);
    const oldSlug = g.flatMap((r) => r.ids).map((id) => oldById.get(id)).find(Boolean) || null;
    const branches = [...new Map(g.flatMap((r) => r.branches).map((b) => [b.id, b])).values()];
    const lead = g[0];
    let slug = oldSlug;
    if (!slug) {
      slug = slugify(lead.display);
      if (used.has(slug)) slug = slugify(`${lead.name} ${branches[0].address.split(',').slice(0, 2).join(' ')}`);
      if (used.has(slug)) throw new Error(`Slug «${slug}» занят дважды`);
    }
    used.add(slug);
    const old = oldSlug ? COMPANIES.find((c) => c.slug === oldSlug)! : null;
    const name = old ? old.t.brand : lead.display;
    // каталог 30.10: карточка у каждой компании рейтинга; в индекс – если есть хоть один отзыв, цены или топ-5
    const index = g.some((r) => r.prices.length > 0 || r.place <= 5 || r.reviews > 0);
    const e: Entity = { slug, url: `/${CITY.slug}/companies/${slug}/`, name, oldSlug, rows: g, branches, label: name, index };
    for (const r of g) {
      r.url = e.url;
      r.entity = e;
    }
    out.push(e);
  }
  // одинаковые названия у разных карточек – в title добавляем улицу главной точки, затем нишу
  const key = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();
  const allNames = [...out.filter((e) => !e.oldSlug).map((e) => e.name), ...COMPANIES.map((c) => c.t.brand)].map(key);
  for (const e of out) {
    if (e.oldSlug || allNames.filter((x) => x === key(e.name)).length < 2) continue;
    const street = e.branches[0].address.split(',')[0];
    e.label = e.name.includes(street) ? `${e.name}, ${nicheCrumb(e.rows[0].niche)}` : `${e.name}, ${street}`;
  }
  const labels = out.map((e) => key(e.label));
  for (const e of out) if (labels.filter((x) => x === key(e.label)).length > 1) e.label = `${e.label}, ${nicheCrumb(e.rows[0].niche).toLowerCase()}`;
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}
const nicheCrumb = (k: string) => NICHES_YA_PUB.find((n) => n.key === k)!.t.crumb;

const STATS = { groups: 0, matchedOld: 0 };
export const ENTITIES: Entity[] = entities();

/** Уникальные компании и отзывы Яндекса по всем рейтингам (компания в нескольких нишах – один раз). */
export function uniqueTotals(oldCompanies: { y: { reviews: number; cards: string[] } }[]) {
  const reviews = new Map<string, number>();
  for (const n of NICHES_YA_PUB) for (const r of n.rows) reviews.set(r.branches[0].id, r.branches[0].reviews); // в балл идёт главная точка сети
  const all = new Set(NICHES_YA_PUB.flatMap((n) => n.rows.flatMap((r) => r.ids)));
  let yaReviews = [...reviews.values()].reduce((s, x) => s + x, 0);
  for (const c of oldCompanies) if (!c.y.cards.some((u) => all.has(idOf(u)!))) yaReviews += c.y.reviews;
  return { companies: STATS.groups + oldCompanies.length - STATS.matchedOld, yaReviews };
}
/** Новые карточки (у компаний старых ниш карточка уже есть – туда добавляются места). */
export const NEW_CARDS: Entity[] = ENTITIES.filter((e) => !e.oldSlug);
export const placesOfOld = (slug: string): YaRow[] => ENTITIES.find((e) => e.oldSlug === slug)?.rows || [];
export const nicheYa = (key: string) => NICHES_YA_PUB.find((n) => n.key === key)!;
