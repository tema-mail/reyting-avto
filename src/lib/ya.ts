// Модель ниш «только Яндекс Карты»: съём src/data/source/avto/<ключ>.json + отбор (otbor.mjs) + формула (formula-ya.mjs)
// + тексты src/data/nishi/<ключ>.ts. Компании из топ-10 получают карточку; одна компания в нескольких нишах –
// одна карточка (связь по id организаций Яндекса), в том числе со старыми карточками ниш Я+2ГИС.
import { computeYa, TOP } from './formula-ya.mjs';
import { NICHES_YA } from './otbor.mjs';
import { rayon } from './rayony.mjs';
import type { NicheTextYa } from '../data/nishi/tip';
import { COMPANIES } from './reyting';
import { slugify } from './slug';
import { CITY } from './site';

const SRC = import.meta.glob('../data/source/avto/*.json', { eager: true, import: 'default' }) as Record<string, any>;
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
  url: string | null; // карточка на сайте (топ-10 или уже есть карточка)
  entity?: Entity;
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
}

export interface Entity {
  slug: string;
  url: string;
  name: string;
  oldSlug: string | null; // карточка старой ниши (Я+2ГИС)
  rows: YaRow[]; // места в нишах Яндекса, лучшее место первым
  branches: Branch[];
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
  phones: c['телефоны'] || [],
  hours: c['часы'] || '',
  allDay: !!c['круглосуточно'],
  rubrics: c['рубрики'] || [],
  card: c['карточка'],
  good: !!c['хорошее_место'],
  owner: !!c['владелец_подтвердил'],
});

function build(): NicheYa[] {
  return Object.entries(NICHES_YA).map(([key, cfg]: [string, any]) => {
    const src = SRC[`../data/source/avto/${key}.json`];
    if (!src) throw new Error(`Нет съёма ниши ${key}`);
    const t = TXT[`../data/nishi/${key}.ts`];
    if (!t) throw new Error(`Нет текстов ниши ${key}`);
    if (t.key !== key) throw new Error(`Тексты ${key}: key = ${t.key}`);
    const r = computeYa(src, cfg);
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
      };
    });
    return {
      kind: 'ya' as const,
      key,
      url: `/${CITY.slug}/${key}/`,
      t,
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
    };
  });
}

const ALL_YA = build();
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
    const inTop = g.some((r) => r.place <= TOP);
    if (!inTop && !oldSlug) continue;
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
    const e: Entity = { slug, url: `/${CITY.slug}/kompanii/${slug}/`, name: old ? old.t.brand : lead.display, oldSlug, rows: g, branches };
    for (const r of g) {
      r.url = e.url;
      r.entity = e;
    }
    out.push(e);
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

const STATS = { groups: 0, matchedOld: 0 };
export const ENTITIES: Entity[] = entities();

/** Уникальные компании и отзывы Яндекса по всем рейтингам (компания в нескольких нишах – один раз). */
export function uniqueTotals(oldCompanies: { y: { reviews: number; cards: string[] } }[]) {
  const reviews = new Map<string, number>();
  for (const n of NICHES_YA_PUB) for (const r of n.rows) for (const b of r.branches) reviews.set(b.id, b.reviews);
  let yaReviews = [...reviews.values()].reduce((s, x) => s + x, 0);
  for (const c of oldCompanies) if (!c.y.cards.some((u) => reviews.has(idOf(u)!))) yaReviews += c.y.reviews;
  return { companies: STATS.groups + oldCompanies.length - STATS.matchedOld, yaReviews };
}
/** Новые карточки (у компаний старых ниш карточка уже есть – туда добавляются места). */
export const NEW_CARDS: Entity[] = ENTITIES.filter((e) => !e.oldSlug);
export const placesOfOld = (slug: string): YaRow[] => ENTITIES.find((e) => e.oldSlug === slug)?.rows || [];
export const nicheYa = (key: string) => NICHES_YA_PUB.find((n) => n.key === key)!;
