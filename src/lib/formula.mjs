// Формула v2 – одна для всех компаний ниши, опубликована на /metodika/.
// Считает баллы из сырых полей съёма (Яндекс Карты, 2ГИС, сайт компании). Без зависимостей:
// её же вызывает scripts/proverka-ballov.mjs для сверки с текстами.
//
// балл = 10 × (0,30·оценка + 0,30·отзывы + 0,15·свежесть + 0,10·открытость + 0,15·профиль ниши)

export const WEIGHTS = { rating: 0.3, reviews: 0.3, fresh: 0.15, open: 0.1, profile: 0.15 };

const DAY = 86400000;
const round3 = (x) => Math.round(x * 1000) / 1000;

/** Статус в открытости: официальный дилер или фирменный центр – 1, «владелец подтвердил» – 0,5. */
export function statusShare(c) {
  const st = c['официальный_статус'] || '';
  if (/официальный дилер|фирменный/i.test(st)) return 1;
  return c['яндекс']['владелец_подтвердил'] ? 0.5 : 0;
}

/** Профиль ниши: признак, важный в нише (описан на /metodika/#<ниша>). */
export const PROFILE = {
  // официальный дилер бренда головных устройств – 1; открытая цена установки магнитолы на сайте – 0,5
  'ustanovka-magnitol': (c) => {
    if (/официальный дилер/i.test(c['официальный_статус'] || '')) return 1;
    return (c['цены_от'] || []).some((p) => /^установка магнитолы/i.test(p)) ? 0.5 : 0;
  },
  // официальный дилер или авторизованный сервис китайской марки – 1
  'servis-kitayskikh-avtomobiley': (c) => (/официальный дилер/i.test(c['официальный_статус'] || '') ? 1 : 0),
};

/**
 * @param {object[]} companies – компании из json съёма
 * @param {{ niche: string, date: string, exclude?: string[] }} opt
 */
export function computeNiche(companies, opt) {
  const at = new Date(opt.date + 'T00:00:00Z').getTime();
  const list = companies.filter((c) => !(opt.exclude || []).includes(c['название']));
  const rows = list.map((c) => {
    const y = c['яндекс'];
    const g = c['2гис'];
    // средняя оценка, взвешенная по числу оценок Яндекса и отзывов 2ГИС; до тысячных
    const rating = round3((y['рейтинг'] * y['оценок'] + g['рейтинг'] * g['отзывов']) / (y['оценок'] + g['отзывов']));
    const reviews = y['текстовых_отзывов'] + g['отзывов'];
    const days = Math.round((at - new Date(y['последний_отзыв'] + 'T00:00:00Z').getTime()) / DAY);
    const recent = y['отзывов_за_12_мес_из_загруженных'];
    const fresh = 0.5 * Math.max(0, 1 - days / 365) + 0.5 * Math.min(1, recent / 12);
    const status = statusShare(c);
    const open = 0.25 * (c['цены_на_сайте'] ? 1 : 0) + 0.25 * (c['сайт_работает'] ? 1 : 0) + 0.25 * (c['часы'] ? 1 : 0) + 0.25 * status;
    const profile = PROFILE[opt.niche](c);
    return { c, rating, reviews, logReviews: Math.log10(1 + reviews), days, recent, fresh, status, open, profile };
  });
  const span = (k) => {
    const v = rows.map((r) => r[k]);
    const min = Math.min(...v);
    const max = Math.max(...v);
    return (x) => (max === min ? 1 : (x - min) / (max - min));
  };
  const nR = span('rating');
  const nL = span('logReviews');
  const W = WEIGHTS;
  const out = rows.map((r) => {
    const parts = {
      rating: nR(r.rating),
      reviews: nL(r.logReviews),
      fresh: r.fresh,
      open: r.open,
      profile: r.profile,
    };
    const raw = 10 * (W.rating * parts.rating + W.reviews * parts.reviews + W.fresh * parts.fresh + W.open * parts.open + W.profile * parts.profile);
    return { ...r, parts, raw, score: Math.round(raw * 10) / 10 };
  });
  // место – по баллу; при равенстве в десятых решают сотые (raw)
  out.sort((a, b) => b.raw - a.raw);
  out.forEach((r, i) => (r.place = i + 1));
  return out;
}
