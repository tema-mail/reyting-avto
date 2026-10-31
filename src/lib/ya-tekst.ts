// Тексты из данных для ниш Яндекса: «Кратко», номинации, описание страницы, сильные стороны и замечания карточки.
// Одно правило для всех ниш и компаний – никаких цифр руками.
import type { NicheYa, YaRow, Entity } from './ya';
import { nicheYa, NICHES_YA_PUB } from './ya';
import { num, date, plural, score } from './format';
import { CITY } from './site';

/** Оценка: 4,9 / 5,0, у сетей – до сотых (4,94). */
export function rt(r: number): string {
  const s = Math.abs(r * 10 - Math.round(r * 10)) < 1e-9 ? r.toFixed(1) : r.toFixed(2);
  return s.replace('.', ',');
}
export const otz = (n: number) => `${num(n)} ${plural(n, ['отзыв', 'отзыва', 'отзывов'])}`;
export const whoN = (n: NicheYa, k: number) => `${k} ${plural(k, n.who)}`;
export const filials = (k: number) => `${k} ${plural(k, ['филиал', 'филиала', 'филиалов'])}`;
/** «от 1 500 ₽» */
export const rub = (n: number) => `от ${num(n)} ₽`;

/**
 * Смежные рейтинги с пересекающимся составом (SEO-проверка 28.10): в «Коротко» – ссылка на отдельный рейтинг.
 * Анкор – название ниши-цели, ведёт только на её адрес (одна ниша – один анкор, без каннибализации).
 */
const SEE: Record<string, string[]> = {
  deteyling: ['polirovka-far', 'okleyka-plenkoy', 'khimchistka-salona'],
  'polirovka-far': ['avtosvet', 'deteyling'],
  'okleyka-plenkoy': ['deteyling'],
  avtosvet: ['polirovka-far'],
  avtomoyki: ['khimchistka-salona'],
  'khimchistka-salona': ['avtomoyki'],
  shinomontazh: ['khranenie-shin', 'remont-diskov'],
  'khranenie-shin': ['shinomontazh'],
  'kuzovnoy-remont': ['udalenie-vmyatin'],
  'udalenie-vmyatin': ['kuzovnoy-remont'],
  'remont-dvigateley': ['remont-dizeley', 'remont-turbin'],
  'remont-dizeley': ['remont-dvigateley'],
  avtostekla: ['remont-skolov'],
  'remont-skolov': ['avtostekla'],
};
export function seeAlso(n: NicheYa): string {
  const to = (SEE[n.key] || []).map((k) => NICHES_YA_PUB.find((x) => x.key === k)).filter(Boolean) as NicheYa[];
  if (!to.length) return '';
  const lnk = to.map((x) => `[${x.t.crumb.toLowerCase()}](${x.url})`).join(', ');
  return ` Отдельные рейтинги: ${lnk}.`;
}

export function kratko(n: NicheYa): string {
  const [a, b, c] = n.rows;
  if (a.partner) {
    const others = n.rows.filter((r) => !r.partner);
    const ps = n.rows.filter((r) => r.partner).map((r) => `**${r.display}**`).join(', затем ');
    return `№1 – ${ps}, выбор редакции. Следом – ${others[0].display} (${score(others[0].score)}) и ${others[1].display} (${score(others[1].score)}).`;
  }
  const last = a.last ? `, последний – ${date(a.last)}` : '';
  const net = a.branches.length > 1 ? ` (${filials(a.branches.length)})` : '';
  return `№1 – **${a.display}**${net}: ${score(a.score)} из 10. На Яндекс Картах ${rt(a.rating)} и ${otz(a.reviews)}${last}. Следом – ${b.display} (${score(b.score)}) и ${c.display} (${score(c.score)}).${seeAlso(n)}`;
}

export function description(n: NicheYa): string {
  return `${n.t.crumb} ${CITY.in}: ${whoN(n, n.rows.length)} по оценкам и отзывам Яндекс Карт, №1 – ${n.rows[0].display}${n.rows[0].partner ? '' : ` (${score(n.rows[0].score)}/10)`}.`;
}

export interface Nom { title: string; text: string; rows: YaRow[] }

/** Номинации только из данных; пустых не показываем. */
export function nominations(n: NicheYa): Nom[] {
  const out: Nom[] = [];
  const rows = n.rows;
  const most = [...rows].sort((a, b) => b.reviews - a.reviews)[0];
  out.push({ title: 'Больше всего отзывов', text: `${otz(most.reviews)} на Яндекс Картах${most.branches.length > 1 ? ' у главной точки сети' : ''}.`, rows: [most] });
  const fresh = [...rows].filter((r) => r.recent > 0).sort((a, b) => b.recent - a.recent)[0];
  if (fresh) out.push({ title: 'Свежие отзывы', text: `${otz(fresh.recent)} за 12 месяцев среди загруженных Яндексом – больше всех в рейтинге.`, rows: [fresh] });
  const big = rows.filter((r) => r.reviews >= 50);
  if (big.length) {
    const best = Math.max(...big.map((r) => r.rating));
    const who = big.filter((r) => r.rating === best).slice(0, 3);
    out.push({ title: 'Высшая оценка при 50+ отзывах', text: `${rt(best)} на Яндекс Картах.`, rows: who });
  }
  const allDay = rows.filter((r) => r.allDay);
  if (allDay.length) out.push({ title: 'Круглосуточно', text: allDay.length === 1 ? 'Единственная компания рейтинга с круглосуточной работой по карточке Яндекса.' : `Работают круглосуточно по карточке Яндекса: ${allDay.length}.`, rows: allDay.slice(0, 4) });
  const good = rows.filter((r) => r.good);
  if (good.length) out.push({ title: '«Хорошее место» Яндекса', text: `Отметка есть у ${good.length} из ${rows.length}.`, rows: good.slice(0, 4) });
  const priced = rows.filter((r) => r.prices.length);
  if (priced.length >= 3) out.push({ title: 'Открытые цены', text: `Цены на услуги опубликованы на сайте у ${priced.length} из ${rows.length} по данным сайтов компаний. В балл цены не входят.`, rows: priced.slice(0, 4) });
  return out;
}

