// Все опубликованные рейтинги города одним списком: меню, главная, хаб, карта сайта, соседние ниши.
// Старые ниши (Я+2ГИС, reyting.ts) и ниши Яндекса (ya.ts) приводятся к одному виду.
import { NICHES, COMPANIES, indexable } from './reyting';
import { CITY } from './site';
import { NICHES_YA_PUB, NEW_CARDS, uniqueTotals } from './ya';
import { STATI } from './stati';
import { NICHE_RAYON, RAYON_LIST } from './rayon-stranitsy';
import { AVTOR } from '../data/avtor';
import { GROUPS, GROUP_SLUG, OLD_GROUP } from './otbor.mjs';

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

// Порядок внутри группы – по спросу Вордстата (НСК, сентябрь 2026, docs/nishi-avto-nsk.md в reytingi).
const ORDER = ['avtoshkoly', 'avtoservisy', 'tonirovka', 'evakuatory', 'tekhosmotr', 'shinomontazh', 'avtomoyki', 'chip-tyuning', 'kuzovnoy-remont', 'avtosignalizatsii', 'ustanovka-magnitol', 'avtoelektriki', 'avtopodbor', 'deteyling', 'remont-dvigateley', 'razval-skhozhdenie', 'avtozvuk', 'polirovka-far', 'remont-rulevykh-reek', 'diagnostika-avto', 'remont-akpp', 'avtostekla', 'ustanovka-gbo', 'khimchistka-salona', 'ustanovka-farkopa', 'remont-diskov', 'peretyazhka-salona', 'udalenie-vmyatin', 'shumoizolyatsiya', 'remont-dizeley', 'remont-podveski', 'remont-turbin', 'servis-kitayskikh-avtomobiley', 'remont-elektromobiley-i-gibridov', 'rusifikatsiya-avtomobiley',
  // третья волна: спроса по Вордстату ещё нет – порядок по широте запроса
  'servis-yaponskikh-avtomobiley', 'servis-koreyskikh-avtomobiley', 'servis-nemetskikh-avtomobiley', 'servis-vag', 'remont-avtokonditsionerov', 'remont-tormoznoy-sistemy', 'remont-glushiteley', 'remont-starterov-i-generatorov', 'remont-gruzovikov', 'motoservisy', 'khranenie-shin', 'antikor', 'remont-skolov', 'gruzovoy-shinomontazh', 'okleyka-plenkoy', 'ustanovka-avtozapuska', 'ustanovka-parktronikov', 'avtosvet', 'prokat-avtomobiley', 'vykup-avto', 'avtorazbory', 'avtoekspertiza', 'avtoyuristy'];

const plural = (n: number, f: [string, string, string]) => {
  const a = n % 100;
  const b = a % 10;
  return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2];
};

