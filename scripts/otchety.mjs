// Отчёты кабинета avtoball.ru: Метрика (113920999) и Вебмастер по API, без зависимостей (Node 22).
// Владелец 01.11.2026: «Метрика с разбивкой по городам» – два среза: город посетителя (гео Метрики) и город сайта
// (первый раздел адреса: /novosibirsk/…, /kazan/…). Пропуск – статус «нет доступа / не собрано», не ноль.
// Запуск: node scripts/otchety.mjs [папка] – пишет metrika.json и seo.json (по умолчанию /tmp/avtoball-otchety);
// на сервер: scp в /opt/avtoball/analytics (кабинет читает через /api/admin/report/<раздел> по паролю).
// Токен: YANDEX_TOKEN или ~/.config/yandex/token. Только чтение.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

const OUT = process.argv[2] || '/tmp/avtoball-otchety';
const COUNTER = 113920999;
const HOST = 'https:avtoball.ru:443';
const TOKEN = (process.env.YANDEX_TOKEN || readFileSync(`${homedir()}/.config/yandex/token`, 'utf8')).trim();
const H = { Authorization: `OAuth ${TOKEN}` };
const PERIODS = { week: 7, month: 30, quarter: 90, year: 365 };
const CITY_SLUGS = ['moskva', 'sankt-peterburg', 'novosibirsk', 'ekaterinburg', 'kazan', 'krasnoyarsk', 'nizhniy-novgorod', 'chelyabinsk', 'ufa', 'krasnodar', 'samara', 'rostov-na-donu', 'omsk', 'voronezh', 'perm', 'volgograd'];

async function get(url) {
  for (let i = 0; i < 3; i++) {
    let r;
    try { r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30000) }); } catch (e) { if (i === 2) return { code: 0, error: String(e.cause?.code || e.message) }; continue; }
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 3000 * (i + 1))); continue; }
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return r.ok ? { code: r.status, data } : { code: r.status, error: data?.message || data?.error_message || text.slice(0, 200) };
  }
  return { code: 429, error: 'квота API' };
}
const day = (n) => new Date(Date.now() - n * 864e5 + 7 * 3600e3).toISOString().slice(0, 10);

async function stat(params, days) {
  const q = new URLSearchParams({ ids: String(COUNTER), date1: day(days - 1), date2: day(0), accuracy: 'full', limit: '100', lang: 'ru', ...params });
  const r = await get(`https://api-metrika.yandex.net/stat/v1/data?${q}`);
  if (!r.data) return { status: 'unavailable', code: r.code, error: r.error };
  return { status: 'measured', totals: r.data.totals, rows: (r.data.data || []).map((d) => ({ key: d.dimensions.map((x) => x.name ?? x.id ?? '–').join(' · '), v: d.metrics })) };
}

async function metrika() {
  const out = { source: 'Яндекс Метрика', counter: COUNTER, at: new Date().toISOString(), note: 'Метрика видит только посетителей, принявших cookie; полный счёт – свой счётчик сайта (вкладка «Свой счётчик»).', periods: {} };
  const c = await get(`https://api-metrika.yandex.net/management/v1/counter/${COUNTER}`);
  out.counter_status = c.data ? { code: c.code, status: c.data.counter?.status, code_status: c.data.counter?.code_status } : { code: c.code, error: c.error };
  const goals = await get(`https://api-metrika.yandex.net/management/v1/counter/${COUNTER}/goals`);
  const gl = (goals.data?.goals || []).slice(0, 5);
  out.goals = gl.map((g) => ({ id: g.id, name: g.name }));
  const gm = gl.map((g) => `ym:s:goal${g.id}reaches`);
  for (const [name, days] of Object.entries(PERIODS)) {
    const base = ['ym:s:visits', 'ym:s:users', 'ym:s:pageviews', 'ym:s:bounceRate', ...gm].join(',');
    out.periods[name] = {
      days,
      from: day(days - 1), to: day(0),
      byDay: await stat({ metrics: 'ym:s:visits,ym:s:users', dimensions: 'ym:s:date', sort: 'ym:s:date' }, days),
      totals: await stat({ metrics: base }, days),
      sources: await stat({ metrics: base, dimensions: 'ym:s:lastTrafficSource', sort: '-ym:s:visits' }, days),
      engines: await stat({ metrics: 'ym:s:visits', dimensions: 'ym:s:lastSearchEngineRoot', sort: '-ym:s:visits' }, days),
      landing: await stat({ metrics: 'ym:s:visits,ym:s:bounceRate', dimensions: 'ym:s:startURLPath', sort: '-ym:s:visits' }, days),
      geo: await stat({ metrics: 'ym:s:visits,ym:s:users', dimensions: 'ym:s:regionCity', sort: '-ym:s:visits' }, days),
      // город сайта: просмотры по первому разделу адреса
      sections: await stat({ metrics: 'ym:pv:pageviews,ym:pv:users', dimensions: 'ym:pv:URLPathLevel2', sort: '-ym:pv:pageviews' }, days),
    };
  }
  return out;
}

async function seo() {
  const out = { source: 'Яндекс Вебмастер', host: HOST, at: new Date().toISOString() };
  const user = await get('https://api.webmaster.yandex.net/v4/user');
  const uid = user.data?.user_id;
  if (!uid) return { ...out, status: 'unavailable', code: user.code, error: user.error };
  const base = `https://api.webmaster.yandex.net/v4/user/${uid}/hosts/${encodeURIComponent(HOST)}`;
  const host = await get(base);
  out.host_status = host.data ? { verified: host.data.verified, data_status: host.data.host_data_status, main_mirror: host.data.main_mirror } : { code: host.code, error: host.error };
  const sum = await get(`${base}/summary`);
  out.summary = sum.data ? { status: 'measured', ...sum.data } : { status: host.data?.host_data_status === 'NOT_LOADED' ? 'not_collected' : 'unavailable', code: sum.code, error: sum.error };
  const q = await get(`${base}/search-queries/popular?order_by=TOTAL_SHOWS&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION&limit=100`);
  out.queries = q.data ? { status: 'measured', from: q.data.date_from, to: q.data.date_to, rows: (q.data.queries || []).map((x) => ({ q: x.query_text, ...x.indicators })) } : { status: 'not_collected', code: q.code, error: q.error };
  const ind = await get(`${base}/indexing/history?indexing_indicator=SEARCHABLE&indexing_indicator=DOWNLOADED`);
  out.indexing = ind.data ? { status: 'measured', ...ind.data } : { status: 'not_collected', code: ind.code, error: ind.error };
  const sm = await get(`${base}/user-added-sitemaps`);
  out.sitemaps = sm.data ? { status: 'measured', ...sm.data } : { status: 'not_collected', code: sm.code };
  out.google = { status: 'unavailable', error: 'Search Console: ресурс avtoball.ru не подключён (нужно подтверждение владельцем)' };
  out.cities = CITY_SLUGS;
  return out;
}

mkdirSync(OUT, { recursive: true });
const m = await metrika();
writeFileSync(`${OUT}/metrika.json`, JSON.stringify(m));
const s = await seo();
writeFileSync(`${OUT}/seo.json`, JSON.stringify(s));
console.log('Метрика:', m.counter_status, '| визитов за год:', m.periods.year.totals.totals?.[0] ?? m.periods.year.totals.status);
console.log('Вебмастер:', s.host_status || s.error, '| сводка:', s.summary?.status, '| запросы:', s.queries?.status, s.queries?.rows?.length ?? '');
