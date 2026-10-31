// «Метрика» кабинета avtoball.ru – вид и стили перенесены с кабинета gaz-mag (TEYES Sibir, макет утверждён 14.10.2026: .mx, kpis, ch).
// Данные: отчёт scripts/otchety.mjs (Метрика по API) – /api/admin/report/metrika; свой счётчик без cookie – /api/admin/events.
// Владелец 01.11.2026: «Метрика с разбивкой по городам» – два среза: город посетителя (гео Метрики) и город сайта (раздел адреса).
// Весь текст выводится через Preact (экранируется), без innerHTML.
import { useEffect, useState } from 'preact/hooks';
import { adminAuth } from './auth';

type R = any;
interface City { slug: string; name: string }
const PERIODS: [string, string, number][] = [['week', 'Неделя', 7], ['month', 'Месяц', 30], ['quarter', 'Квартал', 90], ['year', 'Год', 365]];
const nf = new Intl.NumberFormat('ru-RU');
const fmt = (n: number | null | undefined) => (n == null || !isFinite(n) ? '–' : nf.format(Math.round(n)));
const pct = (n: number) => (isFinite(n) ? n.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + '%' : '–');
const stamp = (iso: string) => new Date(iso).toLocaleString('ru-RU', { timeZone: 'Asia/Novosibirsk', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const EV_NAMES: Record<string, string> = { in: 'Входы', pv: 'Просмотры', phone: 'Звонки', msg: 'Мессенджеры', form: 'Формы' };

function Bars({ rows, head }: { rows: [string, number, string?][]; head: [string, string] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p class="muted">Данных за период нет.</p>;
  return (
    <div class="ch ch--noc">
      <span class="h">{head[0]}</span><span class="h hv">{head[1]}</span><span class="h hl"></span>
      {rows.map(([name, v, note]) => (
        <>
          <span class="name">{name}</span>
          <span class="track"><span class="b b--visits" style={`width:${Math.max(2, (v / max) * 220)}px`} /><em>{fmt(v)}</em></span>
          <span class="muted" style="font-size:12px">{note || ''}</span>
        </>
      ))}
    </div>
  );
}

const sectionCity = (path: string, cities: City[]) => {
  const seg = path.replace(/^https?:\/\/[^/]+/, '').split('/').filter(Boolean)[0] || '';
  return cities.find((c) => c.slug === seg)?.name || 'Общие страницы (главная, методика, документы)';
};
function sumBy<T>(list: T[], key: (x: T) => string, val: (x: T) => number) {
  const m = new Map<string, number>();
  for (const x of list) m.set(key(x), (m.get(key(x)) || 0) + val(x));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function MetrikaView({ rep, period, cities }: { rep: R; period: string; cities: City[] }) {
  const p = rep.periods?.[period];
  if (!p) return <p class="muted">Нет отчёта за период.</p>;
  if (p.totals.status !== 'measured') return <p class="demo-note">Метрика не ответила: {p.totals.code} {p.totals.error}</p>;
  const t = p.totals.totals || [];
  const goalNames = (rep.goals || []).map((g: R) => g.name);
  const kpis: [string, string][] = [['Визиты', fmt(t[0])], ['Посетители', fmt(t[1])], ['Просмотры', fmt(t[2])], ['Отказы', pct(t[3])], ...goalNames.map((n: string, i: number) => [`Цель: ${n}`, fmt(t[4 + i])] as [string, string])];
  const rows = (x: R) => (x?.status === 'measured' ? x.rows : []);
  return (
    <>
      <section class="kpis" aria-label="Сводка">{kpis.map(([l, v], i) => <div class={`kpi${i === 0 ? ' kpi--main' : ''}`}><span class="kpi__label">{l}</span><span class="kpi__value">{v}</span></div>)}</section>
      <div class="panel" style="margin-top:14px"><h2>Каналы</h2><Bars head={['Канал', 'Визиты']} rows={rows(p.sources).map((r: R) => [r.key, r.v[0]])} /></div>
      <div class="panel" style="margin-top:14px"><h2>По городам: откуда посетители</h2><p class="muted" style="font-size:13px">Город посетителя по данным Метрики.</p><Bars head={['Город посетителя', 'Визиты']} rows={rows(p.geo).map((r: R) => [r.key === '–' ? 'не определён' : r.key, r.v[0]])} /></div>
      <div class="panel" style="margin-top:14px"><h2>По городам сайта</h2><p class="muted" style="font-size:13px">Какие рейтинги смотрят: просмотры по разделу адреса (/novosibirsk/…, /kazan/…).</p><Bars head={['Город сайта', 'Просмотры']} rows={sumBy(rows(p.sections), (r: R) => sectionCity(r.key, cities), (r: R) => r.v[0])} /></div>
      <div class="panel" style="margin-top:14px"><h2>Поисковые системы</h2><Bars head={['Поисковик', 'Визиты']} rows={rows(p.engines).map((r: R) => [r.key === '–' ? 'не из поиска' : r.key, r.v[0]])} /></div>
      <div class="panel" style="margin-top:14px"><h2>Страницы входа</h2><Bars head={['Страница', 'Визиты']} rows={rows(p.landing).slice(0, 30).map((r: R) => [r.key, r.v[0], `отказы ${pct(r.v[1])}`])} /></div>
    </>
  );
}

function OwnView({ period, cities }: { period: string; cities: City[] }) {
  const [state, setState] = useState<{ ev: R[] | null; err?: string }>({ ev: null });
  const daysN = PERIODS.find((x) => x[0] === period)![2];
  useEffect(() => {
    const months: string[] = [];
    for (let d = 0; d <= daysN + 31; d += 28) { const m = new Date(Date.now() - d * 864e5).toISOString().slice(0, 7); if (!months.includes(m)) months.push(m); }
    Promise.all(months.map((m) => fetch(`/api/admin/events?m=${m}`, { headers: { Authorization: adminAuth() }, cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(`сервер ответил ${r.status}`); return r.json(); })))
      .then((all) => setState({ ev: all.flatMap((x) => x.events || []) }))
      .catch((e) => setState({ ev: [], err: String(e.message || e) }));
  }, [period]);
  if (!state.ev) return <p class="muted">Загружаем события…</p>;
  if (state.err) return <p class="demo-note">События не загрузились: {state.err}</p>;
  const from = Date.now() - daysN * 864e5;
  const ev = state.ev.filter((e: R) => Date.parse(e.t) >= from);
  const count = (k: string) => ev.filter((e: R) => e.e === k).length;
  const target = count('phone') + count('msg') + count('form');
  const kpis: [string, string][] = [['Входы', fmt(count('in'))], ['Просмотры', fmt(count('pv'))], ['Целевые действия', fmt(target)], ['Звонки', fmt(count('phone'))], ['Мессенджеры', fmt(count('msg'))], ['Формы', fmt(count('form'))], ['Конверсия входов', pct(count('in') ? (target / count('in')) * 100 : NaN)]];
  const ins = ev.filter((e: R) => e.e === 'in');
  return (
    <>
      <p class="muted" style="font-size:13px">Свой счётчик сайта считает всех посетителей – без cookie и без данных о человеке: страница, действие, источник, время.</p>
      <section class="kpis">{kpis.map(([l, v], i) => <div class={`kpi${i === 2 ? ' kpi--main' : ''}`}><span class="kpi__label">{l}</span><span class="kpi__value">{v}</span></div>)}</section>
      <div class="panel" style="margin-top:14px"><h2>По городам сайта</h2><Bars head={['Город сайта', 'Просмотры']} rows={sumBy(ev.filter((e: R) => e.e === 'pv'), (e: R) => sectionCity(e.p, cities), () => 1)} /></div>
      <div class="panel" style="margin-top:14px"><h2>Целевые действия по городам</h2><Bars head={['Город сайта', 'Действия']} rows={sumBy(ev.filter((e: R) => ['phone', 'msg', 'form'].includes(e.e)), (e: R) => sectionCity(e.p, cities), () => 1)} /></div>
      <div class="panel" style="margin-top:14px"><h2>Откуда пришли</h2><Bars head={['Источник', 'Входы']} rows={sumBy(ins, (e: R) => e.r || 'прямой заход', () => 1)} /></div>
      <div class="panel" style="margin-top:14px"><h2>Страницы: просмотры и действия</h2><Bars head={['Страница', 'Просмотры']} rows={sumBy(ev.filter((e: R) => e.e === 'pv'), (e: R) => e.p, () => 1).slice(0, 40).map(([p, v]) => [p, v, `действий: ${ev.filter((e: R) => e.p === p && EV_NAMES[e.e] && !['in', 'pv'].includes(e.e)).length}`])} /></div>
    </>
  );
}

export default function Metrika({ cities }: { cities: City[] }) {
  const [rep, setRep] = useState<{ kind: 'loading' | 'ok' | 'error'; data?: R; text?: string }>({ kind: 'loading' });
  const [period, setPeriod] = useState('month');
  const [src, setSrc] = useState<'metrika' | 'own'>('own');
  useEffect(() => {
    fetch('/api/admin/report/metrika', { headers: { Authorization: adminAuth() }, cache: 'no-store' })
      .then(async (r) => { if (r.status === 404) throw new Error('отчёт ещё не собран'); if (!r.ok) throw new Error(`сервер ответил ${r.status}`); return r.json(); })
      .then((data) => setRep({ kind: 'ok', data }))
      .catch((e) => setRep({ kind: 'error', text: String(e.message || e) }));
  }, []);
  return (
    <div>
      <div class="tools">
        <h1>Метрика</h1>
        <span class="seg">{([['own', 'Свой счётчик'], ['metrika', 'Яндекс Метрика']] as const).map(([k, l]) => <button class={src === k ? 'on' : ''} onClick={() => setSrc(k)}>{l}</button>)}</span>
        <span class="seg">{PERIODS.map(([k, l]) => <button class={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</span>
        {rep.kind === 'ok' && <span class="muted" style="font-size:12px">Метрика: счётчик {rep.data.counter}, отчёт от {stamp(rep.data.at)}</span>}
      </div>
      {src === 'own' ? <OwnView period={period} cities={cities} /> : rep.kind === 'loading' ? <p class="muted">Загружаем отчёт…</p> : rep.kind === 'error' ? <p class="demo-note">Отчёт Метрики: {rep.text}.</p> : (
        <>
          <p class="muted" style="font-size:13px">{rep.data.note}</p>
          <MetrikaView rep={rep.data} period={period} cities={cities} />
        </>
      )}
    </div>
  );
}
