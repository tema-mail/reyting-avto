// Общие сведения о сайте. Название рабочее – ждёт решения владельца (docs/resheniya.md).
export const SITE_NAME = 'Автобалл';
export const DATA_DATE = '2026-10-25'; // съём Яндекс Карт, 2ГИС и сайтов компаний для двух первых ниш
export const YA_DATE = '2026-10-28'; // съём Яндекс Карт для остальных ниш (только Яндекс)
export const FORMULA_DATE = '2026-10-25'; // дата последнего изменения формулы
export const PUBLISHED = '2026-10-28'; // первая публикация страниц

/** Тестовая копия закрыта от поиска целиком (workflow ставит PUBLIC_NOINDEX=1). */
export const NOINDEX_ALL = import.meta.env.PUBLIC_NOINDEX === '1';
/** Куда уходят заявки. Пусто – формы честно говорят, что заявки пока не принимаются. */
export const FORM_ENDPOINT: string = import.meta.env.PUBLIC_FORM_ENDPOINT || '';

export const CITY = { slug: 'novosibirsk', name: 'Новосибирск', in: 'в Новосибирске', of: 'Новосибирска' };
