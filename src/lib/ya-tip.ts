// Типы ниш «только Яндекс Карты» (вынесены из ya.ts 01.11.2026, когда городов стало два).
import type { NicheTextYa } from '../data/nishi/tip';
import type { Gorod } from './goroda';

export interface Branch {
  id: string;
  name: string;
  address: string;
  rayon: string; // пусто – у города нет границ районов (gorod-dannye.mjs)
  rating: number;
  ratings: number;
  reviews: number;
  last: string | null;
  recent: number;
  site: string | null;
  phones: string[];
  hours: string;
  allDay: boolean;
  rubrics: string[];
  card: string;
  good: boolean;
  owner: boolean;
}

/** Цена «от» с сайта компании (только услуги; товары в нишах услуг не показываем). */
export interface Price {
  name: string;
  from: number;
  url: string;
}

export interface YaRow {
  city: Gorod;
  niche: string;
  place: number;
  score: number;
  raw: number;
  parts: { rating: number; reviews: number; fresh: number; open: number };
  name: string;
  display: string;
  rating: number;
  ratings: number;
  reviews: number;
  last: string | null;
  days: number | null;
  recent: number;
  site: boolean;
  hours: boolean;
  owner: boolean;
  good: boolean;
  allDay: boolean;
  branches: Branch[];
  ids: string[];
  rayony: string[];
  url: string | null; // карточка на сайте (топ-20 или уже есть карточка)
  prices: Price[]; // по возрастанию цены; пусто – цен на сайте не нашли
  priceFrom: number | null;
  entity?: Entity;
  partner?: boolean; // выбор редакции: закреплён первым (data/partnery.ts)
}

export interface NicheYa {
  kind: 'ya';
  city: Gorod;
  key: string;
  url: string;
  t: NicheTextYa;
  group: string;
  schema: string;
  who: [string, string, string];
  rule: string;
  date: string;
  found: number;
  rejected: Record<string, number>;
  published: boolean;
  rows: YaRow[];
  top: YaRow[];
  rest: YaRow[];
  reviews: number;
  priceDate: string | null; // дата съёма цен; null – цен для ниши нет
  dup?: { key: string; crumb: string; share: number }; // не опубликована: состав дублирует другую нишу
  byRayon: boolean; // поиск шёл по городу и по районам (у компаний есть поле «найдено_по»)
}

export interface Entity {
  city: Gorod;
  slug: string;
  url: string;
  name: string;
  oldSlug: string | null; // карточка старой ниши (Я+2ГИС), только Новосибирск
  rows: YaRow[]; // места в нишах Яндекса, лучшее место первым
  branches: Branch[];
  label: string; // имя для title: при совпадении названий – с улицей или нишей
  index: boolean; // индексировать: есть отзывы, цены с сайта или топ-5 хотя бы одного рейтинга (иначе noindex, follow)
}
