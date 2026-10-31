// Модель ниш «только Яндекс Карты» по городам (01.11.2026: Новосибирск и Краснодар). Сборка ниш – ya-sborka.ts,
// типы – ya-tip.ts. Каждая компания рейтинга получает карточку (каталог 30.10); одна компания в нескольких нишах
// одного города – одна карточка (связь по id организаций Яндекса), в Новосибирске – в том числе со старыми карточками
// ниш Я+2ГИС. Одна и та же компания в двух городах – разные карточки (/<город>/companies/<slug>/).
import { COMPANIES } from './reyting';
import { slugify } from './slug';
import { gorod as gorodBySlug, READY, type Gorod } from './goroda';
import { build, dedupe } from './ya-sborka';
import type { YaRow, NicheYa, Entity } from './ya-tip';

export type { Branch, Price, YaRow, NicheYa, Entity } from './ya-tip';
export { DUP_SHARE } from './ya-sborka';

export interface GorodYa {
  city: Gorod;
  all: NicheYa[];
  pub: NicheYa[]; // опубликованные (5 и больше компаний прошли отбор, не дубль)
  hidden: NicheYa[]; // не прошли порог или дубль – на сайте их нет, причина на /metodika/
  entities: Entity[];
  newCards: Entity[]; // карточки ниш Яндекса (у компаний старых ниш НСК карточка уже есть – туда добавляются места)
  stats: { groups: number; matchedOld: number };
}

const idOf = (url: string) => (url.match(/\/(\d+)\/?$/) || [])[1];
const keyName = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

