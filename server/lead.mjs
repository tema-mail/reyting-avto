// Приём заявок avtoball.ru и свой счётчик – маленький сервис без зависимостей (Node 22), VPS Beget (РФ). Основа – gaz-mag server/lead.mjs.
// POST /api/lead {form, page, consent: «да», …поля формы} → проверка → копия в /data/leads.jsonl → сообщение в Telegram (если настроен).
// Копия пишется всегда, даже без Telegram: заявка не теряется (владелец 01.11.2026: «все заявки всегда приходят нам»).
// POST /api/ev {e, p} – свой счётчик без cookie (вход, просмотр, телефон, мессенджер, форма) для «Цифр страницы» кабинета:
// без IP и без идентификатора посетителя, только событие, страница, источник и время – /data/ev-YYYY-MM.jsonl.
// Кабинет: GET /api/leads, PATCH /api/leads/<номер> {stage}, GET /api/admin/report/<раздел>, PATCH /api/admin/recommendations/<id> {status},
// GET /api/admin/events?m=YYYY-MM –
// только с логином и паролем кабинета (Basic, тот же вход, что у замка админки).
// Окружение: TG_TOKEN, TG_CHAT (через запятую), ADMIN_LOGIN, ADMIN_PASS, PORT (8090), ORIGIN (https://avtoball.ru).
import { createServer } from 'node:http';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 8090);
const DATA = process.env.DATA_DIR || '/data';
const ANALYTICS = process.env.ANALYTICS_DIR || '/analytics';
const TG_TOKEN = process.env.TG_TOKEN || '';
const TG_CHATS = (process.env.TG_CHAT || '').split(',').map((s) => s.trim()).filter(Boolean);
const ORIGINS = (process.env.ORIGIN || 'https://avtoball.ru,https://admin.avtoball.ru').split(',').map((s) => s.trim());
const ADMIN = process.env.ADMIN_LOGIN && process.env.ADMIN_PASS ? `${process.env.ADMIN_LOGIN}:${process.env.ADMIN_PASS}` : '';
const STAGES = ['новая', 'в работе', 'выполнена', 'отказ', 'архив'];
const REPORTS = ['metrika', 'seo', 'pages', 'recommendations'];
// статусы рекомендаций – как у агента улучшений (~/.claude/skills/uluchsheniya)
const REC_STATUSES = ['novoe', 'v_rabote', 'sdelano', 'ne_nado'];
const EVENTS = ['in', 'pv', 'phone', 'msg', 'form'];

const MAX_BODY = 16 * 1024;
const MAX_FIELD = 2000;
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5; // заявок с одного адреса за 10 минут
const hits = new Map();

function authed(req) {
  const h = String(req.headers.authorization || '');
  if (!ADMIN || !h.startsWith('Basic ')) return false;
  const got = Buffer.from(Buffer.from(h.slice(6), 'base64').toString('utf8'));
  const want = Buffer.from(ADMIN);
  return got.length === want.length && timingSafeEqual(got, want);
}
function limited(key, limit = LIMIT) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
  return list.length > limit;
}
const pad = (n) => String(n).padStart(2, '0');
function leadId(d) {
  const n = new Date(d.getTime() + 7 * 3600e3); // время Новосибирска в номере
  return `AB-${String(n.getUTCFullYear()).slice(2)}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}-${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${Math.random().toString(36).slice(2, 4)}`;
}
const clean = (v) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, MAX_FIELD);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}
async function readBody(req, limit) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('too big'), { code: 413 }); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}
async function readLeads() {
  let text = '';
  try { text = await readFile(`${DATA}/leads.jsonl`, 'utf8'); } catch { return []; }
  const stages = await readJson(`${DATA}/stages.json`, {});
  return text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    .map((l) => ({ ...l, stage: stages[l.id]?.stage || 'новая', history: stages[l.id]?.history || [] }))
    .reverse();
}
function send(res, code, body, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin && ORIGINS.includes(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' });
  res.writeHead(code, headers);
  res.end(JSON.stringify(body));
}

async function telegram(text) {
  if (!TG_TOKEN || !TG_CHATS.length) return 'не настроен';
  const res = await Promise.all(TG_CHATS.map((chat) => fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  }).then((r) => r.ok).catch(() => false)));
  return res.every(Boolean) ? 'отправлено' : 'ошибка';
}
// Подписи полей обеих форм сайта (HelpForm.astro, dobavit-kompaniyu.astro); порядок – контакты первыми.
const LABELS = {
  name: 'Имя', phone: 'Телефон', telegram: 'Telegram', email: 'Почта', company: 'Компания', city: 'Город', niche: 'Ниша',
  car: 'Машина', task: 'Задача', warranty: 'Гарантия', area: 'Район', yandex: 'Яндекс Карты', gis: '2ГИС', site: 'Сайт',
  prices: 'Цены', status: 'Статус дилера', fix: 'Что исправить', role: 'Кто', page: 'Страница',
};
const FORMS = { help: 'Помочь выбрать', dobavit: 'Добавить компанию' };
function message(lead) {
  const f = lead.fields;
  const lines = [`<b>${esc(lead.form)}</b> · № ${lead.id}`];
  for (const k of Object.keys(LABELS)) if (f[k]) lines.push(`<b>${LABELS[k]}:</b> ${esc(f[k])}`);
  for (const [k, v] of Object.entries(f)) if (!LABELS[k] && v) lines.push(`<b>${esc(k)}:</b> ${esc(v)}`);
  lines.push(`<i>${new Date(lead.at).toLocaleString('ru-RU', { timeZone: 'Asia/Novosibirsk' })} НСК</i>`);
  return lines.join('\n');
}

