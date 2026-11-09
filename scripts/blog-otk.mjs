// ОТК статей блога перед выкладкой (10.11.2026, агент РУКИ – ~/.claude/agents/ruki.md, запуск из ~/Sites/reytingi/scripts/ruki.sh).
// node scripts/blog-otk.mjs <файл.md> …  – по каждому файлу «ОК» или список причин; код выхода 1, если брак есть хоть в одном.
// Проверяет форму по ТЗ ~/Sites/reytingi/docs/seo/blog/BRIEF.md: поля, рубрика, tema, объём, длинное тире, служебные метки,
// ссылки – только на адреса из собранного dist (или на статьи этого же запуска), похожесть на другие статьи блога
// (5-словные шинглы: статья, отличающаяся от другой только городом, – брак, защита от scaled content).
// Чего не ловит: пользу и правду. Ответила ли статья на запрос и верны ли цифры – решает автор по входным файлам.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const RUBRIKI = ['Как выбрать', 'Цены', 'Законы и документы', 'Сезон', 'Исследования', 'Выбор редакции'];
const POHOZHEST = 0.2; // доля общих 5-словных шинглов с любой другой статьёй – выше этого брак
const files = process.argv.slice(2);
const DIR = 'src/data/blog';

const fmOf = (t) => {
  const m = t.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const f = {};
  for (const k of ['title', 'description', 'h1', 'lead', 'date', 'rubrika', 'gorod', 'nisha', 'tema'])
    f[k] = (m[1].match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, 'm')) || [])[1];
  f.faq = (m[1].match(/^\s+- q:/gm) || []).length;
  return { f, body: m[2] };
};
const words = (t) => t.replace(/<[^>]+>|[#*|>\-\[\]()`]/g, ' ').toLowerCase().split(/\s+/).filter((w) => /[а-яё0-9a-z]/.test(w));
const shingles = (t, gorod) => {
  const w = words(t).filter((x) => !gorod || !x.startsWith(gorod.slice(0, 5)));
  const s = new Set();
  for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(' '));
  return s;
};
const newUrls = new Set(files.map((p) => {
  const { f } = fmOf(readFileSync(p, 'utf8')) || { f: {} };
  return f.gorod ? `/${f.gorod}/blog/${basename(p, '.md')}/` : `/blog/${basename(p, '.md')}/`;
}));
const others = readdirSync(DIR).filter((n) => n.endsWith('.md')).map((n) => ({ n, t: readFileSync(`${DIR}/${n}`, 'utf8') }));
const temy = new Map();
for (const o of others) { const t = fmOf(o.t)?.f.tema; if (t) temy.set(t, [...(temy.get(t) || []), o.n]); }

let brak = 0;
for (const p of files) {
  const t = readFileSync(p, 'utf8');
  const why = [];
  const x = fmOf(t);
  if (!x) { console.log(`${p}: нет frontmatter`); brak++; continue; }
  const { f, body } = x;
  for (const k of ['title', 'description', 'h1', 'lead', 'date', 'rubrika', 'tema']) if (!f[k]) why.push(`нет поля ${k}`);
  if (f.title && f.title.length > 70) why.push(`title ${f.title.length} знаков (>70)`);
  if (f.description && (f.description.length < 110 || f.description.length > 180)) why.push(`description ${f.description.length} знаков`);
  if (f.rubrika && !RUBRIKI.includes(f.rubrika)) why.push(`рубрика «${f.rubrika}» не из списка`);
  if (f.faq < 6) why.push(`FAQ ${f.faq} (<6)`);
  if (f.tema && (temy.get(f.tema) || []).filter((n) => n !== basename(p)).length) why.push(`тема ${f.tema} уже закрыта: ${temy.get(f.tema)}`);
  const n = words(body).length;
  if (n < 2000 || n > 4800) why.push(`слов ${n} (нужно 2 500–4 000)`);
  if (t.includes('—')) why.push(`длинное тире: ${t.split('—').length - 1}`);
  if (/\{\?|ПРОВЕРИТЬ|TODO|[Ll]orem ipsum/.test(t)) why.push('служебные метки в тексте');
  if (f.nisha && (body.match(/<!-- reyting -->/g) || []).length !== 1) why.push('nisha указана – нужна ровно одна метка <!-- reyting -->');
  if ((body.match(/^\|.*\|\s*$/gm) || []).length < 6) why.push('таблиц меньше трёх');
  for (const [, href] of body.matchAll(/\]\((\/[^)\s#]*)/g)) {
    const path = href.endsWith('/') ? href : href + '/';
    if (!newUrls.has(path) && !existsSync(`dist${path}index.html`)) why.push(`ссылка в никуда: ${href}`);
  }
  const mine = shingles(body, f.gorod);
  for (const o of others) {
    if (o.n === basename(p)) continue;
    const ob = fmOf(o.t);
    if (!ob) continue;
    const their = shingles(ob.body, ob.f.gorod);
    let common = 0;
    for (const s of mine) if (their.has(s)) common++;
    const share = common / Math.max(1, Math.min(mine.size, their.size));
    if (share > POHOZHEST) why.push(`похожа на ${o.n}: ${(share * 100).toFixed(0)}% общих фраз`);
  }
  console.log(`${p}: ${why.length ? 'БРАК – ' + why.join('; ') : `ОК (${n} слов, FAQ ${f.faq})`}`);
  if (why.length) brak++;
}
process.exit(brak ? 1 : 0);
