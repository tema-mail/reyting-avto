// Тексты ниш написаны для Новосибирска (src/data/nishi). Для другого города – подстановка его названия и
// нейтральные формулировки вместо сибирских: про климат и дороги другого города мы ничего не утверждаем.
// Для Новосибирска текст не меняется. Если после подстановки осталось упоминание Новосибирска или Сибири – сборка падает.
import type { NicheTextYa } from '../data/nishi/tip';
import type { Gorod } from './goroda';

/** Фразы про Сибирь и новосибирский климат → нейтральные (точное совпадение). */
const NEUTRAL: [string, string][] = [
  ['Нужен ли автозапуск в Новосибирске?', 'Нужен ли автозапуск?'],
  ['на новосибирских дорогах', 'на дорогах'],
  ['в новосибирский мороз', 'в мороз'],
  ['В сибирский мороз', 'В мороз'],
  ['Зимой в Сибири с этим', 'Зимой с этим'],
  [', это важно для сибирской зимы', ', это важно зимой'],
  // наблюдения о парке и погоде Новосибирска – для другого города без них
  [' В Новосибирске снег и гололёд часто приходят раньше декабря, поэтому переобуваются обычно по погоде.', ''],
  ['Changan в Новосибирске в основном', 'Changan – в основном'],
  ['Hyundai и Kia – одни из самых частых машин в Новосибирске, и по ним работают', 'По Hyundai и Kia работают'],
  ['Toyota и Lexus в Новосибирске ездят', 'Toyota и Lexus ездят'],
  ['Zeekr в Новосибирске почти всегда', 'Zeekr почти всегда'],
];

export function vGorod(s: string, c: Gorod): string {
  if (c.slug === 'novosibirsk') return s;
  let out = s;
  for (const [a, b] of NEUTRAL) out = out.split(a).join(b);
  out = out
    .replace(/в Новосибирске/g, c.in)
    .replace(/по Новосибирску/g, `по ${c.dat}`)
    .replace(/Новосибирска/g, c.of)
    .replace(/Новосибирск(?![а-яё])/g, c.name)
    // ссылки на соседние рейтинги – на рейтинги своего города (неопубликованные снимает ya.ts)
    .replace(/\]\(\/novosibirsk\//g, `](/${c.slug}/`);
  if (/новосиб|сибир|novosibirsk/i.test(out) || /(^|[^А-ЯЁа-яё])НСК([^А-ЯЁа-яё]|$)/.test(out)) throw new Error(`Текст для города ${c.name} упоминает Новосибирск или Сибирь: «${out}»`);
  return out;
}

export function tekstGoroda(t: NicheTextYa, c: Gorod): NicheTextYa {
  if (c.slug === 'novosibirsk') return t;
  const v = (s: string) => vGorod(s, c);
  return { ...t, h1: v(t.h1), crumb: v(t.crumb), intro: v(t.intro), checkH2: v(t.checkH2), check: t.check.map(v), faq: t.faq.map(([q, a]) => [v(q), v(a)] as [string, string]), hubLine: v(t.hubLine) };
}