async function adminApi(req, res) {
  const url = new URL(req.url, 'http://x');
  const rep = url.pathname.match(/^\/api\/admin\/report\/([a-z]+)$/);
  if (rep && req.method === 'GET') {
    if (!REPORTS.includes(rep[1])) return send(res, 404, { ok: false });
    const data = await readJson(`${ANALYTICS}/${rep[1]}.json`, null);
    if (!data) return send(res, 404, { ok: false, error: 'not_collected' });
    if (rep[1] === 'recommendations' && Array.isArray(data.items)) {
      const st = await readJson(`${DATA}/rec-status.json`, {});
      data.items = data.items.map((i) => (st[i.id] ? { ...i, status: st[i.id].status, status_at: st[i.id].at } : i));
    }
    return send(res, 200, data);
  }
  const rec = url.pathname.match(/^\/api\/admin\/recommendations\/([\w-]{1,80})$/);
  if (rec && req.method === 'PATCH') {
    const status = JSON.parse(await readBody(req, 2000)).status;
    if (!REC_STATUSES.includes(status)) return send(res, 422, { ok: false });
    const st = await readJson(`${DATA}/rec-status.json`, {});
    st[rec[1]] = { status, at: new Date().toISOString() };
    await writeFile(`${DATA}/rec-status.json.tmp`, JSON.stringify(st));
    await rename(`${DATA}/rec-status.json.tmp`, `${DATA}/rec-status.json`);
    return send(res, 200, { ok: true, status });
  }
  if (url.pathname === '/api/admin/events' && req.method === 'GET') {
    const m = url.searchParams.get('m') || '';
    if (!/^\d{4}-\d{2}$/.test(m)) return send(res, 422, { ok: false });
    let text = '';
    try { text = await readFile(`${DATA}/ev-${m}.jsonl`, 'utf8'); } catch {}
    return send(res, 200, { ok: true, month: m, events: text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) });
  }
  return send(res, 404, { ok: false });
}

