import { useEffect, useState } from 'preact/hooks';
import { adminAuth } from './auth';

/* «Заявки» – перенос с кабинета gaz-mag (стандарт Milovini; доска – эталон ALEX KROWN v1 / EV SIBIR). Сайт-рейтинг без
   товаров: у заявки поля формы («Помочь выбрать» – машина и задача, «Добавить компанию» – компания и ниша), категория –
   ниша из формы или первый раздел страницы. Заявки живые с приёмника avtoball.ru (server/lead.mjs, GET /api/leads),
   этап меняется перетаскиванием и сохраняется на сервере (PATCH, история). «Архив» – отдельная колонка (правило 27.10).
   Вход – тот же логин и пароль, что у замка кабинета (ab_admin_*), второй формы входа нет. */

export interface LeadItem { uid: string; title: string; variant?: string; category: string; qty: number; price: number }
export interface Lead {
  id: string; createdAt: string; name: string; phone: string; email?: string; form: string; page: string; message?: string;
  stage: 'новая' | 'в работе' | 'выполнена' | 'отказ' | 'архив'; source: string; items: LeadItem[]; category: string;
  history?: { at: string; from: string; to: string }[]; extra?: [string, string][];
}

const STAGES: Lead['stage'][] = ['новая', 'в работе', 'выполнена', 'отказ', 'архив'];
const STAGE_TITLE: Record<Lead['stage'], string> = { 'новая': 'Новые', 'в работе': 'В работе', 'выполнена': 'Выполнена', 'отказ': 'Отказ', 'архив': 'Архив' };
const dt = (s: string) => new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Novosibirsk' });
const rub = (n: number) => n.toLocaleString('ru-RU').replace(/[  ]/g, ' ') + ' ₽';
const goods = (l: Lead) => l.items.map((i) => `${i.title}${i.variant ? ` (${i.variant})` : ''}${i.qty > 1 ? ` × ${i.qty}` : ''}`).join(', ');
const sum = (l: Lead) => l.items.reduce((s, i) => s + i.price * i.qty, 0);
const STD = new Set(['name', 'phone', 'email', 'fix', 'page']);
// подписи полей форм сайта (как в server/lead.mjs)
const LABELS: Record<string, string> = { telegram: 'Telegram', company: 'Компания', city: 'Город', niche: 'Ниша', car: 'Машина', task: 'Задача', warranty: 'Гарантия', area: 'Район', yandex: 'Яндекс Карты', gis: '2ГИС', site: 'Сайт', prices: 'Цены', status: 'Статус дилера', role: 'Кто' };

/** Строка leads.jsonl сервера → заявка кабинета. */
function fromServer(r: any): Lead {
  const f = r.fields || {};
  return {
    id: r.id || r.at, createdAt: r.at, name: f.name || f.company || '–', phone: f.phone || f.telegram || '', email: f.email, form: r.form, page: r.page || f.page || '',
    message: f.fix, stage: r.stage || 'новая', source: r.source || 'сайт', items: [], category: f.niche || (r.page || f.page || '').split('/').filter(Boolean).slice(-1)[0] || '',
    history: r.history, extra: Object.entries(f).filter(([k, v]) => !STD.has(k) && v).map(([k, v]) => [LABELS[k] || k, String(v)]) as [string, string][],
  };
}

const auth = adminAuth;

const leadsCsv = (rows: Lead[], cat: (s: string) => string) => {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['номер', 'дата', 'имя', 'телефон', 'почта', 'форма', 'детали', 'категория', 'сумма', 'страница', 'этап', 'источник', 'комментарий', 'в архиве'];
  const body = rows.map((l) => [l.id, dt(l.createdAt), l.name, l.phone, l.email ?? '', l.form, (l.extra || []).map((x) => x.join(': ')).join('; '), cat(l.category), sum(l) || '', l.page, STAGE_TITLE[l.stage], l.source, l.message ?? '', l.stage === 'архив' ? 'да' : ''].map(q).join(';'));
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + [head.join(';'), ...body].join('\r\n'));
};

