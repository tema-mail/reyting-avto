// Модель данных сайта: съём (src/data/source) + формула (formula.mjs) + тексты (src/data/teksty-*).
// Один источник для видимого текста, таблиц и разметки JSON-LD.
import magnSrc from '../data/source/ustanovka-magnitol.json';
import kitSrc from '../data/source/servis-kitayskikh-avtomobiley.json';
import { computeNiche } from './formula.mjs';
import { magnitoly } from '../data/teksty-magnitoly';
import { kitayskie } from '../data/teksty-kitayskie';
import type { NicheTexts, CompanyTexts } from '../data/tipy';
import { slugify } from './slug';
import { CITY } from './site';
import { md } from './md';
import { partnersOf, type Partner } from '../data/partnery';

export interface Company {
  id: string; // название в съёме
  slug: string;
  url: string; // /novosibirsk/companies/<slug>/
  t: CompanyTexts;
  niche: string;
  place: number;
  score: number;
  raw: number;
  parts: { rating: number; reviews: number; fresh: number; open: number; profile: number };
  rating: number; // средняя Я+2ГИС
  reviews: number; // текстовые Я + 2ГИС
  days: number;
  recent: number;
  status: number;
  dealer: boolean;
  addresses: string[];
  phones: string[];
  site: string | null;
  siteWorks: boolean;
  hours: string;
  rubrics: string;
  brands: string | null;
  officialStatus: string | null;
  prices: string[];
  pricesNote: string;
  pricesOnSite: boolean;
  y: { rating: number; ratings: number; reviews: number; last: string; recent: number; goodPlace: boolean; ownerConfirmed: boolean; cards: string[] };
  g: { rating: number; reviews: number; cards: string[] };
  partner?: boolean; // выбор редакции: закреплён первым (data/partnery.ts)
}

export interface Niche {
  slug: string;
  url: string;
  t: NicheTexts;
  date: string;
  companies: Company[];
  reviews: number;
  points: number;
}

const SOURCES = [
  { src: magnSrc as any, t: magnitoly, exclude: [] as string[] },
  { src: kitSrc as any, t: kitayskie, exclude: ['Tesla_N (Тесла Н)', 'EV Sibir / Evolution Car Service'] },
];

function build(): Niche[] {
  return SOURCES.map(({ src, t, exclude }) => {
    const rows = computeNiche(src['компании'], { niche: t.slug, date: src['дата_съёма'], exclude });
    const companies: Company[] = rows.map((r: any) => {
      const c = r.c;
      const texts = t.companies[c['название']];
      if (!texts) throw new Error(`Нет текста для компании «${c['название']}» в нише ${t.slug}`);
      const slug = slugify(texts.brand);
      const y = c['яндекс'];
      const g = c['2гис'];
      return {
        id: c['название'],
        slug,
        url: `/${CITY.slug}/companies/${slug}/`,
        t: texts,
        niche: t.slug,
        place: r.place,
        score: r.score,
        raw: r.raw,
        parts: r.parts,
        rating: r.rating,
        reviews: r.reviews,
        days: r.days,
        recent: r.recent,
        status: r.status,
        dealer: r.profile === 1 && t.slug === 'servis-kitayskikh-avtomobiley',
        addresses: c['адреса'],
        phones: String(c['телефон'] || '').split(/;\s*/).filter(Boolean),
        site: c['сайт'] || null,
        siteWorks: !!c['сайт_работает'],
        hours: c['часы'] || '',
        rubrics: c['рубрики'] || '',
        brands: c['марки'] || null,
        officialStatus: c['официальный_статус'] || null,
        prices: c['цены_от'] || [],
        pricesNote: c['цены_примечание'] || '',
        pricesOnSite: !!c['цены_на_сайте'],
        y: {
          rating: y['рейтинг'],
          ratings: y['оценок'],
          reviews: y['текстовых_отзывов'],
          last: y['последний_отзыв'],
          recent: y['отзывов_за_12_мес_из_загруженных'],
          goodPlace: !!y['хорошее_место_2026'],
          ownerConfirmed: !!y['владелец_подтвердил'],
          cards: y['карточки'] || [],
        },
        g: { rating: g['рейтинг'], reviews: g['отзывов'], cards: g['карточки'] || [] },
      };
    });
    pinOld(t.slug, companies, src);
    return {
      slug: t.slug,
      url: `/${CITY.slug}/${t.slug}/`,
      t,
      date: src['дата_съёма'],
      companies,
      reviews: companies.reduce((s, c) => s + c.reviews, 0),
      points: companies.reduce((s, c) => s + c.addresses.length, 0),
    };
  });
}

