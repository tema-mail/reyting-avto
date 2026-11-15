// Цифры недели к прошлой неделе для субботней сводки (владелец 15.11.2026: «рост показателей с прошлой недели: заходы,
// показы, заявки – единая структура»). node scripts/nedelya-cifry.mjs [папка] → nedelya.json. Только чтение.
// Метрика 113920999 (две недели по 7 дней, последняя кончается вчера), Google Search Console (данные отстают на 2 дня –
// окна сдвинуты, даты в файле), Вебмастер – статус хоста. Пропуск – «не собрано» с кодом, не ноль.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createSign } from 'node:crypto';

const OUT = process.argv[2] || '/tmp/avtoball-otchety';
const COUNTER = 113920999;
const TOKEN = (process.env.YANDEX_TOKEN || readFileSync(`${homedir()}/.config/yandex/token`, 'utf8')).trim();
const H = { Authorization: `OAuth ${TOKEN}` };
const day = (n) => new Date(Date.now() - n * 864e5 + 7 * 3600e3).toISOString().slice(0, 10);
const okno = (lag) => ({ eta: [day(lag + 6), day(lag)], proshlaya: [day(lag + 13), day(lag + 7)] });
const GORODA = ['novosibirsk', 'krasnodar', 'krasnoyarsk', 'omsk', 'barnaul', 'perm', 'kazan', 'ekaterinburg', 'samara', 'ufa', 'nizhniy-novgorod', 'chelyabinsk', 'rostov-na-donu', 'voronezh', 'volgograd', 'sankt-peterburg', 'moskva'];

async function stat(params, [d1, d2]) {
  const q = new URLSearchParams({ ids: String(COUNTER), date1: d1, date2: d2, accuracy: 'full', limit: '50', lang: 'ru', ...params });
  let r;
  try { r = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${q}`, { headers: H, signal: AbortSignal.timeout(30000) }); } catch (e) { return { status: 'не собрано', error: String(e.message) }; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { status: 'не собрано', code: r.status, error: j.message || j.error_message };
  return { status: 'measured', totals: j.totals, rows: (j.data || []).map((d) => ({ key: d.dimensions.map((x) => x.name ?? x.id ?? '–').join(' · '), v: d.metrics })) };
}

async function metrika(w) {
  const m = {};
  for (const [k, dates] of Object.entries(w)) {
    const [d1, d2] = dates;
    m[k] = {
      period: `${d1} – ${d2}`,
      itogo: await stat({ metrics: 'ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:robotPercentage' }, dates),
      po_dnyam: await stat({ metrics: 'ym:s:visits,ym:s:users', dimensions: 'ym:s:date', sort: 'ym:s:date' }, dates),
      istochniki: await stat({ metrics: 'ym:s:visits,ym:s:users', dimensions: 'ym:s:lastTrafficSource', sort: '-ym:s:visits' }, dates),
      poiskoviki: await stat({ metrics: 'ym:s:visits', dimensions: 'ym:s:lastSearchEngineRoot', sort: '-ym:s:visits' }, dates),
      brauzery_headless: await stat({ metrics: 'ym:s:visits', dimensions: 'ym:s:browser', filters: "ym:s:browser=='HeadlessChrome'" }, dates),
      celi: await stat({ metrics: 'ym:s:goal676666443reaches,ym:s:goal677290426reaches,ym:s:goal677301119reaches,ym:s:goal677301120reaches,ym:s:goal677301121reaches' }, dates),
      goroda_sayta: await stat({ metrics: 'ym:pv:pageviews,ym:pv:users', dimensions: 'ym:pv:URLPathLevel2', sort: '-ym:pv:pageviews' }, dates),
      vhod_top: await stat({ metrics: 'ym:s:visits', dimensions: 'ym:s:startURL', sort: '-ym:s:visits' }, dates),
    };
  }
  return m;
}

async function gsc(w) {
  let k;
  try { k = JSON.parse(readFileSync(`${homedir()}/.config/gsc/teyes-sa.json`, 'utf8')); } catch { return { status: 'не собрано', error: 'нет ключа ~/.config/gsc/teyes-sa.json' }; }
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const un = b({ alg: 'RS256', typ: 'JWT' }) + '.' + b({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: k.token_uri, iat: now, exp: now + 3600 });
  const jwt = un + '.' + createSign('RSA-SHA256').update(un).sign(k.private_key, 'base64url');
  const t = await fetch(k.token_uri, { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) }).then((r) => r.json()).catch(() => ({}));
  if (!t.access_token) return { status: 'не собрано', error: 'Google не выдал токен' };
  const GH = { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' };
  const site = 'sc-domain:avtoball.ru';
  const q = async ([d1, d2], dimensions, extra = {}) => {
    const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: 'POST', headers: GH, body: JSON.stringify({ startDate: d1, endDate: d2, dimensions, rowLimit: dimensions[0] === 'page' ? 25000 : 500, ...extra }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 'не собрано', code: r.status, error: j.error?.message };
    return (j.rows || []).map((x) => ({ key: (x.keys || []).join(' · '), clicks: x.clicks, impressions: x.impressions, ctr: +(x.ctr * 100).toFixed(1), position: +x.position.toFixed(1) }));
  };
  const out = { status: 'measured', site, zametka: 'GSC отдаёт данные с задержкой ~2 дня, окна сдвинуты' };
  for (const [k2, dates] of Object.entries(w)) {
    const itogo = await q(dates, []);
    const pages = await q(dates, ['page']);
    const poGorodam = {};
    if (Array.isArray(pages)) for (const p of pages) { const g = GORODA.find((c) => p.key.includes(`/${c}/`)) || (p.key.includes('/blog/') ? 'blog-obshchiy' : 'prochee'); const a = (poGorodam[g] ||= { clicks: 0, impressions: 0 }); a.clicks += p.clicks; a.impressions += p.impressions; }
    const blog = Array.isArray(pages) ? pages.filter((p) => p.key.includes('/blog/')).reduce((a, p) => ({ clicks: a.clicks + p.clicks, impressions: a.impressions + p.impressions, stranic: a.stranic + 1 }), { clicks: 0, impressions: 0, stranic: 0 }) : pages;
    out[k2] = { period: `${dates[0]} – ${dates[1]}`, stranic_s_pokazami: Array.isArray(pages) ? pages.length : 'не собрано', itogo: Array.isArray(itogo) ? itogo[0] || { clicks: 0, impressions: 0 } : itogo, po_gorodam: poGorodam, blog, zaprosy_top: Array.isArray(await q(dates, ['query'])) ? (await q(dates, ['query'])).slice(0, 25) : 'не собрано', po_dnyam: await q(dates, ['date']) };
  }
  // индексация Google (владелец 15.11): точного счётчика в API нет – sitemap (submitted/indexed, отстаёт) и страницы с показами за 28 дней
  const sm = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps`, { headers: GH }).then((r) => r.json()).catch(() => ({}));
  out.sitemap = (sm.sitemap || []).map((s) => ({ path: s.path, lastDownloaded: s.lastDownloaded, submitted: s.contents?.[0]?.submitted, indexed: s.contents?.[0]?.indexed, errors: s.errors, warnings: s.warnings }));
  const p28 = await q([day(30), day(3)], ['page']);
  out.stranic_s_pokazami_28_dney = Array.isArray(p28) ? p28.length : p28;
  return out;
}

