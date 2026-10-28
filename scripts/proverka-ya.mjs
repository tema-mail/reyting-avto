// Проверка ниш «только Яндекс Карты» перед сборкой. Роняет сборку (exit 1), если:
// – балл формулы (src/lib/formula-ya.mjs) расходится с независимым пересчётом из сырых полей больше чем на 0,001;
// – в список попала компания не по правилам (закрыта, не профиль, оценка < 4,0, отзывов < 10);
// – места не по убыванию балла, балл вне 0–10, опубликована ниша меньше чем с 5 компаниями;
// – нет текстов ниши, в чек-листе не 5–7 пунктов, в FAQ не 3–5 вопросов, в текстах длинное тире.
import { readFileSync, readdirSync } from 'node:fs';
import { computeYa, MIN_RATING, MIN_REVIEWS, MIN_PUBLISH } from '../src/lib/formula-ya.mjs';
import { NICHES_YA, rejectReason } from '../src/lib/otbor.mjs';

const root = new URL('..', import.meta.url).pathname;
const errors = [];
const err = (m) => errors.push(m);
let checked = 0;

for (const [key, cfg] of Object.entries(NICHES_YA)) {
  const src = JSON.parse(readFileSync(`${root}src/data/source/avto/${key}.json`, 'utf8'));
  const { rows, published } = computeYa(src, cfg);
  if (!published) continue;
  if (rows.length < MIN_PUBLISH) err(`${key}: опубликовано ${rows.length} < ${MIN_PUBLISH}`);
  // независимый пересчёт: сначала сырые величины, потом min-max
  const at = Date.parse(src['дата_съёма'] + 'T00:00:00Z');
  const raw = rows.map((r) => {
    let w = 0, s = 0, rev = 0, recent = 0, last = '';
    for (const b of r.branches) {
      if (rejectReason(b, cfg)) err(`${key}: «${b['название']}» не проходит отбор (${rejectReason(b, cfg)})`);
      w += b['оценок'];
      s += b['рейтинг'] * b['оценок'];
      rev += b['отзывов'];
      if (b['последний_отзыв']) {
        recent += b['отзывов_за_12_мес_из_загруженных'] || 0;
        if (b['последний_отзыв'] > last) last = b['последний_отзыв'];
      }
    }
    const rating = Math.round((s / w) * 1000) / 1000;
    if (rating < MIN_RATING || rev < MIN_REVIEWS) err(`${key}: «${r.display}» ниже порога (${rating}, ${rev})`);
    const days = last ? Math.round((at - Date.parse(last + 'T00:00:00Z')) / 86400000) : null;
    const fresh = days === null ? 0 : 0.5 * Math.max(0, 1 - days / 365) + 0.5 * Math.min(1, recent / 12);
    const any = (f) => r.branches.some(f);
    const open = (any((b) => (b['сайты'] || []).length) + any((b) => !!b['часы']) + any((b) => b['владелец_подтвердил']) + any((b) => b['хорошее_место'])) / 4;
    return { rating, lg: Math.log10(1 + rev), fresh, open };
  });
  const mm = (k) => {
    const v = raw.map((x) => x[k]);
    const lo = Math.min(...v), hi = Math.max(...v);
    return (x) => (hi === lo ? 1 : (x - lo) / (hi - lo));
  };
  const nr = mm('rating'), nl = mm('lg');
  rows.forEach((r, i) => {
    const x = raw[i];
    const expect = 10 * (0.35 * nr(x.rating) + 0.35 * nl(x.lg) + 0.15 * x.fresh + 0.15 * x.open);
    if (Math.abs(expect - r.raw) > 0.001) err(`${key}: «${r.display}» балл ${r.raw.toFixed(3)} ≠ пересчёт ${expect.toFixed(3)}`);
    if (r.score < 0 || r.score > 10) err(`${key}: балл вне 0–10`);
    if (i > 0 && rows[i - 1].raw < r.raw) err(`${key}: место ${r.place} выше предыдущего по баллу`);
    if (r.place !== i + 1) err(`${key}: место ${r.place} на позиции ${i + 1}`);
    checked++;
  });
  // тексты ниши
  const txt = readFileSync(`${root}src/data/nishi/${key}.ts`, 'utf8');
  if (txt.includes('—')) err(`${key}: длинное тире в текстах`);
  const n = (re) => (txt.match(re) || []).length;
  const check = txt.slice(txt.indexOf('check:'), txt.indexOf('faq:'));
  const items = (check.match(/^\s*'/gm) || []).length + (check.match(/^\s*"/gm) || []).length;
  if (items < 5 || items > 7) err(`${key}: в чек-листе ${items} пунктов (нужно 5–7)`);
  const faq = n(/^\s*\[\s*['"]/gm);
  if (faq < 3 || faq > 5) err(`${key}: в FAQ ${faq} вопросов (нужно 3–5)`);
}

const files = readdirSync(`${root}src/data/source/avto`).filter((f) => f.endsWith('.json')).length;
if (files !== Object.keys(NICHES_YA).length) err(`съёмов ${files}, ниш в otbor.mjs ${Object.keys(NICHES_YA).length}`);

if (errors.length) {
  console.error(`Проверка ниш Яндекса: ошибок ${errors.length}\n` + errors.map((e) => ' – ' + e).join('\n'));
  process.exit(1);
}
console.log(`Проверка ниш Яндекса: пересчитано ${checked} строк, расхождений нет`);
