// IndexNow (09.11.2026): сообщить Яндексу (и Bing) о новых и изменённых адресах без Вебмастера – там переобход 10 адресов
// в день, а запись по API отвечает 504. Ключ – public/<ключ>.txt, копия в ~/.config/avtoball/indexnow-key.
// node scripts/indexnow.mjs --vse            – все адреса из dist/sitemap.xml (один раз, «как новый сайт»);
// node scripts/indexnow.mjs --novye <файл>   – только адреса, которых нет в старой карте сайта (вызывает vylozhit.sh);
// node scripts/indexnow.mjs <адрес> ...      – перечисленные адреса.
import { readFileSync, readdirSync } from 'node:fs';

const HOST = 'avtoball.ru';
const key = readdirSync('public').find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, -4);
if (!key) throw new Error('нет файла ключа public/<32 hex>.txt');
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const fresh = () => locs(readFileSync('dist/sitemap.xml', 'utf8'));

const [mode, arg] = process.argv.slice(2);
let urls;
if (mode === '--vse') urls = fresh();
else if (mode === '--novye') {
  const old = new Set(locs(readFileSync(arg, 'utf8')));
  urls = fresh().filter((u) => !old.has(u));
} else urls = process.argv.slice(2);
urls = urls.filter((u) => u.startsWith(`https://${HOST}/`));
if (!urls.length) { console.log('IndexNow: новых адресов нет'); process.exit(0); }

for (const ep of ['https://yandex.com/indexnow', 'https://api.indexnow.org/indexnow']) {
  for (let i = 0; i < urls.length; i += 10000) {
    const part = urls.slice(i, i + 10000);
    const r = await fetch(ep, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: part }),
    });
    console.log(`IndexNow ${new URL(ep).host}: ${part.length} адресов – HTTP ${r.status} ${r.ok ? '' : (await r.text()).slice(0, 200)}`);
  }
}
