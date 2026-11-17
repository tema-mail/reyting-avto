// Вход в API кабинета (server/lead.mjs): пара владельца и СВЕРХ админ входят, неверная пара – нет, без СВЕРХ – как раньше.
// Запуск: npm test (node --test). Пары здесь выдуманные, настоящие не читаются; сервер поднимается на свободном порту во временной папке.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const OWNER = { login: 'owner-test', pass: 'owner-test-pass-0001' };
const SVERH = { login: 'sverh-test', pass: 'sverh:тест-pass-0002' }; // двоеточие и кириллица – как может быть в настоящем пароле
const LEAD = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'server', 'lead.mjs');
const salt = randomBytes(16);
const HASH = `${salt.toString('hex')}:${scryptSync(SVERH.pass, salt, 64).toString('hex')}`;
const basic = (l, p) => ({ Authorization: 'Basic ' + Buffer.from(`${l}:${p}`, 'utf8').toString('base64') });

const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const started = [];
async function start(extra) {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avtoball-lead-'));
  fs.writeFileSync(path.join(dir, 'leads.jsonl'), JSON.stringify({ id: 'AB-261117-0000aa', at: '2026-11-17T00:00:00.000Z', form: 'тест', fields: {} }) + '\n');
  const env = { PATH: process.env.PATH, PORT: String(port), DATA_DIR: dir, ANALYTICS_DIR: dir, ADMIN_LOGIN: OWNER.login, ADMIN_PASS: OWNER.pass, ...extra };
  const child = spawn(process.execPath, [LEAD], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  started.push({ child, dir });
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('exit', (c) => reject(new Error('сервер не поднялся: ' + c))); });
  const get = (headers = {}, p = '/api/leads') => fetch(`http://127.0.0.1:${port}${p}`, { headers });
  return { get };
}
let both, alone, broken;
before(async () => {
  both = await start({ SVERH_LOGIN: SVERH.login, SVERH_PASS_HASH: HASH });
  alone = await start({});
  broken = await start({ SVERH_LOGIN: SVERH.login, SVERH_PASS_HASH: 'не-хэш' });
});
after(() => { for (const { child, dir } of started) { child.kill(); fs.rmSync(dir, { recursive: true, force: true }); } });

test('без входа – 401', async () => {
  assert.equal((await both.get()).status, 401);
  assert.equal((await both.get({ Authorization: 'Basic ' })).status, 401);
});

test('СВЕРХ админ входит и получает данные (и повторно – без пересчёта хэша)', async () => {
  for (let i = 0; i < 2; i++) {
    const r = await both.get(basic(SVERH.login, SVERH.pass));
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.leads.length, 1);
  }
  assert.equal((await both.get(basic(SVERH.login, SVERH.pass), '/api/admin/events?m=2026-11')).status, 200);
});

test('неверная пара – 401', async () => {
  assert.equal((await both.get(basic(SVERH.login, 'чужой-пароль-123'))).status, 401);
  assert.equal((await both.get(basic(SVERH.login, ''))).status, 401);
  assert.equal((await both.get(basic('кто-то', SVERH.pass))).status, 401);
  assert.equal((await both.get(basic(OWNER.login, SVERH.pass))).status, 401);
  assert.equal((await both.get(basic(SVERH.login, OWNER.pass))).status, 401);
  assert.equal((await both.get(basic(SVERH.login, HASH))).status, 401); // сам хэш паролем не служит
});

test('пара владельца работает как была', async () => {
  const r = await both.get(basic(OWNER.login, OWNER.pass));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).leads.length, 1);
});

test('СВЕРХ не настроен или хэш не того вида – вход выключен, владелец входит', async () => {
  for (const s of [alone, broken]) {
    assert.equal((await s.get(basic(OWNER.login, OWNER.pass))).status, 200);
    assert.equal((await s.get(basic(SVERH.login, SVERH.pass))).status, 401);
    assert.equal((await (await s.get({}, '/api/health')).json()).sverh, false);
  }
  assert.equal((await (await both.get({}, '/api/health')).json()).sverh, true);
});

test('перебор: после 20 отказов с адреса – 429, хэш больше не считается', async () => {
  const s = await start({ SVERH_LOGIN: SVERH.login, SVERH_PASS_HASH: HASH });
  const codes = [];
  for (let i = 0; i < 22; i++) codes.push((await s.get(basic(SVERH.login, 'мимо-' + i))).status);
  assert.deepEqual(codes.slice(0, 20), Array(20).fill(401));
  assert.equal(codes[21], 429);
  assert.equal((await s.get(basic(OWNER.login, OWNER.pass))).status, 200); // владелец с того же адреса входит
});
