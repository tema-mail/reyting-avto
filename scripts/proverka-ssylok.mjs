// После сборки: все внутренние href/src из dist ведут на существующие файлы (с учётом base),
// якоря на странице существуют, нет длинного тире «—», каждая страница с title и h1.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const BASE = (process.env.PUBLIC_BASE || '/').replace(/\/$/, '');
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
walk(DIST);
const html = files.filter((f) => f.endsWith('.html'));
const idsOf = (s) => new Set([...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
let bad = 0;
const err = (m) => {
  bad++;
  console.error('  ✗ ' + m);
};
let links = 0;
for (const f of html) {
  const s = readFileSync(f, 'utf8');
  const rel = f.slice(DIST.length - 1);
  if (s.includes('—')) err(`${rel}: длинное тире «—»`);
  if (!/<title>[^<]+<\/title>/.test(s)) err(`${rel}: нет title`);
  if (!/http-equiv="refresh"/.test(s) && !rel.startsWith('/admin/') && !/<h1[\s>]/.test(s)) err(`${rel}: нет h1`);
  // ссылки внутри <script> – шаблоны для браузера (каталог города), а не адреса страницы
  for (const m of s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').matchAll(/(?:href|src)="([^"]+)"/g)) {
    let h = m[1].replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|tel:|data:)/.test(h)) continue;
    links++;
    if (h.startsWith('#')) {
      if (h.length > 1 && !idsOf(s).has(h.slice(1))) err(`${rel}: якорь ${h} не найден`);
      continue;
    }
    if (!h.startsWith(BASE + '/')) {
      err(`${rel}: ссылка без base: ${h}`);
      continue;
    }
    const [pathQ, hash] = h.slice(BASE.length).split('#');
    const path = pathQ.split('?')[0]; // параметры (?city=…) на наличие страницы не влияют
    const target = path.endsWith('/') ? join(DIST, path, 'index.html') : join(DIST, path);
    if (!existsSync(target)) err(`${rel}: битая ссылка ${h}`);
    else if (hash && target.endsWith('.html') && !idsOf(readFileSync(target, 'utf8')).has(hash)) err(`${rel}: якорь ${h} не найден`);
  }
}
console.log(`Проверено страниц: ${html.length}, внутренних ссылок: ${links}, ошибок: ${bad}`);
if (bad) process.exit(1);
