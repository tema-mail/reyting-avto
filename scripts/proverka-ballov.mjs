// Сверка: баллы, посчитанные формулой из сырых полей, против чисел в текстах
// (~/Sites/reytingi/docs/marketing/teksty-avto.md, 25.10.2026). Известные расхождения – в docs/resheniya.md.
import { readFileSync } from 'node:fs';
import { computeNiche } from '../src/lib/formula.mjs';

const load = (f) => JSON.parse(readFileSync(new URL('../src/data/source/' + f, import.meta.url), 'utf8'));
const NICHES = [
  {
    niche: 'ustanovka-magnitol',
    file: 'ustanovka-magnitol.json',
    exclude: [],
    text: { 'АвтоАзарт': 8.5, 'Спарта Маркет': 8.2, 'Teyes Sibir': 7.3, 'StarLine (фирменный установочный центр)': 6.0, 'Аудиохирургия': 5.9, 'ВсеМагнитолы.ру': 5.8, 'Центр Автобезопасность': 4.3, 'Сибавтоаудио': 4.3, 'Автомастер': 4.1, 'Автозвук-профи': 3.4, 'СибАвто54': 2.9, '30 Hertz': 2.0 },
  },
  {
    niche: 'servis-kitayskikh-avtomobiley',
    file: 'servis-kitayskikh-avtomobiley.json',
    exclude: ['Tesla_N (Тесла Н)', 'EV Sibir / Evolution Car Service'],
    text: { 'Reaktor (Писарева, 73)': 7.9, 'Фильтр (Энергетиков, 23/1)': 7.4, 'Geely Грейт Парк': 6.0, 'Луна Авто, Chery': 6.0, 'EXPOCAR, Chery': 5.9, 'Haval Pro Восток Моторс': 5.7, 'Сибтрансавто-Н, Haval': 5.0, 'Автомир Chery': 4.9, 'Autobox54': 3.6, 'TopAuto': 2.9 },
  },
];
// Расхождение разобрано: в json съёма СибАвто54 получил профиль 0,5 за «открытую цену»,
// но на сайте цены магнитол (товар), а не установки. По правилу ниши профиль 0 → 2,1.
const KNOWN = { 'СибАвто54': 2.1 };

let bad = 0;
for (const n of NICHES) {
  const src = load(n.file);
  const rows = computeNiche(src['компании'], { niche: n.niche, date: src['дата_съёма'], exclude: n.exclude });
  console.log(`\n${n.niche}: ${rows.length} компаний, отзывов ${rows.reduce((s, r) => s + r.reviews, 0)}`);
  for (const r of rows) {
    const name = r.c['название'];
    const want = n.text[name];
    const ok = want === r.score || KNOWN[name] === r.score;
    if (!ok) bad++;
    console.log(`${ok ? 'ок ' : 'НЕТ'} ${r.place}. ${name}: ${r.raw.toFixed(3)} → ${r.score} (в тексте ${want})${KNOWN[name] ? ' – известное расхождение' : ''}`);
  }
}
if (bad) {
  console.error(`\nРасхождений без объяснения: ${bad}. Разобрать и записать в docs/resheniya.md.`);
  process.exit(1);
}
console.log('\nБаллы совпадают с текстами (кроме известных расхождений).');