/** Признаки строки для фильтров (только скрывают строки, место не меняют). */
export function flags(r: YaRow): string[] {
  const f: string[] = [];
  if (r.allDay) f.push('24');
  if (r.rating >= 4.8) f.push('r48');
  if (r.reviews >= 300) f.push('o300');
  if (r.good) f.push('gp');
  if (r.site) f.push('site');
  if (r.prices.length) f.push('price');
  return f;
}

export const FILTERS: [string, string][] = [
  ['24', 'Круглосуточно'],
  ['r48', 'Оценка 4,8+'],
  ['o300', '300+ отзывов'],
  ['gp', '«Хорошее место»'],
  ['site', 'Есть сайт'],
  ['price', 'Цены на сайте'],
];

// ── Карточка компании ──────────────────────────────

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Описание карточки: что за компания, где, цифры карт (главная точка), места – из данных по одному правилу. */
export function cardLead(e: Entity): string {
  const b = e.branches;
  const m = e.rows[0].branches[0];
  const rubrics = [...new Set(b.flatMap((x) => x.rubrics))].slice(0, 2).map(lower).join(', ');
  const where = b.length > 1 ? `${filials(b.length)} ${CITY.in}, главная точка – ${m.address}` : `${CITY.in}, ${m.address}`;
  const places = e.rows.map((r) => `${r.place}-е место в рейтинге «${nicheYa(r.niche).t.crumb}»`).join(', ');
  const net = b.length > 1 ? ' (главная точка)' : '';
  return `${e.name} – ${rubrics} ${where}. На Яндекс Картах${net} ${rt(m.rating)} по ${num(m.ratings)} ${plural(m.ratings, ['оценке', 'оценкам', 'оценкам'])} и ${otz(m.reviews)}; ${places}.`;
}

export function strengthsYa(e: Entity): string[] {
  const out: string[] = [];
  const r = e.rows[0];
  const n = nicheYa(r.niche);
  if (r.rating >= 4.9) out.push(`${rt(r.rating)} на Яндекс Картах по ${num(r.ratings)} ${plural(r.ratings, ['оценке', 'оценкам', 'оценкам'])}.`);
  if (r.reviews === Math.max(...n.rows.map((x) => x.reviews))) out.push(`Больше всего отзывов в рейтинге «${n.t.crumb}» – ${num(r.reviews)}.`);
  if (r.days !== null && r.days <= 30) out.push(`Свежий отзыв: последний – ${date(r.last!)}.`);
  if (r.recent >= 12) out.push(`${otz(r.recent)} за 12 месяцев среди загруженных Яндексом.`);
  if (r.good) out.push('Отметка Яндекса «Хорошее место».');
  if (r.owner) out.push('Карточку на Яндексе подтвердил владелец.');
  if (r.allDay) out.push('Работает круглосуточно по карточке Яндекса.');
  if (e.branches.length > 1) out.push(`${filials(e.branches.length)} в городе.`);
  if (e.rows.some((x) => x.prices.length)) out.push('Цены на услуги опубликованы на сайте компании.');
  if (e.rows.length > 1) out.push(`Есть в ${e.rows.length} ${plural(e.rows.length, ['рейтинге', 'рейтингах', 'рейтингах'])} сайта.`);
  return out;
}

export function attentionYa(e: Entity): string[] {
  const out: string[] = [];
  const r = e.rows[0];
  if (r.partner) return []; // партнёр: полная карточка без замечаний
  const n = nicheYa(r.niche);
  const top = n.rows.find((x) => !x.partner)!;
  if (r !== top && r.reviews < top.reviews / 3) out.push(`${otz(r.reviews)} – в ${Math.round(top.reviews / Math.max(1, r.reviews))} раз меньше, чем у первого места (${num(top.reviews)}).`);
  if (r.days === null) out.push('Дату последнего отзыва Яндекс не показал – свежесть в балле 0.');
  else if (r.days > 90) out.push(`Последний отзыв – ${date(r.last!)}, больше трёх месяцев до съёма.`);
  if (r.recent < 6) out.push(`За 12 месяцев – ${otz(r.recent)} среди загруженных.`);
  if (r.rating < 4.7) out.push(`Оценка ${rt(r.rating)} – прочитайте свежие отзывы с низкой оценкой.`);
  if (!r.site) out.push('Сайта в карточке Яндекса нет.');
  if (!r.owner) out.push('Карточку на Яндексе владелец не подтвердил.');
  if (!r.hours) out.push('Часы работы в карточке не указаны.');
  return out;
}
