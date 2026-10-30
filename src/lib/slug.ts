// Адрес карточки компании (правила карты сайта): бренд без ООО/кавычек, латиница как есть,
// кириллица – транслит Яндекса (х→kh, ц→ts, й→y, ь/ъ – выбросить), пробелы, точки, «&» → «-», до 60 знаков по слову.
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
export const RESERVED = ['companies', 'districts', 'ustanovka-magnitol', 'servis-kitayskikh-avtomobiley'];

export function slugify(brand: string): string {
  let s = brand
    .toLowerCase()
    .replace(/[«»"']/g, '')
    .split('')
    .map((ch) => (ch in MAP ? MAP[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (s.length > 60) s = s.slice(0, 60).replace(/-[^-]*$/, '');
  if (RESERVED.includes(s)) throw new Error(`slug «${s}» зарезервирован`);
  return s;
}