createServer(async (req, res) => {
  const origin = req.headers.origin;
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const path = req.url.split('?')[0];
  if (path === '/api/health') return send(res, 200, { ok: true, telegram: Boolean(TG_TOKEN && TG_CHATS.length), admin: Boolean(ADMIN) });

  if (path.startsWith('/api/admin/') || path === '/api/leads' || path.startsWith('/api/leads/')) {
    if (!authed(req)) { if (limited('auth:' + ip, 20)) return send(res, 429, { ok: false, error: 'rate' }, origin); return send(res, 401, { ok: false }, origin); }
    try {
      if (path.startsWith('/api/admin/')) return await adminApi(req, res);
      if (req.method === 'GET' && path === '/api/leads') return send(res, 200, { ok: true, leads: await readLeads() }, origin);
      if (req.method === 'PATCH') {
        const id = decodeURIComponent(path.slice('/api/leads/'.length));
        const stage = JSON.parse(await readBody(req, 2000)).stage;
        if (!STAGES.includes(stage) || !/^AB-[\w-]{6,30}$/.test(id)) return send(res, 422, { ok: false }, origin);
        const all = await readJson(`${DATA}/stages.json`, {});
        const cur = all[id] || { stage: 'новая', history: [] };
        if (cur.stage !== stage) { cur.history = [...cur.history, { at: new Date().toISOString(), from: cur.stage, to: stage }].slice(-50); cur.stage = stage; }
        all[id] = cur;
        await writeFile(`${DATA}/stages.json.tmp`, JSON.stringify(all));
        await rename(`${DATA}/stages.json.tmp`, `${DATA}/stages.json`);
        return send(res, 200, { ok: true, stage: cur.stage, history: cur.history }, origin);
      }
      return send(res, 405, { ok: false }, origin);
    } catch (e) { return send(res, e.code === 413 ? 413 : 500, { ok: false }, origin); }
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET, POST, PATCH', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' });
    return res.end();
  }
  if (req.method !== 'POST' || (path !== '/api/lead' && path !== '/api/ev')) return send(res, 404, { ok: false });
  if (origin && !ORIGINS.includes(origin)) return send(res, 403, { ok: false, error: 'origin' });

  let body;
  try { body = JSON.parse(await readBody(req, MAX_BODY)); } catch (e) { return send(res, e.code === 413 ? 413 : 400, { ok: false }, origin); }

  if (path === '/api/ev') {
    // свой счётчик: только известные события, страница сайта и домен источника; лимит – от накрутки одним адресом
    const e = String(body?.e || ''), p = clean(body?.p).slice(0, 300);
    if (!EVENTS.includes(e) || !p.startsWith('/') || limited('ev:' + ip, 600)) return send(res, 204, {});
    let r = '';
    try { r = body?.r ? new URL(String(body.r)).hostname.slice(0, 100) : ''; } catch {}
    const now = new Date();
    await mkdir(DATA, { recursive: true });
    await appendFile(`${DATA}/ev-${now.toISOString().slice(0, 7)}.jsonl`, JSON.stringify({ t: now.toISOString(), e, p, r, k: clean(body?.k).slice(0, 40) }) + '\n');
    res.writeHead(204); return res.end();
  }

  const fields = {};
  for (const [k, v] of Object.entries(body || {}).slice(0, 40)) if (!['form', 'consent', 'website'].includes(k)) fields[clean(k).slice(0, 60)] = clean(v);
  // ловушка для ботов: скрытое поле website люди не заполняют – отвечаем «ок», но не сохраняем
  if (body?.website) return send(res, 200, { ok: true }, origin);
  const contact = String(fields.phone || '').replace(/\D/g, '').length >= 10 || /\S/.test(fields.telegram || '') || /@/.test(fields.email || '');
  if (!contact) return send(res, 422, { ok: false, error: 'contact' }, origin);
  // согласие на обработку ПДн проверяет и сервер (152-ФЗ, ст. 9)
  if (!['да', 'on', true].includes(body?.consent)) return send(res, 422, { ok: false, error: 'consent' }, origin);
  if (limited(ip)) return send(res, 429, { ok: false, error: 'rate' }, origin);

  const now = new Date();
  const form = clean(body.form);
  const lead = { id: leadId(now), at: now.toISOString(), form: FORMS[form] || form || 'Заявка с сайта', fields, page: fields.page || '', consent: true };
  try {
    await mkdir(DATA, { recursive: true });
    await appendFile(`${DATA}/leads.jsonl`, JSON.stringify(lead) + '\n');
  } catch (e) {
    console.error('не записалось', e);
    return send(res, 500, { ok: false }, origin);
  }
  console.log(lead.at, lead.form, 'telegram:', await telegram(message(lead)));
  send(res, 200, { ok: true, id: lead.id }, origin);
}).listen(PORT, () => console.log('avtoball lead: порт', PORT, '| telegram:', TG_TOKEN && TG_CHATS.length ? 'да' : 'нет'));
