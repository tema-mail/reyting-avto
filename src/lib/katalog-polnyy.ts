// Полный каталог организаций города (владелец 01.11.2026: «чтобы мы видели полностью»): все организации из съёма
// src/data/source/<папка города>/*.json – одна строка на организацию (по id Яндекса), сети склеены как в рейтинге.
// Не берём: закрытые, из других городов (gorod-dannye.mjs), без оценок вовсе.
// В рейтинге – ссылка на место; вне рейтинга – причина из отбора (otbor.mjs + пороги formula-ya.mjs).
// Своя карточка вне рейтинга – только при отзывах ≥ 3, адресе и телефоне или часах; noindex, если отзывов < 10.
import { yaGoroda, type Entity, type Branch } from './ya';
import { COMPANIES as OLD, NICHES as OLD_NICHES, type Company } from './reyting';
import { NICHES_YA, rejectReason, brandKey, GENERIC } from './otbor.mjs';
import { mainBranch, MIN_RATING, MIN_REVIEWS } from './formula-ya.mjs';
import { GOROD_DANNYE } from './gorod-dannye.mjs';
import { gdOf, branchOf } from './ya-sborka';
import { ORDER } from './katalog-poryadok';
import { slugify } from './slug';
import { PARTNERS } from '../data/partnery';
import { gorod as gorodBySlug, type Gorod } from './goroda';
import type { D, J } from '../scripts/katalog-row';

const SRC = import.meta.glob('../data/source/*/*.json', { eager: true, import: 'default' }) as Record<string, any>;

/** Причины «пока не в рейтинге» – по отбору; порядок – от самой близкой к рейтингу. */
export const WHY = ['меньше 10 отзывов', 'оценка ниже 4,0', 'рейтинг по услуге ещё не опубликован', 'не профиль ниш рейтинга'] as const;
export type Why = (typeof WHY)[number];
export const CARD_MIN_REVIEWS = 3; // своя карточка вне рейтинга
export const CARD_INDEX_REVIEWS = MIN_REVIEWS; // меньше – карточка noindex

/** Организация вне рейтинга со своей карточкой /<город>/companies/<slug>/. */
export interface OffCard {
  city: Gorod;
  slug: string;
  url: string;
  name: string;
  branches: Branch[]; // главная точка (больше всего оценок) первой
  niches: string[]; // ключи ниш, где Яндекс её показал
  why: Why;
  index: boolean;
}

/** Строка каталога. */
export interface Row {
  name: string;
  url: string | null; // карточка на сайте; null – своей карточки нет
  address: string;
  more: number; // ещё филиалов
  rayony: string[];
  niches: string[];
  rating: number;
  reviews: number;
  partner: boolean;
  place: { key: string; crumb: string; url: string; place: number; more: number } | null;
  why: Why | null;
}

export interface Polnyy {
  rows: Row[];
  cards: OffCard[];
  crumbs: Record<string, string>; // ключ ниши → название услуги
  stats: { all: number; rated: number; cards: number; noindex: number };
}

const PARTNER_IDS = new Set(Object.values(PARTNERS).map((p) => p.ya.id));
const idOf = (url: string) => (url.match(/\/(\d+)\/?$/) || [])[1];
const isClosed = (c: any) => /closed/i.test(c['статус'] || '');
const groupKey = (c: any) => (GENERIC.test(c['название'].trim()) ? `${brandKey(c['название'])}|${c.id}` : brandKey(c['название']));

/** Причина по одной нише для организации, прошедшей город и статус: те же пороги, что в formula-ya (сеть – по главной точке). */
function reasonsOf(src: any, cfg: any, city: string, rated: Set<string>, published: boolean): Map<string, Why> {
  const out = new Map<string, Why>();
  const groups = new Map<string, any[]>();
  const seen = new Set<string>();
  for (const c of src['компании']) {
    const id = String(c.id);
    if (seen.has(id)) continue;
    seen.add(id);
    if (rejectReason(c, cfg, city)) {
      out.set(id, 'не профиль ниш рейтинга');
      continue;
    }
    const k = groupKey(c);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(c);
  }
  for (const g of groups.values()) {
    const m = mainBranch(g);
    const why: Why = (m['рейтинг'] || 0) < MIN_RATING ? 'оценка ниже 4,0' : (m['отзывов'] || 0) < MIN_REVIEWS ? 'меньше 10 отзывов' : 'рейтинг по услуге ещё не опубликован';
    for (const c of g) if (!rated.has(String(c.id)) || !published) out.set(String(c.id), why);
  }
  return out;
}

const ordinal = (k: string) => (ORDER.indexOf(k) < 0 ? 999 : ORDER.indexOf(k));

