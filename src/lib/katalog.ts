// Все опубликованные рейтинги города одним списком: меню, главная, хаб, карта сайта, соседние ниши.
// Старые ниши (Я+2ГИС, reyting.ts – только Новосибирск) и ниши Яндекса (ya.ts) приводятся к одному виду.
// С 01.11.2026 городов несколько: katalog(<город>); прежние имена (RATINGS, BY_GROUP, …) – Новосибирск.
import { NICHES, COMPANIES, indexable } from './reyting';
import { yaGoroda, uniqueTotals } from './ya';
import { READY } from './goroda';
import { STATI } from './stati';
import { NICHE_RAYON, RAYON_LIST } from './rayon-stranitsy';
import { AVTOR } from '../data/avtor';
import { GROUPS, GROUP_SLUG, OLD_GROUP } from './otbor.mjs';
import { ORDER, RELATED } from './katalog-poryadok';

export interface Rating {
  key: string;
  url: string;
  crumb: string;
  h1: string;
  group: string;
  count: number; // компаний в рейтинге
  who: string; // «12 центров»
  top: { name: string; score: number; url: string | null; partner?: boolean };
  date: string;
  reviews: number;
  hubLine: string;
  source: string; // «Яндекс Карты» или «Яндекс Карты и 2ГИС»
}

const plural = (n: number, f: [string, string, string]) => {
  const a = n % 100;
  const b = a % 10;
  return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2];
};

export interface Katalog {
  ratings: Rating[];
  byGroup: { name: string; slug: string; items: Rating[] }[];
  neighbours: (key: string, n?: number) => Rating[];
  totals: { ratings: number; companies: number; cards: number; yaReviews: number };
  hubIndexAll: boolean;
}

function make(city: string): Katalog {
  const ya = yaGoroda(city);
  const old = city === 'novosibirsk' ? NICHES : [];
  const oldCompanies = city === 'novosibirsk' ? COMPANIES : [];
  const ratings: Rating[] = [
    ...old.map((n) => ({
      key: n.slug,
      url: n.url,
      crumb: n.t.crumb,
      h1: n.t.h1,
      group: (OLD_GROUP as Record<string, string>)[n.slug],
      count: n.companies.length,
      who: `${n.companies.length} ${n.t.whoGen}`,
      top: { name: n.companies[0].t.brand, score: n.companies[0].score, url: n.companies[0].url, partner: !!n.companies[0].partner },
      date: n.date,
      reviews: n.reviews,
      hubLine: n.t.hubScenario,
      source: 'Яндекс Карты и 2ГИС',
    })),
    ...ya.pub.map((n) => ({
      key: n.key,
      url: n.url,
      crumb: n.t.crumb,
      h1: n.t.h1,
      group: n.group,
      count: n.rows.length,
      who: `${n.rows.length} ${plural(n.rows.length, n.who)}`,
      top: { name: n.rows[0].display, score: n.rows[0].score, url: n.rows[0].url, partner: !!n.rows[0].partner },
      date: n.date,
      reviews: n.reviews,
      hubLine: n.t.hubLine,
      source: 'Яндекс Карты',
    })),
  ].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  for (const r of ratings) if (!GROUPS.includes(r.group) || ORDER.indexOf(r.key) < 0) throw new Error(`Рейтинг ${city}/${r.key}: нет группы или места в порядке`);
  const byGroup = GROUPS.map((g) => ({ name: g, slug: (GROUP_SLUG as Record<string, string>)[g], items: ratings.filter((r) => r.group === g) })).filter((g) => g.items.length);
  /** 3–4 соседних рейтинга: сначала по смыслу (RELATED), затем своя группа. */
  const neighbours = (key: string, n = 4): Rating[] => {
    const me = ratings.find((r) => r.key === key)!;
    const rel = (RELATED[key] || []).map((k) => ratings.find((r) => r.key === k)).filter(Boolean) as Rating[];
    const same = ratings.filter((r) => r.key !== key && r.group === me.group && !rel.includes(r));
    return [...rel, ...same].slice(0, n);
  };
  // цифры для главной и хаба – из данных; компания в нескольких рейтингах считается один раз
  const U = uniqueTotals(city, oldCompanies);
  return {
    ratings,
    byGroup,
    neighbours,
    totals: { ratings: ratings.length, companies: U.companies, cards: oldCompanies.length + ya.newCards.length, yaReviews: U.yaReviews },
    hubIndexAll: ratings.length >= 3, // хаб города индексируется с третьего опубликованного рейтинга
  };
}
const CACHE = new Map<string, Katalog>();
export function katalog(city: string): Katalog {
  if (!CACHE.has(city)) CACHE.set(city, make(city));
  return CACHE.get(city)!;
}

// ── Новосибирск: прежние имена ──
const NSK = katalog('novosibirsk');
export const RATINGS = NSK.ratings;
export const BY_GROUP = NSK.byGroup;
export const neighbours = NSK.neighbours;
export const TOTALS = NSK.totals;
export const HUB_INDEX_ALL = NSK.hubIndexAll;

/** Индексируемые адреса для sitemap.xml (lastmod = дата съёма, не дата сборки). Все готовые города. */
export function indexableAll(): { path: string; lastmod: string }[] {
  const out: { path: string; lastmod: string }[] = [];
  for (const c of READY) {
    const k = katalog(c.slug);
    const ya = yaGoroda(c.slug);
    if (!k.ratings.length) continue;
    const latest = k.ratings.map((r) => r.date).sort().pop()!;
    const hub = k.hubIndexAll ? [{ path: `/${c.slug}/`, lastmod: latest }] : [];
    const yaPages = ya.pub.map((n) => ({ path: n.url, lastmod: n.date }));
    const cards = ya.newCards.filter((e) => e.index).map((e) => ({ path: e.url, lastmod: latest }));
    if (c.slug !== 'novosibirsk') {
      out.push(...hub, ...yaPages, ...cards);
      continue;
    }
    // Новосибирск: главная и общие страницы, старые ниши, гиды и районы – как до 01.11.2026
    const old = indexable().filter((p) => p.path !== `/${c.slug}/`);
    out.unshift(
      ...old.slice(0, 1).map((p) => ({ ...p, lastmod: latest })),
      ...hub,
      ...old.slice(1),
      ...yaPages,
      ...cards,
      ...STATI.map((s) => ({ path: s.url, lastmod: s.fm.updated || s.fm.date })),
      ...NICHE_RAYON.map((x) => ({ path: x.url, lastmod: x.n.date })),
      ...RAYON_LIST.map((r) => ({ path: r.url, lastmod: latest })),
      ...(STATI.length ? [{ path: AVTOR.url, lastmod: latest }] : []),
    );
  }
  return out;
}