export const RATINGS: Rating[] = [
  ...NICHES.map((n) => ({
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
  ...NICHES_YA_PUB.map((n) => ({
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

for (const r of RATINGS) if (!GROUPS.includes(r.group) || ORDER.indexOf(r.key) < 0) throw new Error(`Рейтинг ${r.key}: нет группы или места в порядке`);

export const BY_GROUP = GROUPS.map((g) => ({ name: g, slug: (GROUP_SLUG as Record<string, string>)[g], items: RATINGS.filter((r) => r.group === g) })).filter((g) => g.items.length);

/** Соседи по смыслу (SEO-проверка 28.10): та же задача клиента или та же работа. Нет в списке – своя группа. */
const RELATED: Record<string, string[]> = {
  avtoshkoly: ['avtopodbor', 'prokat-avtomobiley', 'tekhosmotr'],
  avtoservisy: ['diagnostika-avto', 'remont-podveski', 'avtoelektriki', 'servis-yaponskikh-avtomobiley'],
  tonirovka: ['deteyling', 'okleyka-plenkoy', 'avtostekla', 'polirovka-far'],
  evakuatory: ['avtoservisy', 'avtoyuristy', 'avtoekspertiza'],
  tekhosmotr: ['avtoservisy', 'diagnostika-avto', 'avtoshkoly'],
  shinomontazh: ['razval-skhozhdenie', 'khranenie-shin', 'remont-diskov', 'gruzovoy-shinomontazh'],
  avtomoyki: ['khimchistka-salona', 'deteyling', 'polirovka-far'],
  'chip-tyuning': ['diagnostika-avto', 'remont-dvigateley', 'ustanovka-gbo'],
  'kuzovnoy-remont': ['udalenie-vmyatin', 'antikor', 'avtostekla', 'avtoekspertiza'],
  avtosignalizatsii: ['ustanovka-avtozapuska', 'ustanovka-magnitol', 'ustanovka-parktronikov', 'avtoelektriki'],
  'ustanovka-magnitol': ['avtozvuk', 'ustanovka-parktronikov', 'avtosignalizatsii', 'shumoizolyatsiya'],
  avtoelektriki: ['diagnostika-avto', 'remont-starterov-i-generatorov', 'avtosignalizatsii', 'avtosvet'],
  avtopodbor: ['avtoekspertiza', 'diagnostika-avto', 'tekhosmotr', 'vykup-avto'],
  deteyling: ['polirovka-far', 'okleyka-plenkoy', 'tonirovka', 'khimchistka-salona'],
  'remont-dvigateley': ['remont-dizeley', 'remont-turbin', 'diagnostika-avto', 'remont-akpp'],
  'razval-skhozhdenie': ['shinomontazh', 'remont-podveski', 'remont-rulevykh-reek'],
  'rusifikatsiya-avtomobiley': ['servis-kitayskikh-avtomobiley', 'remont-elektromobiley-i-gibridov', 'ustanovka-magnitol'],
  avtozvuk: ['shumoizolyatsiya', 'ustanovka-magnitol', 'avtosignalizatsii'],
  'polirovka-far': ['avtosvet', 'deteyling', 'tonirovka'],
  'remont-rulevykh-reek': ['remont-podveski', 'razval-skhozhdenie', 'diagnostika-avto'],
  'diagnostika-avto': ['avtoservisy', 'avtoelektriki', 'remont-dvigateley', 'avtopodbor'],
  'remont-akpp': ['remont-dvigateley', 'diagnostika-avto', 'avtoservisy'],
  avtostekla: ['remont-skolov', 'tonirovka', 'kuzovnoy-remont'],
  'ustanovka-gbo': ['remont-dvigateley', 'chip-tyuning', 'diagnostika-avto'],
  'servis-kitayskikh-avtomobiley': ['servis-koreyskikh-avtomobiley', 'servis-yaponskikh-avtomobiley', 'avtoservisy', 'remont-elektromobiley-i-gibridov'],
  'khimchistka-salona': ['avtomoyki', 'deteyling', 'peretyazhka-salona'],
  'ustanovka-farkopa': ['avtoelektriki', 'avtoservisy', 'ustanovka-parktronikov'],
  'remont-diskov': ['shinomontazh', 'khranenie-shin', 'razval-skhozhdenie'],
  'peretyazhka-salona': ['khimchistka-salona', 'shumoizolyatsiya', 'deteyling'],
  'udalenie-vmyatin': ['kuzovnoy-remont', 'polirovka-far', 'deteyling'],
  shumoizolyatsiya: ['avtozvuk', 'peretyazhka-salona', 'ustanovka-magnitol'],
  'remont-dizeley': ['remont-turbin', 'remont-dvigateley', 'remont-gruzovikov', 'diagnostika-avto'],
  'remont-podveski': ['razval-skhozhdenie', 'remont-rulevykh-reek', 'avtoservisy', 'remont-tormoznoy-sistemy'],
  'remont-turbin': ['remont-dizeley', 'remont-dvigateley', 'diagnostika-avto'],
  'remont-elektromobiley-i-gibridov': ['servis-kitayskikh-avtomobiley', 'avtoelektriki', 'servis-yaponskikh-avtomobiley', 'diagnostika-avto'],
  'servis-yaponskikh-avtomobiley': ['servis-koreyskikh-avtomobiley', 'servis-kitayskikh-avtomobiley', 'avtoservisy', 'remont-elektromobiley-i-gibridov'],
  'servis-koreyskikh-avtomobiley': ['servis-yaponskikh-avtomobiley', 'servis-kitayskikh-avtomobiley', 'avtoservisy'],
  'servis-nemetskikh-avtomobiley': ['servis-vag', 'avtoservisy', 'remont-akpp'],
  'servis-vag': ['servis-nemetskikh-avtomobiley', 'remont-akpp', 'chip-tyuning'],
  'remont-avtokonditsionerov': ['avtoelektriki', 'avtoservisy', 'diagnostika-avto'],
  'remont-starterov-i-generatorov': ['avtoelektriki', 'diagnostika-avto', 'avtoservisy'],
  'remont-glushiteley': ['avtoservisy', 'remont-podveski', 'tekhosmotr'],
  'remont-tormoznoy-sistemy': ['remont-podveski', 'avtoservisy', 'tekhosmotr'],
  'remont-gruzovikov': ['gruzovoy-shinomontazh', 'remont-dizeley', 'remont-turbin'],
  motoservisy: ['avtoservisy', 'khranenie-shin', 'remont-diskov'],
  antikor: ['kuzovnoy-remont', 'deteyling', 'okleyka-plenkoy'],
  'remont-skolov': ['avtostekla', 'tonirovka', 'polirovka-far'],
  'khranenie-shin': ['shinomontazh', 'remont-diskov', 'razval-skhozhdenie'],
  'gruzovoy-shinomontazh': ['shinomontazh', 'remont-gruzovikov', 'evakuatory'],
  avtosvet: ['polirovka-far', 'avtoelektriki', 'tonirovka'],
  'ustanovka-avtozapuska': ['avtosignalizatsii', 'avtoelektriki', 'ustanovka-parktronikov'],
  'ustanovka-parktronikov': ['ustanovka-magnitol', 'avtosignalizatsii', 'ustanovka-avtozapuska'],
  'okleyka-plenkoy': ['deteyling', 'tonirovka', 'polirovka-far'],
  avtoekspertiza: ['avtoyuristy', 'avtopodbor', 'kuzovnoy-remont'],
  avtoyuristy: ['avtoekspertiza', 'evakuatory', 'vykup-avto'],
  'prokat-avtomobiley': ['avtoshkoly', 'evakuatory', 'avtopodbor'],
  avtorazbory: ['vykup-avto', 'avtoservisy', 'kuzovnoy-remont'],
  'vykup-avto': ['avtopodbor', 'avtoekspertiza', 'avtorazbory'],
};

/** 3–4 соседних рейтинга: сначала по смыслу (RELATED), затем своя группа. */
export function neighbours(key: string, n = 4): Rating[] {
  const me = RATINGS.find((r) => r.key === key)!;
  const rel = (RELATED[key] || []).map((k) => RATINGS.find((r) => r.key === k)).filter(Boolean) as Rating[];
  const same = RATINGS.filter((r) => r.key !== key && r.group === me.group && !rel.includes(r));
  return [...rel, ...same].slice(0, n);
}

/** Цифры для главной и хаба – из данных. Компания в нескольких рейтингах считается один раз. */
const U = uniqueTotals(COMPANIES);
export const TOTALS = {
  ratings: RATINGS.length,
  companies: U.companies, // разных компаний во всех рейтингах
  cards: COMPANIES.length + NEW_CARDS.length, // карточек на сайте
  yaReviews: U.yaReviews, // отзывов Яндекс Карт, каждая организация один раз
};

/** Хаб города индексируется с третьего опубликованного рейтинга (карта сайта). */
export const HUB_INDEX_ALL = RATINGS.length >= 3;

/** Индексируемые адреса для sitemap.xml (lastmod = дата съёма, не дата сборки). */
export function indexableAll(): { path: string; lastmod: string }[] {
  const latest = RATINGS.map((r) => r.date).sort().pop()!;
  const old = indexable().filter((p) => p.path !== `/${CITY.slug}/`);
  const ya = NICHES_YA_PUB.map((n) => ({ path: n.url, lastmod: n.date }));
  const cards = NEW_CARDS.filter((e) => e.index).map((e) => ({ path: e.url, lastmod: latest }));
  return [
    ...old.slice(0, 1).map((p) => ({ ...p, lastmod: latest })),
    ...(HUB_INDEX_ALL ? [{ path: `/${CITY.slug}/`, lastmod: latest }] : []),
    ...old.slice(1),
    ...ya,
    ...cards,
    ...STATI.map((s) => ({ path: s.url, lastmod: s.fm.updated || s.fm.date })),
    ...NICHE_RAYON.map((x) => ({ path: x.url, lastmod: x.n.date })),
    ...RAYON_LIST.map((r) => ({ path: r.url, lastmod: latest })),
    ...(STATI.length ? [{ path: AVTOR.url, lastmod: latest }] : []),
  ];
}
