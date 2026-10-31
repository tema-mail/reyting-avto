// «Позиции» кабинета avtoball.ru – открыты владельцем 01.11.2026, без нейросетей и без платного XMLRiver:
// Яндекс – средняя позиция показа по запросам из Вебмастера (бесплатно, отчёт scripts/otchety.mjs → /api/admin/report/seo),
// Google – из Search Console, когда ресурс будет подключён. Нейросети – только по разрешению владельца (admin-builder/memory/rules.md).
import { useEffect, useState } from 'preact/hooks';
import { adminAuth } from './auth';

type R = any;
const nf = new Intl.NumberFormat('ru-RU');
const fmt = (n: number | null | undefined) => (n == null ? '–' : nf.format(Math.round(n)));
const BANDS: [string, (p: number) => boolean][] = [['Топ-3', (p) => p <= 3], ['4–10', (p) => p > 3 && p <= 10], ['11–30', (p) => p > 10 && p <= 30], ['Дальше 30', (p) => p > 30]];

export default function Positions() {
  const [s, setS] = useState<{ kind: 'loading' | 'ok' | 'error'; d?: R; text?: string }>({ kind: 'loading' });
  const [q, setQ] = useState('');
  useEffect(() => {
    fetch('/api/admin/report/seo', { headers: { Authorization: adminAuth() }, cache: 'no-store' })
      .then(async (r) => { if (r.status === 404) throw new Error('отчёт ещё не собран'); if (!r.ok) throw new Error(`сервер ответил ${r.status}`); return r.json(); })
      .then((d) => setS({ kind: 'ok', d })).catch((e) => setS({ kind: 'error', text: String(e.message || e) }));
  }, []);
  if (s.kind === 'loading') return <p class="muted" style="padding:28px">Загружаем позиции…</p>;
  if (s.kind === 'error') return <p class="demo-note">Позиции: {s.text}.</p>;
  const qs = s.d.queries || {};
  const rows: R[] = qs.status === 'measured' ? qs.rows.filter((x: R) => x.AVG_SHOW_POSITION) : [];
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((x) => !needle || x.q.toLowerCase().includes(needle)).sort((a, b) => a.AVG_SHOW_POSITION - b.AVG_SHOW_POSITION);
  return (
    <div>
      <div class="tools">
        <h1>Позиции</h1>
        <span class="seg"><button class="on">Яндекс</button><button disabled title="Search Console ещё не подключён">Google</button></span>
        <input type="search" placeholder="Запрос" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </div>
      <p class="muted" style="font-size:13px">Средняя позиция показа по запросам Яндекс Вебмастера{qs.from ? ` за ${qs.from.slice(0, 10)} – ${qs.to.slice(0, 10)}` : ''}. Google появится после подключения Search Console. Нейросети не собираем.</p>
      {qs.status !== 'measured' ? (
        <p class="demo-note">Яндекс ещё не загрузил сайт и не отдаёт запросы ({s.d.host_status?.data_status || qs.code}). Позиции появятся после первого обхода и показов в поиске.</p>
      ) : (
        <>
          <div class="tw"><table class="vt"><tbody><tr>{BANDS.map(([l, f]) => <td><b>{rows.filter((x) => f(x.AVG_SHOW_POSITION)).length}</b> <span class="muted">{l}</span></td>)}</tr></tbody></table></div>
          <div class="tw" style="margin-top:12px"><table class="vt" style="width:100%">
            <thead><tr><th>Запрос</th><th>Позиция</th><th>Показы</th><th>Клики</th></tr></thead>
            <tbody>{shown.map((x) => <tr><td>{x.q}</td><td><b>{x.AVG_SHOW_POSITION.toFixed(1)}</b></td><td>{fmt(x.TOTAL_SHOWS)}</td><td>{fmt(x.TOTAL_CLICKS)}</td></tr>)}</tbody>
          </table></div>
        </>
      )}
    </div>
  );
}