/** Выбор редакции в старых нишах: партнёр первым, цифры карт – из съёма; остальные сдвигаются вниз. */
function pinOld(niche: string, companies: Company[], src: any) {
  const pinned = partnersOf(niche, 'novosibirsk').map((p: Partner) => {
    const i = companies.findIndex((c) => c.y.cards.some((h) => h.includes(p.ya.id)));
    if (i >= 0) return { ...companies.splice(i, 1)[0], phones: [p.phone], partner: true };
    const c = src['компании'].find((x: any) => (x['яндекс']['карточки'] || []).some((h: string) => h.includes(p.ya.id)));
    const y = c ? c['яндекс'] : null;
    const g = c ? c['2гис'] : { рейтинг: 0, отзывов: 0, карточки: [] };
    const slug = slugify(p.name);
    const co: Company = {
      id: p.name, slug, url: `/${CITY.slug}/companies/${slug}/`,
      t: { name: p.name, brand: p.name, cells: ['независимый', c?.['марки'] || 'электромобили и гибриды', c?.['часы'] || p.ya.hours || 'по записи', c?.['цены_на_сайте'] ? 'на сайте' : 'нет'], pros: p.services, fit: p.about },
      niche, place: 0, score: NaN, raw: NaN, // в съёме ниши компании не было – балла нет, на сайте «–»
      parts: { rating: 0, reviews: 0, fresh: 0, open: 0, profile: 0 },
      rating: p.ya.rating, reviews: p.ya.reviews + (g['отзывов'] || 0), days: 0, recent: p.ya.recent, status: 0, dealer: false,
      addresses: [p.address], phones: [p.phone], site: p.site, siteWorks: true, hours: c?.['часы'] || p.ya.hours,
      rubrics: c?.['рубрики'] || '', brands: c?.['марки'] || null, officialStatus: null,
      prices: c?.['цены_от'] || [], pricesNote: c?.['цены_примечание'] || '', pricesOnSite: !!c?.['цены_на_сайте'],
      y: { rating: p.ya.rating, ratings: p.ya.ratings, reviews: p.ya.reviews, last: p.ya.last || '', recent: p.ya.recent, goodPlace: false, ownerConfirmed: false, cards: y?.['карточки'] || (p.yandex ? [p.yandex] : []) },
      g: { rating: g['рейтинг'] || 0, reviews: g['отзывов'] || 0, cards: g['карточки'] || [] },
      partner: true,
    };
    return co;
  });
  companies.unshift(...pinned);
  companies.forEach((c, i) => (c.place = i + 1));
}

export const NICHES: Niche[] = build();

/** Все компании города (у каждой одна карточка; рейтинги ссылаются на неё). */
export const COMPANIES: Company[] = (() => {
  const all = NICHES.flatMap((n) => n.companies);
  const seen = new Map<string, Company>();
  for (const c of all) {
    if (seen.has(c.slug)) throw new Error(`Slug «${c.slug}» занят дважды – добавить улицу по правилу карты`);
    seen.set(c.slug, c);
  }
  return all;
})();

export const nicheOf = (c: Company) => NICHES.find((n) => n.slug === c.niche)!;

/** Пары соседей с одинаковым баллом в десятых – подпись под таблицей (порядок решают сотые). */
export function ties(n: Niche): [Company, Company][] {
  const out: [Company, Company][] = [];
  for (let i = 1; i < n.companies.length; i++) {
    const a = n.companies[i - 1];
    const b = n.companies[i];
    if (a.score === b.score) out.push([a, b]);
  }
  return out;
}

/** Подставляет баллы формулы в тексты: {s:<название в съёме>} → «8,5». */
export function fill(text: string): string {
  return text.replace(/\{s:(.+?)\}/g, (_m, id) => {
    const c = COMPANIES.find((x) => x.id === id);
    if (!c) throw new Error(`fill: нет компании «${id}»`);
    return (Math.round(c.score * 10) / 10).toFixed(1).replace('.', ',');
  });
}

/** Текст для разметки: без пометок «подтвердить» и без **. */
export const plain = (s: string) => fill(s).replace(/\s*\{\?.+?\?\}/g, '').replace(/\*\*/g, '');

/** md() с подстановкой баллов */
export const mdf = (s: string) => md(fill(s));

/** Хаб города индексируется с третьего опубликованного рейтинга (карта сайта). */
export const HUB_INDEX = NICHES.length >= 3;

/** Индексируемые адреса – для sitemap.xml (lastmod = дата съёма, не дата сборки). */
export function indexable(): { path: string; lastmod: string }[] {
  const d = NICHES[0].date;
  return [
    { path: '/', lastmod: d },
    ...(HUB_INDEX ? [{ path: `/${CITY.slug}/`, lastmod: d }] : []),
    ...NICHES.map((n) => ({ path: n.url, lastmod: n.date })),
    ...COMPANIES.map((c) => ({ path: c.url, lastmod: nicheOf(c).date })),
    { path: '/metodika/', lastmod: d },
    { path: '/o-proekte/', lastmod: d },
    { path: '/dobavit-kompaniyu/', lastmod: d },
    { path: '/politika-konfidentsialnosti/', lastmod: d },
    { path: '/soglasie-na-obrabotku-dannykh/', lastmod: d },
  ];
}
