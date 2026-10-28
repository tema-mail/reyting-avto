// Сильные стороны и «на что обратить внимание» для карточки – только из полей съёма, по одному правилу
// для всех компаний (текст карточки не копирует описание из рейтинга – карта сайта, каннибализация).
import type { Company } from './reyting';
import { nicheOf } from './reyting';
import { rating, num, date, plural } from './format';

export function strengths(c: Company): string[] {
  const n = nicheOf(c);
  const out: string[] = [];
  const best = Math.max(...n.companies.map((x) => x.reviews));
  if (c.officialStatus) out.push(`Статус: ${c.officialStatus}.`);
  if (c.y.rating >= 4.9) out.push(`${rating(c.y.rating)} на Яндекс Картах по ${num(c.y.ratings)} ${plural(c.y.ratings, ['оценке', 'оценкам', 'оценкам'])}.`);
  if (c.g.rating >= 4.9) out.push(`${rating(c.g.rating)} в 2ГИС по ${num(c.g.reviews)} ${plural(c.g.reviews, ['отзыву', 'отзывам', 'отзывам'])}.`);
  if (c.reviews === best) out.push(`Больше всего отзывов в рейтинге «${n.t.crumb}» – ${num(c.reviews)}.`);
  if (c.days <= 30) out.push(`Свежий отзыв: последний на Яндексе – ${date(c.y.last)}.`);
  if (c.y.recent >= 12) out.push(`${c.y.recent} ${plural(c.y.recent, ['отзыв', 'отзыва', 'отзывов'])} на Яндексе за 12 месяцев среди загруженных.`);
  if (c.y.goodPlace) out.push('Отметка Яндекса «Хорошее место 2026».');
  if (c.y.ownerConfirmed) out.push('Карточку на Яндексе подтвердил владелец.');
  if (c.prices.length) out.push('Цены на сайте открыты.');
  if (/ежедневно/i.test(c.hours)) out.push('Работает ежедневно.');
  if (c.addresses.length > 1) out.push(`${c.addresses.length} точки в городе.`);
  return out;
}

export function attention(c: Company): string[] {
  const n = nicheOf(c);
  const out: string[] = [];
  const top = n.companies[0];
  if (c.reviews < top.reviews / 3) out.push(`${num(c.reviews)} ${plural(c.reviews, ['отзыв', 'отзыва', 'отзывов'])} на двух картах – в ${Math.round(top.reviews / c.reviews)} раз меньше, чем у первого места (${num(top.reviews)}).`);
  if (c.days > 90) out.push(`Последний отзыв на Яндексе – ${date(c.y.last)}, больше трёх месяцев до съёма.`);
  if (c.y.recent < 6) out.push(`За 12 месяцев на Яндексе – ${c.y.recent} ${plural(c.y.recent, ['отзыв', 'отзыва', 'отзывов'])} среди загруженных.`);
  if (c.y.rating < 4.8) out.push(`Оценка на Яндексе ${rating(c.y.rating)} – прочитайте свежие отзывы с низкой оценкой.`);
  if (!c.site) out.push('Сайта в карточке на картах нет.');
  else if (!c.prices.length) out.push('Цен услуг на сайте мы не нашли – спросите по телефону.');
  if (!c.y.ownerConfirmed) out.push('Карточку на Яндексе владелец не подтвердил.');
  if (!/ежедневно|сб|вс/i.test(c.hours)) out.push(`Работает только по будням: ${c.hours.replace(/^пн–пт\s*/i, '')}.`);
  return out;
}
