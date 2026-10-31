// Мини-разметка для текстов из data/: **жирный**, [текст](/адрес/), {?что подтвердить?}.
// {?…?} – видимая пометка «подтвердить»: решение владельца или данные, которых нет (не выдумываем).
import { u } from './url';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// SEO-проверка 28.10: видимые пометки остаются только в «О проекте» и юр. документах (show = true);
// на остальных страницах пометка не выводится, строка из одной пометки – «–».
export function md(s: string, show = false): string {
  if (!show && /^\s*\{\?[\s\S]*\?\}\s*$/.test(s)) return '–';
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\s*\{\?(.+?)\?\}/g, (_m, t) => '')
    .replace(/\[(.+?)\]\((\/[^)]*)\)/g, (_m, t, href) => `<a href="${u(href)}">${t}</a>`);
}

/** Есть ли в тексте пометки «подтвердить» */
export const hasConfirm = (s: string) => /\{\?/.test(s);
/** Текст есть и это не одна пометка «подтвердить» */
export const real = (s?: string | null) => !!s && !/^\s*\{\?[\s\S]*\?\}\s*$/.test(s);