async function webmaster() {
  const u = await fetch('https://api.webmaster.yandex.net/v4/user', { headers: H }).then((r) => r.json()).catch(() => ({}));
  if (!u.user_id) return { status: 'не собрано', error: 'нет user_id' };
  const base = `https://api.webmaster.yandex.net/v4/user/${u.user_id}/hosts/${encodeURIComponent('https:avtoball.ru:443')}`;
  const h = await fetch(base, { headers: H }).then((r) => r.json()).catch(() => ({}));
  const s = await fetch(`${base}/summary`, { headers: H }).then(async (r) => (r.ok ? r.json() : { status: 'не собрано', code: r.status })).catch(() => ({ status: 'не собрано' }));
  return { host_data_status: h.host_data_status, verified: h.verified, summary: s };
}

mkdirSync(OUT, { recursive: true });
const out = { sobrano: new Date().toISOString(), metrika: await metrika(okno(1)), gsc: await gsc(okno(3)), webmaster: await webmaster() };
writeFileSync(`${OUT}/nedelya.json`, JSON.stringify(out, null, 1));
const m = out.metrika, g = out.gsc;
const v = (x) => x?.itogo?.totals?.[0] ?? x?.itogo?.status;
console.log(`Метрика визиты: эта ${m.eta.period} = ${v(m.eta)}, прошлая = ${v(m.proshlaya)}; заявки: эта ${JSON.stringify(m.eta.celi.totals)} прошлая ${JSON.stringify(m.proshlaya.celi.totals)}`);
console.log(`GSC: эта ${g.eta?.period} = ${JSON.stringify(g.eta?.itogo)}, прошлая ${g.proshlaya?.period} = ${JSON.stringify(g.proshlaya?.itogo)}; Вебмастер: ${out.webmaster.host_data_status}`);