function LeadsView({ leads, example, cats: catNames, onStage, onDelete }: {
  leads: Lead[]; example: boolean; cats: Record<string, string>; onStage: (id: string, stage: Lead['stage']) => Promise<boolean>; onDelete: (id: string) => Promise<boolean>;
}) {
  const [ask, setAsk] = useState(false);
  const [list, setList] = useState(leads);
  const [q, setQ] = useState('');
  const [src, setSrc] = useState('');
  const [cat, setCat] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<Lead | null>(null);
  const [err, setErr] = useState('');
  const catTitle = (s: string) => catNames[s] || s;
  const needle = q.trim().toLowerCase();
  const shown = list.filter((l) => (!src || l.source === src) && (!cat || l.category === cat) && (!needle || [l.id, l.name, l.phone, goods(l), ...(l.extra || []).map((x) => x[1])].join(' ').toLowerCase().includes(needle)));
  const cats = [...new Set(list.map((l) => l.category).filter(Boolean))];
  const sources = [...new Set(list.map((l) => l.source))];
  const move = async (id: string, stg: Lead['stage']) => {
    const before = list;
    setList(list.map((x) => (x.id === id ? { ...x, stage: stg } : x)));
    if (example) return;
    setErr('');
    if (!(await onStage(id, stg))) { setList(before); setErr('Этап не сохранился – проверьте связь и попробуйте ещё раз'); }
  };
  const drop = (stg: Lead['stage']) => { if (drag) move(drag, stg); setDrag(null); setOver(null); };
  return (
    <>
      <div class="tools">
        <h1>Заявки {example && <span class="chip">пример</span>}</h1>
        <span class="seg">
          <button class={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Доска</button>
          <button class={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>Списком</button>
        </span>
        <input type="search" placeholder="Номер, имя, телефон, компания" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <select value={cat} onChange={(e) => setCat((e.target as HTMLSelectElement).value)} aria-label="Категория"><option value="">Все категории</option>{cats.map((s) => <option value={s}>{catTitle(s)}</option>)}</select>
        <select value={src} onChange={(e) => setSrc((e.target as HTMLSelectElement).value)} aria-label="Источник"><option value="">Все источники</option>{sources.map((s) => <option>{s}</option>)}</select>
        <a class="btn" href={leadsCsv(shown, catTitle)} download="avtoball-leads.csv">⇩ CSV</a>
      </div>
      {err && <p class="demo-note" style="border-color:#e3a5ab;background:#fdf1f2">{err}</p>}
      {view === 'board' ? (
        <div class="kb">
          {STAGES.map((stg) => (
            <section class={`kb__col${over === stg ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(stg); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); drop(stg); }}>
              <h2>{STAGE_TITLE[stg]} <span>{shown.filter((l) => l.stage === stg).length}</span></h2>
              {shown.filter((l) => l.stage === stg).map((l) => (
                <article class={`kb__card${drag === l.id ? ' is-drag' : ''}`} draggable onDragStart={(e) => { e.dataTransfer?.setData('text/plain', l.id); setDrag(l.id); }} onDragEnd={() => setDrag(null)} onClick={() => setOpen(l)}>
                  <p class="kb__top"><b>№ {l.id}</b><span class="chip">{l.form}</span></p>
                  <p class="kb__who">{l.name} · {l.phone}</p>
                  {(l.extra || []).slice(0, 2).map(([k, v]) => <p class="kb__goods">{k}: {v}</p>)}
                  {l.items.length > 0 && <p class="kb__goods">{goods(l)}{sum(l) > 0 && <> · <b>{rub(sum(l))}</b></>}</p>}
                  {l.category && <p class="muted" style="font-size:12px">Категория: {catTitle(l.category)}</p>}
                  {l.message && <p>{l.message}</p>}
                  <p class="kb__meta"><span>{dt(l.createdAt)}</span><span class="muted">{l.source}</span></p>
                </article>
              ))}
              {shown.filter((l) => l.stage === stg).length === 0 && <p class="muted" style="font-size:12.5px;text-align:center;padding:16px 0">Пусто</p>}
            </section>
          ))}
        </div>
      ) : (
        <div class="tw">
          <table class="vt" style="width:100%">
            <thead><tr><th>Когда</th><th>Имя</th><th>Телефон</th><th>Детали</th><th>Категория</th><th>Форма</th><th>Источник</th><th>Этап</th></tr></thead>
            <tbody>
              {shown.map((l) => <tr onClick={() => setOpen(l)} style="cursor:pointer"><td>{dt(l.createdAt)}</td><td>{l.name}</td><td>{l.phone}</td><td>{(l.extra || []).slice(0, 2).map((x) => x[1]).join(' · ') || <span class="muted">–</span>}</td><td>{catTitle(l.category)}</td><td class="muted">{l.form}</td><td class="muted">{l.source}</td><td><span class="chip">{STAGE_TITLE[l.stage]}</span></td></tr>)}
              {!shown.length && <tr><td colSpan={8} class="muted" style="text-align:center;padding:20px">Заявок пока нет</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div class="ed" role="dialog" aria-modal="true" aria-label={`Заявка № ${open.id}`}>
          <div class="ed__bg" onClick={() => setOpen(null)} />
          <div class="ed__panel ed__panel--narrow">
            <header class="ed__head"><div><p class="muted" style="margin:0;font-size:12px">{open.form} · {dt(open.createdAt)}</p><h2>Заявка № {open.id}</h2></div><button class="btn" onClick={() => setOpen(null)}>Закрыть</button></header>
            <div class="ed__body">
              <table class="vt" style="width:100%"><tbody>
                <tr><th>Имя</th><td>{open.name}</td></tr>
                <tr><th>Телефон / Telegram</th><td>{/\d{10}/.test(open.phone.replace(/\D/g, '')) ? <a href={`tel:${open.phone.replace(/[^\d+]/g, '')}`}>{open.phone}</a> : open.phone || '–'}</td></tr>
                {open.email && <tr><th>Почта</th><td>{open.email}</td></tr>}
                <tr><th>Категория</th><td>{catTitle(open.category) || '–'}</td></tr>
                {open.message && <tr><th>Что исправить</th><td>{open.message}</td></tr>}
                {(open.extra || []).map(([k, v]) => <tr><th>{k}</th><td>{v}</td></tr>)}
                <tr><th>Страница</th><td>{open.page}</td></tr>
                <tr><th>Источник</th><td>{open.source}</td></tr>
                <tr><th>Этап</th><td><select value={list.find((x) => x.id === open.id)?.stage} onChange={(e) => move(open.id, (e.target as HTMLSelectElement).value as Lead['stage'])}>{STAGES.map((s) => <option value={s}>{STAGE_TITLE[s]}</option>)}</select></td></tr>
                {(open.history || []).length > 0 && <tr><th>История</th><td>{open.history!.map((h) => <div class="muted" style="font-size:12px">{dt(h.at)}: {h.from} → {h.to}</div>)}</td></tr>}
              </tbody></table>
            </div>
            {/* удаление – внутри заявки, через окно с архивом первым (правило кабинетов 27.10.2026, образец rozalii / EV) */}
            <footer class="ed__foot">
              {list.find((x) => x.id === open.id)?.stage === 'архив'
                ? <button class="btn" onClick={() => { move(open.id, 'новая'); setOpen(null); }}>Вернуть из архива</button>
                : <button class="btn ghost" style="color:#b0333f" onClick={() => setAsk(true)}>Удалить заявку</button>}
            </footer>
          </div>
        </div>
      )}
      {open && ask && (
        <div class="ed" role="dialog" aria-modal="true" aria-label="Удалить заявку" style="z-index:60">
          <div class="ed__bg" onClick={() => setAsk(false)} />
          <div class="ed__ask">
            <h2>Удалить заявку № {open.id}?</h2>
            <p class="muted">Удаление – насовсем: заявка и история этапов пропадут, отката нет. Из архива заявку можно вернуть, и она остаётся в статистике.</p>
            <div>
              <button class="btn primary" onClick={() => { move(open.id, 'архив'); setAsk(false); setOpen(null); }}>Перенести в архив</button>
              <button class="btn ghost" style="color:#b0333f;border:1px solid #b0333f" onClick={async () => {
                const id = open.id;
                setAsk(false); setOpen(null);
                if (example || (await onDelete(id))) setList((cur) => cur.filter((x) => x.id !== id));
                else setErr('Заявка не удалилась – проверьте связь и попробуйте ещё раз');
              }}>Удалить навсегда</button>
              <button class="btn ghost" onClick={() => setAsk(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Leads({ sample, cats }: { sample: Lead[]; cats: Record<string, string> }) {
  const [state, setState] = useState<{ kind: 'loading' | 'ok' | 'error'; leads: Lead[]; text?: string }>({ kind: 'loading', leads: [] });
  const [example, setExample] = useState(false);
  const [tg, setTg] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' }).then((r) => r.json()).then((d) => setTg(Boolean(d.telegram))).catch(() => setTg(null));
    fetch('/api/leads', { headers: { Authorization: auth() }, cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) throw new Error('сервер не принял вход кабинета');
        if (!r.ok) throw new Error(`сервер заявок ответил ${r.status}`);
        const d = await r.json();
        const leads = (d.leads || []).map(fromServer);
        setState({ kind: 'ok', leads });
        setExample(!leads.length);
      })
      .catch((e) => { setState({ kind: 'error', leads: [], text: String(e.message || e) }); setExample(true); });
  }, []);
  const onStage = async (id: string, stage: Lead['stage']) => {
    try {
      const r = await fetch(`/api/leads/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Authorization: auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) });
      return r.ok;
    } catch { return false; }
  };
  const onDelete = async (id: string) => {
    try { return (await fetch(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: auth() } })).ok; } catch { return false; }
  };
  if (state.kind === 'loading') return <p class="muted" style="padding:28px">Загружаем заявки…</p>;
  const empty = !state.leads.length;
  return (
    <div>
      {(empty || state.kind === 'error') && (
        <p class="demo-note">
          {state.kind === 'error'
            ? `Заявки с сервера не загрузились: ${state.text}. `
            : `Заявок с сайта пока нет – они появятся здесь сразу после первой заявки${tg ? ' (и придут в Telegram)' : tg === false ? '. Уведомления в Telegram пока не подключены – нужен бот владельца' : ''}. `}
          {example && 'Ниже – пример доски на настоящих формах сайта.'}
          <button class="btn" style="margin-left:auto" onClick={() => setExample(!example)}>{example ? 'Скрыть пример' : 'Показать пример'}</button>
        </p>
      )}
      <LeadsView key={String(example)} leads={example ? sample : state.leads} example={example} cats={cats} onStage={onStage} onDelete={onDelete} />
    </div>
  );
}
