// Мини-разметка для текстов из data/: **жирный**, [текст](/адрес/), {?что подтвердить?}.
// {?…?} – видимая пометка «подтвердить»: решение владельца или данные, которых нет (не выдумываем).
import { u } from './url';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function md(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\{\?(.+?)\?\}/g, '<mark class="confirm">подтвердить: $1</mark>')
    .replace(/\[(.+?)\]\((\/[^)]*)\)/g, (_m, t, href) => `<a href="${u(href)}">${t}</a>`);
}

/** Есть ли в тексте пометки «подтвердить» */
export const hasConfirm = (s: string) => /\{\?/.test(s);
