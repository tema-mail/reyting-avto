// «SEO-аналитика» кабинета avtoball.ru: Яндекс Вебмастер по API (отчёт scripts/otchety.mjs → /api/admin/report/seo) и статус Google.
// Статусы как у EV (seo_map): measured – цифры, not_collected – источник ещё не отдал, unavailable – нет доступа (с причиной). Пропуск – не ноль.
import { useEffect, useState } from 'preact/hooks';
import { adminAuth } from './auth';

type R = any;
const nf = new Intl.NumberFormat('ru-RU');
const fmt = (n: number | null | undefined) => (n == null ? '–' : nf.format(Math.round(n)));
const stamp = (iso: string) => new Date(iso).toLocaleString('ru-RU', { timeZone: 'Asia/Novosibirsk', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const ST: Record<string, string> = { measured: 'собрано', not_collected: 'Яндекс ещё не отдал данные', unavailable: 'нет доступа' };
const HOST_ST: Record<string, string> = { NOT_LOADED: 'Яндекс ещё не загрузил сайт – первый обход нового домена', OK: 'сайт загружен', NOT_INDEXED: 'не в индексе' };

function Status({ x }: { x: R }) {
  return <span class="chip">{ST[x?.status] || x?.status || '–'}{x?.error ? ` · ${String(x.error).slice(0, 120)}` : ''}</span>;
}

export default function Seo() {
  const [s, setS] = useState<{ kind: 'loading' | 'ok' | 'error'; d?: R; text?: string }>({ kind: 'loading' });
  useEffect(() => {
    fetch('/api/admin/report/seo', { headers: { Authorization: adminAuth() }, cache: 'no-store' })
      .then(async (r) => { if (r.status === 404) throw new Error('отчёт ещё не собран'); if (!r.ok) throw new Error(`сервер ответил ${r.status}`); return r.json(); })
      .then((d) => setS({ kind: 'ok', d })).catch((e) => setS({ kind: 'error', text: String(e.message || e) }));
  }, []);
  if (s.kind === 'loading') return <p class="muted" style="padding:28px">Загружаем отчёт…</p>;
  if (s.kind === 'error') return <p class="demo-note">SEO-отчёт: {s.text}.</p>;
  const d = s.d;
  const sum = d.summary || {};
  const q = d.queries || {};
  return (
    <div>
      <div class="tools"><h1>SEO-аналитика</h1><span class="muted" style="font-size:12px">Отчёт от {stamp(d.at)}</span></div>
      <div class="tw"><table class="vt" style="width:100%"><tbody>
        <tr><th>Яндекс Вебмастер</th><td>{d.host_status?.verified ? 'права подтверждены' : 'права не подтверждены'} · {HOST_ST[d.host_status?.data_status] || d.host_status?.data_status || d.error || '–'}</td></tr>
        <tr><th>Страниц в поиске</th><td>{sum.status === 'measured' ? fmt(sum.searchable_pages_count) : <Status x={sum} />}</td></tr>
        <tr><th>Загружено роботом</th><td>{sum.status === 'measured' ? fmt(sum.downloaded_pages_count) : '–'}</td></tr>
        <tr><th>Исключено</th><td>{sum.status === 'measured' ? fmt(sum.excluded_pages_count) : '–'}</td></tr>
        <tr><th>Карты сайта</th><td>{d.sitemaps?.status === 'measured' ? (d.sitemaps.sitemaps || []).map((x: R) => x.sitemap_url).join(', ') || 'добавленных нет – Яндекс берёт карту из robots.txt' : <Status x={d.sitemaps} />}</td></tr>
        <tr><th>Google Search Console</th><td><Status x={d.google} /></td></tr>
      </tbody></table></div>
      <h2 style="margin:22px 0 8px;font-size:16px">Запросы в Яндексе {q.status === 'measured' && <span class="muted" style="font-size:12px;font-weight:400">{q.from?.slice(0, 10)} – {q.to?.slice(0, 10)}</span>}</h2>
      {q.status !== 'measured' ? <p class="demo-note"><Status x={q} /> Запросы появятся после первого обхода и показов сайта в поиске.</p> : (
        <div class="tw"><table class="vt" style="width:100%">
          <thead><tr><th>Запрос</th><th>Показы</th><th>Клики</th><th>Средняя позиция</th></tr></thead>
          <tbody>{q.rows.map((x: R) => <tr><td>{x.q}</td><td>{fmt(x.TOTAL_SHOWS)}</td><td>{fmt(x.TOTAL_CLICKS)}</td><td>{x.AVG_SHOW_POSITION ? x.AVG_SHOW_POSITION.toFixed(1) : '–'}</td></tr>)}</tbody>
        </table></div>
      )}
    </div>
  );
}
