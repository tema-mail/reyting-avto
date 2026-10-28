// Формула ниш «только Яндекс Карты» (владелец 28.10.2026, одинакова на обоих сайтах). Без зависимостей:
// её же вызывает scripts/proverka-ya.mjs.
//
// балл = 10 × (0,35·норм.оценка + 0,35·норм.log10(1 + отзывы) + 0,15·свежесть + 0,15·открытость)
// норм. – min-max внутри опубликованного списка ниши;
// свежесть = 0,5·max(0; 1 − дней с последнего отзыва/365) + 0,5·min(1; отзывов за 12 мес./12), отсчёт от даты съёма;
//   нет даты – свежесть 0 и пометка;
// открытость = 0,25·сайт + 0,25·часы + 0,25·владелец подтвердил + 0,25·«Хорошее место».
// Отбор: профиль по рубрикам (otbor.mjs), не закрыта, оценка ≥ 4,0, отзывов ≥ 10. Сеть (одно название) – одна строка,
// балл и пороги – по главной точке (больше всего оценок), остальные филиалы – списком адресов.

import { rejectReason, brandKey, GENERIC } from './otbor.mjs';

export const W_YA = { rating: 0.35, reviews: 0.35, fresh: 0.15, open: 0.15 };
export const MIN_RATING = 4.0;
export const MIN_REVIEWS = 10;
export const MIN_PUBLISH = 5;
export const TOP = 20;

const DAY = 86400000;
const street = (addr) => addr.split(',').slice(0, 2).join(',').replace(/, Новосибирск$/, '').trim();

/** Свежесть по дате последнего отзыва и числу отзывов за 12 месяцев. */
export function freshness(last, recent, at) {
  if (!last) return { fresh: 0, days: null };
  const days = Math.round((at - new Date(last + 'T00:00:00Z').getTime()) / DAY);
  return { fresh: 0.5 * Math.max(0, 1 - days / 365) + 0.5 * Math.min(1, recent / 12), days };
}

/** Главная точка сети – филиал с наибольшим числом оценок (при равенстве – больше отзывов, затем меньший id). */
export function mainBranch(branches) {
  return [...branches].sort((a, b) => (b['оценок'] || 0) - (a['оценок'] || 0) || (b['отзывов'] || 0) - (a['отзывов'] || 0) || String(a.id).localeCompare(String(b.id)))[0];
}

/**
 * Строка рейтинга бренда (решение 28.10.2026 «сети – по главной точке»): все цифры балла – по главной точке,
 * остальные филиалы только перечисляются. branches[0] – главная точка.
 */
function merge(all) {
  const main = mainBranch(all);
  const branches = [main, ...all.filter((b) => b !== main)];
  return {
    name: main['название'],
    branches,
    ids: branches.map((b) => b.id),
    rating: main['рейтинг'],
    ratings: main['оценок'] || 0,
    reviews: main['отзывов'] || 0,
    last: main['последний_отзыв'] || null,
    recent: main['последний_отзыв'] ? main['отзывов_за_12_мес_из_загруженных'] || 0 : 0,
    site: (main['сайты'] || []).length > 0,
    hours: !!main['часы'],
    owner: !!main['владелец_подтвердил'],
    good: !!main['хорошее_место'],
    allDay: !!main['круглосуточно'],
  };
}

/**
 * @param {object} src – json съёма ниши ({ ключ, дата_съёма, компании })
 * @param {object} cfg – правило ниши из otbor.mjs
 * @returns {{ rows: object[], rejected: Record<string, number>, found: number, published: boolean }}
 */
export function computeYa(src, cfg) {
  const at = new Date(src['дата_съёма'] + 'T00:00:00Z').getTime();
  const rejected = { 'закрыта': 0, 'другой город': 0, 'не профиль': 0, 'оценка ниже 4,0': 0, 'меньше 10 отзывов': 0 };
  const seen = new Set();
  const groups = new Map();
  for (const c of src['компании']) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const why = rejectReason(c, cfg);
    if (why) {
      rejected[why]++;
      continue;
    }
    const generic = GENERIC.test(c['название'].trim());
    const key = generic ? `${brandKey(c['название'])}|${c.id}` : brandKey(c['название']);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const merged = [];
  for (const [key, branches] of groups) {
    const m = merge(branches);
    m.key = key;
    m.generic = key.includes('|');
    m.display = m.generic ? `${m.name} (${street(branches[0]['адрес'])})` : m.name;
    if (m.rating < MIN_RATING) {
      rejected['оценка ниже 4,0'] += branches.length;
      continue;
    }
    if (m.reviews < MIN_REVIEWS) {
      rejected['меньше 10 отзывов'] += branches.length;
      continue;
    }
    merged.push(m);
  }
  const rows = merged.map((m) => {
    const { fresh, days } = freshness(m.last, m.recent, at);
    const open = 0.25 * +m.site + 0.25 * +m.hours + 0.25 * +m.owner + 0.25 * +m.good;
    return { ...m, days, fresh, open, logReviews: Math.log10(1 + m.reviews) };
  });
  const span = (k) => {
    const v = rows.map((r) => r[k]);
    const min = Math.min(...v);
    const max = Math.max(...v);
    return (x) => (max === min ? 1 : (x - min) / (max - min));
  };
  const nR = span('rating');
  const nL = span('logReviews');
  for (const r of rows) {
    r.parts = { rating: nR(r.rating), reviews: nL(r.logReviews), fresh: r.fresh, open: r.open };
    r.raw = 10 * (W_YA.rating * r.parts.rating + W_YA.reviews * r.parts.reviews + W_YA.fresh * r.parts.fresh + W_YA.open * r.parts.open);
    r.score = Math.round(r.raw * 10) / 10;
  }
  // место – по баллу; при равенстве решают сотые, затем число отзывов
  rows.sort((a, b) => b.raw - a.raw || b.reviews - a.reviews || a.display.localeCompare(b.display, 'ru'));
  rows.forEach((r, i) => (r.place = i + 1));
  return { rows, rejected, found: src['компании'].length, published: rows.length >= MIN_PUBLISH };
}