/** Компании города: объединяем строки разных ниш с общим id организации Яндекса. */
function entities(city: Gorod, pub: NicheYa[], stats: GorodYa['stats']): Entity[] {
  // старые ниши Я+2ГИС (reyting.ts) – только Новосибирск
  const old = city.slug === 'novosibirsk' ? COMPANIES : [];
  const rows = pub.flatMap((n) => n.rows);
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
  for (const c of old) for (const card of c.y.cards) oldById.set(idOf(card)!, c.slug);
  const used = new Set(old.map((c) => c.slug));
  const out: Entity[] = [];
  stats.groups = groups.size;
  stats.matchedOld = new Set([...groups.values()].map((g) => g.flatMap((r) => r.ids).map((id) => oldById.get(id)).find(Boolean)).filter(Boolean)).size;
  const crumb = (k: string) => pub.find((n) => n.key === k)!.t.crumb;
  for (const g of groups.values()) {
    g.sort((a, b) => a.place - b.place || b.score - a.score);
    const oldSlug = g.flatMap((r) => r.ids).map((id) => oldById.get(id)).find(Boolean) || null;
    const branches = [...new Map(g.flatMap((r) => r.branches).map((b) => [b.id, b])).values()];
    const lead = g[0];
    let slug = oldSlug;
    if (!slug) {
      slug = slugify(lead.display);
      if (used.has(slug)) slug = slugify(`${lead.name} ${branches[0].address.split(',').slice(0, 2).join(' ')}`);
      if (used.has(slug)) throw new Error(`Slug «${slug}» занят дважды (${city.name})`);
    }
    used.add(slug);
    const o = oldSlug ? old.find((c) => c.slug === oldSlug)! : null;
    const name = o ? o.t.brand : lead.display;
    // каталог 30.10: карточка у каждой компании рейтинга; в индекс – если есть хоть один отзыв, цены или топ-5
    const index = g.some((r) => r.prices.length > 0 || r.place <= 5 || r.reviews > 0);
    const e: Entity = { city, slug, url: `/${city.slug}/companies/${slug}/`, name, oldSlug, rows: g, branches, label: name, index };
    for (const r of g) {
      r.url = e.url;
      r.entity = e;
    }
    out.push(e);
  }
  // одинаковые названия у разных карточек – в title добавляем улицу главной точки, затем нишу
  const allNames = [...out.filter((e) => !e.oldSlug).map((e) => e.name), ...old.map((c) => c.t.brand)].map(keyName);
  for (const e of out) {
    if (e.oldSlug || allNames.filter((x) => x === keyName(e.name)).length < 2) continue;
    const street = e.branches[0].address.split(',')[0];
    e.label = e.name.includes(street) ? `${e.name}, ${crumb(e.rows[0].niche)}` : `${e.name}, ${street}`;
  }
  const labels = out.map((e) => keyName(e.label));
  for (const e of out) if (labels.filter((x) => x === keyName(e.label)).length > 1) e.label = `${e.label}, ${crumb(e.rows[0].niche).toLowerCase()}`;
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Ссылка из текста ниши на рейтинг, которого в этом городе нет (не снят или не прошёл порог), становится текстом. */
function unlinkMissing(slug: string, pub: NicheYa[]) {
  const keys = new Set(pub.map((n) => n.key));
  const re = new RegExp(`\\[([^\\]]+)\\]\\(/${slug}/([a-z0-9-]+)/\\)`, 'g');
  const fix = (s: string) => s.replace(re, (m, txt, key) => (keys.has(key) ? m : txt));
  for (const n of pub) {
    const t = n.t;
    n.t = { ...t, intro: fix(t.intro), check: t.check.map(fix), faq: t.faq.map(([q, a]) => [fix(q), fix(a)] as [string, string]), hubLine: fix(t.hubLine) };
  }
}

const CACHE = new Map<string, GorodYa>();
/** Рейтинги и карточки города (собираются один раз за сборку). */
export function yaGoroda(slug: string): GorodYa {
  if (CACHE.has(slug)) return CACHE.get(slug)!;
  const city = gorodBySlug(slug);
  const all = dedupe(build(city));
  const pub = all.filter((n) => n.published);
  if (slug !== 'novosibirsk') unlinkMissing(slug, pub);
  const stats = { groups: 0, matchedOld: 0 };
  const ents = entities(city, pub, stats);
  const m: GorodYa = { city, all, pub, hidden: all.filter((n) => !n.published), entities: ents, newCards: ents.filter((e) => !e.oldSlug), stats };
  CACHE.set(slug, m);
  return m;
}

/** Все готовые города (ready в goroda.ts). */
export const YA_GORODA = (): GorodYa[] => READY.map((c) => yaGoroda(c.slug));

/** Ниша города по ключу (только опубликованные). */
export const nicheYa = (key: string, city: string) => yaGoroda(city).pub.find((n) => n.key === key)!;
/** Ниша строки рейтинга. */
export const nicheOf = (r: YaRow) => nicheYa(r.niche, r.city.slug);

/** Уникальные компании и отзывы Яндекса по всем рейтингам города (компания в нескольких нишах – один раз). */
export function uniqueTotals(city: string, oldCompanies: { y: { reviews: number; cards: string[] } }[]) {
  const m = yaGoroda(city);
  const reviews = new Map<string, number>();
  for (const n of m.pub) for (const r of n.rows) reviews.set(r.branches[0].id, r.branches[0].reviews); // в балл идёт главная точка сети
  const all = new Set(m.pub.flatMap((n) => n.rows.flatMap((r) => r.ids)));
  let yaReviews = [...reviews.values()].reduce((s, x) => s + x, 0);
  for (const c of oldCompanies) if (!c.y.cards.some((u) => all.has(idOf(u)!))) yaReviews += c.y.reviews;
  return { companies: m.stats.groups + oldCompanies.length - m.stats.matchedOld, yaReviews };
}

// ── Новосибирск: прежние имена для страниц, которые есть только у него (районы, гиды, старые ниши) ──
const NSK = yaGoroda('novosibirsk');
/** Опубликованные ниши Новосибирска. */
export const NICHES_YA_PUB: NicheYa[] = NSK.pub;
export const NICHES_YA_HIDDEN: NicheYa[] = NSK.hidden;
export const ENTITIES: Entity[] = NSK.entities;
export const NEW_CARDS: Entity[] = NSK.newCards;
export const placesOfOld = (slug: string): YaRow[] => ENTITIES.find((e) => e.oldSlug === slug)?.rows || [];
