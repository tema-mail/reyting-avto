// Числа и даты по-русски: десятичная запятая, неразрывный пробел в тысячах.
const NBSP = ' ';

export function num(n: number, digits = 0): string {
  const fixed = n.toFixed(digits);
  const [int, frac] = fixed.split('.');
  const grouped = int.length > 3 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) : int;
  return frac ? `${grouped},${frac}` : grouped;
}

/** Балл до десятых: 8,5 */
/** Балл; NaN – у партнёра, которого не было в съёме ниши (закреплён первым без расчёта) – «–». */
export const score = (n: number) => (Number.isNaN(n) ? '–' : num(Math.round(n * 10) / 10, 1));

/** Оценка с карт как в источнике: 4,94 / 5,0 / 4,8 */
export function rating(n: number): string {
  const s = String(n);
  return s.includes('.') ? s.replace('.', ',') : `${s},0`;
}

/** 2026-10-25 → 25.10.2026 */
export function date(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Склонение: plural(3, ['отзыв','отзыва','отзывов']) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** Телефон для ссылки tel: */
export const telHref = (phone: string) => 'tel:' + phone.replace(/[^\d+]/g, '').replace(/^8/, '+7');