function make(slug: string): Polnyy {
  const city = gorodBySlug(slug);
  const gd = gdOf(city);
  const other: RegExp = (GOROD_DANNYE as any)[slug].other;
  const ya = yaGoroda(slug);
  const toBranch = branchOf(gd);
  const old: Company[] = gd.old ? OLD : [];
  const crumbs: Record<string, string> = {};
  for (const n of ya.all) crumbs[n.key] = n.t.crumb;
  for (const n of gd.old ? OLD_NICHES : []) crumbs[n.slug] = n.t.crumb;

  // id → сущность рейтинга (ниши Яндекса) или старая компания (Я+2ГИС, НСК)
  const ent = new Map<string, Entity>();
  for (const e of ya.entities) for (const r of e.rows) for (const id of r.ids) ent.set(String(id), e);
  const oldBy = new Map<string, Company>();
  for (const c of old) for (const card of c.y.cards) if (idOf(card)) oldBy.set(idOf(card)!, c);
  const rated = new Set([...ent.keys(), ...oldBy.keys()]);

  // все организации съёма города: ниши, где найдена, и причина по каждой
  const orgs = new Map<string, { c: any; niches: Set<string>; why: Set<Why> }>();
  const dir = `../data/source/${gd.dir}/`;
  for (const [path, src] of Object.entries(SRC)) {
    if (!path.startsWith(dir)) continue;
    const key = src['ключ'] || path.slice(dir.length, -5);
    const cfg = (NICHES_YA as any)[key];
    if (!cfg) continue;
    const pub = ya.pub.some((n) => n.key === key);
    const why = reasonsOf(src, cfg, slug, rated, pub);
    for (const c of src['компании']) {
      const id = String(c.id);
      if (isClosed(c) || other.test(c['адрес'] || '') || !c['рейтинг'] || !c['оценок']) continue;
      if (!orgs.has(id)) orgs.set(id, { c, niches: new Set(), why: new Set() });
      const o = orgs.get(id)!;
      o.niches.add(key);
      if (why.has(id)) o.why.add(why.get(id)!);
    }
  }

  // строки рейтинга: сущности и старые компании без сущности
  const rows: Row[] = [];
  const entExtra = new Map<Entity, Set<string>>(); // филиалы той же сети вне рейтинга
  const entNiches = new Map<Entity, Set<string>>();
  const entBrand = new Map<string, Entity | null>();
  for (const e of ya.entities) {
    for (const r of e.rows) {
      const k = groupKey({ id: r.ids[0], 'название': r.name });
      if (k.includes('|')) continue;
      entBrand.set(k, entBrand.has(k) && entBrand.get(k) !== e ? null : e); // одно имя у двух карточек – не склеиваем
    }
  }
  const free = new Map<string, { c: any; niches: Set<string>; why: Set<Why> }[]>();
  for (const [id, o] of orgs) {
    const e = ent.get(id);
    if (e) {
      if (!entNiches.has(e)) entNiches.set(e, new Set());
      o.niches.forEach((k) => entNiches.get(e)!.add(k));
      continue;
    }
    if (oldBy.has(id)) continue;
    const k = groupKey(o.c);
    const be = entBrand.get(k);
    if (be) {
      if (!entExtra.has(be)) entExtra.set(be, new Set());
      entExtra.get(be)!.add(id);
      if (!entNiches.has(be)) entNiches.set(be, new Set());
      o.niches.forEach((n) => entNiches.get(be)!.add(n));
      continue;
    }
    if (!free.has(k)) free.set(k, []);
    free.get(k)!.push(o);
  }

  for (const e of ya.entities) {
    const oldC = e.oldSlug ? old.filter((c) => c.slug === e.oldSlug) : [];
    const best = e.rows[0];
    const niches = [...new Set([...e.rows.map((r) => r.niche), ...oldC.map((c) => c.niche), ...(entNiches.get(e) || [])])].sort((a, b) => ordinal(a) - ordinal(b));
    const branches = e.branches.length + (entExtra.get(e)?.size || 0);
    rows.push({
      name: e.label,
      url: e.url,
      address: e.rows[0].branches[0].address,
      more: branches - 1,
      rayony: [...new Set(e.branches.map((x) => x.rayon).filter(Boolean))],
      niches,
      rating: best.rating,
      reviews: Math.max(...e.rows.map((r) => r.reviews)),
      partner: e.rows.some((r) => r.partner) || e.branches.some((b) => PARTNER_IDS.has(String(b.id))),
      place: { key: best.niche, crumb: crumbs[best.niche], url: `/${slug}/${best.niche}/`, place: best.place, more: e.rows.length - 1 + oldC.length },
      why: null,
    });
  }
  const seenOld = new Set<string>();
  for (const c of old) {
    if (ya.entities.some((e) => e.oldSlug === c.slug) || seenOld.has(c.slug)) continue;
    seenOld.add(c.slug);
    const same = old.filter((x) => x.slug === c.slug).sort((a, b) => a.place - b.place);
    const extra = new Set(c.y.cards.map(idOf).filter(Boolean).flatMap((id) => [...(orgs.get(id!)?.niches || [])]));
    rows.push({
      name: c.t.brand,
      url: c.url,
      address: c.addresses[0] || '',
      more: Math.max(0, c.addresses.length - 1),
      rayony: [],
      niches: [...new Set([...same.map((x) => x.niche), ...extra])].sort((a, b) => ordinal(a) - ordinal(b)),
      rating: c.y.rating,
      reviews: c.y.reviews,
      partner: same.some((x) => !!x.partner),
      place: { key: same[0].niche, crumb: crumbs[same[0].niche], url: `/${slug}/${same[0].niche}/`, place: same[0].place, more: same.length - 1 },
      why: null,
    });
  }
  const rated0 = rows.length;

  // вне рейтинга: сеть (одно название) – одна строка, цифры по главной точке
  const used = new Set<string>([...ya.entities.map((e) => e.slug), ...old.map((c) => c.slug)]);
  const cards: OffCard[] = [];
  const slugFor = (name: string, addr: string, id: string) => {
    const tries = [() => slugify(name), () => slugify(`${name} ${addr.split(',').slice(0, 2).join(' ')}`), () => `${slugify(name) || 'kompaniya'}-${id}`];
    for (const t of tries) {
      let s = '';
      try {
        s = t();
      } catch {
        continue;
      }
      if (s && !used.has(s)) return s;
    }
    throw new Error(`Каталог ${slug}: не подобрать адрес карточки «${name}»`);
  };
  for (const [k, list] of free) {
    const main = mainBranch(list.map((o) => o.c));
    const ordered = [main, ...list.map((o) => o.c).filter((c) => c !== main)];
    const branches = ordered.map(toBranch);
    const niches = [...new Set(list.flatMap((o) => [...o.niches]))].sort((a, b) => ordinal(a) - ordinal(b));
    const whys = new Set(list.flatMap((o) => [...o.why]));
    const why = WHY.find((w) => whys.has(w)) || 'не профиль ниш рейтинга';
    const b = branches[0];
    const generic = k.includes('|');
    const name = generic ? `${b.name} (${b.address.split(',').slice(0, 2).join(',').trim()})` : b.name;
    let url: string | null = null;
    if (b.reviews >= CARD_MIN_REVIEWS && b.address && (b.phones.length > 0 || b.hours || b.allDay)) {
      const s = slugFor(b.name, b.address, String(b.id));
      used.add(s);
      url = `/${slug}/companies/${s}/`;
      cards.push({ city, slug: s, url, name, branches, niches, why, index: b.reviews >= CARD_INDEX_REVIEWS });
    }
    rows.push({ name, url, address: b.address, more: branches.length - 1, rayony: [...new Set(branches.map((x) => x.rayon).filter(Boolean))], niches, rating: b.rating, reviews: b.reviews, partner: false, place: null, why });
  }
  rows.sort((a, b) => b.reviews - a.reviews || a.name.localeCompare(b.name, 'ru'));
  return { rows, cards, crumbs, stats: { all: rows.length, rated: rated0, cards: cards.length, noindex: cards.filter((c) => !c.index).length } };
}

