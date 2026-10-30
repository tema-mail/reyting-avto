// Каталог 30.10.2026: рейтинг ниши в районе /novosibirsk/<ниша>/<район>/ и хаб района /novosibirsk/districts/<район>/.
// Страница «ниша × район» есть, только если в районе не меньше MIN_V_RAYONE компаний рейтинга – иначе это пустой
// дубль городского рейтинга (правило «не дорвеи»). Места в таблице – городские, порядок тот же.
import { NICHES_YA_PUB, type NicheYa, type YaRow } from './ya';
import { RAYONY } from './rayony.mjs';
import { slugify } from './slug';
import { CITY } from './site';
import { TOP } from './formula-ya.mjs';

export const MIN_V_RAYONE = 5;

export interface Rayon {
  name: string; // «Ленинский»
  slug: string; // leninskiy
  in: string; // «в Ленинском районе»
  url: string; // хаб района
}

export const RAYON_LIST: Rayon[] = (RAYONY as string[]).map((name) => ({
  name,
  slug: slugify(name),
  in: `в ${name.replace(/(ый|ий)$/, 'ом')} районе`,
  url: `/${CITY.slug}/districts/${slugify(name)}/`,
}));

export interface NicheRayon {
  n: NicheYa;
  r: Rayon;
  url: string;
  rows: YaRow[]; // компании рейтинга с точкой в районе, по городскому месту
  sub: NicheYa; // ниша с урезанными строками – для YaTable
}

export const NICHE_RAYON: NicheRayon[] = NICHES_YA_PUB.flatMap((n) =>
  RAYON_LIST.map((r) => {
    const rows = n.rows.filter((x) => x.rayony.includes(r.name));
    const sub: NicheYa = { ...n, rows, top: rows.slice(0, TOP), rest: rows.slice(TOP), reviews: rows.reduce((s, x) => s + x.reviews, 0) };
    return { n, r, url: `/${CITY.slug}/${n.key}/${r.slug}/`, rows, sub };
  }).filter((x) => x.rows.length >= MIN_V_RAYONE),
);

export const rayonyOf = (key: string) => NICHE_RAYON.filter((x) => x.n.key === key);
export const nichesIn = (slug: string) => NICHE_RAYON.filter((x) => x.r.slug === slug);