const CACHE = new Map<string, Polnyy>();
/** Полный каталог готового города (собирается один раз за сборку). */
export function polnyy(slug: string): Polnyy {
  if (!CACHE.has(slug)) CACHE.set(slug, make(slug));
  return CACHE.get(slug)!;
}

/** Каталог города компактно (scripts/katalog-row.ts): и в первых строках HTML, и в /<город>/catalog.json. */
export function toD(slug: string): D {
  const p = polnyy(slug);
  const keys = Object.keys(p.crumbs).filter((k) => p.rows.some((r) => r.niches.includes(k))).sort((a, b) => ordinal(a) - ordinal(b));
  const rayony = [...new Set(p.rows.flatMap((r) => r.rayony))].sort((a, b) => a.localeCompare(b, 'ru'));
  const ki = new Map(keys.map((k, i) => [k, i]));
  const ri = new Map(rayony.map((k, i) => [k, i]));
  const rows = p.rows.map((r): J => [
    r.name, r.url || '', r.address, r.more, r.rayony.map((x) => ri.get(x)!), r.niches.map((k) => ki.get(k)!), r.rating, r.reviews, r.partner ? 1 : 0,
    r.place ? [ki.get(r.place.key)!, r.place.place, r.place.more] : WHY.indexOf(r.why!),
  ]);
  return { keys, crumbs: keys.map((k) => p.crumbs[k]), rayony, why: [...WHY], city: slug, rows };
}
