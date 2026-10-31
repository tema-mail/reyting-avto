// Партнёры проекта: решение владельца 28.10.2026 – стоят первыми в своих нишах блоком «Выбор редакции»,
// с полной карточкой (сайт, телефон, запись). Правило раскрыто в «О проекте» и на «Методике».

export interface Partner {
  key: string;
  name: string;
  about: string;
  address: string;
  phone: string;
  site: string;
  yandex?: string;
  services: string[];
  /** Карточка на Яндекс Картах: настоящие цифры, которые показываем в строке рейтинга. */
  ya: { id: string; rating: number; ratings: number; reviews: number; last: string | null; recent: number; coords: [number, number]; hours: string };
}

export const PARTNERS: Record<string, Partner> = {
  'teyes-sibir': {
    key: 'teyes-sibir',
    name: 'Teyes Sibir',
    about: 'Официальный дилер и установочный центр мультимедиа Teyes в Новосибирске: Android-магнитолы, камеры, парктроники, сигнализации и автозапуск.',
    address: 'Сухарная ул., 35, корп. 13',
    phone: '+7 (995) 437-92-66',
    site: 'https://teyes-sibir.ru/',
    yandex: 'https://yandex.ru/maps/org/teyes_sibir/103758102748/',
    services: ['Установка мультимедиа Teyes', 'Камеры и парктроники', 'Сигнализации и автозапуск', 'Русификация мультимедиа'],
    ya: { id: '103758102748', rating: 4.8, ratings: 49, reviews: 29, last: '2026-10-25', recent: 17, coords: [82.873091, 55.04484], hours: 'пн-пт 11:00–19:00' },
  },
  evolution: {
    key: 'evolution',
    name: 'Evolution Car Service',
    about: 'Техцентр электромобилей, гибридов и китайских автомобилей в Новосибирске: техническое обслуживание, диагностика, ремонт и русификация.',
    address: 'Сухарная ул., 35, корп. 13',
    phone: '+7 (993) 953-37-28',
    site: 'https://evolutioncarservice.ru/',
    yandex: 'https://yandex.ru/maps/org/evolution_sibir/161009443026/',
    services: ['ТО электромобилей и гибридов', 'Сервис китайских автомобилей', 'Русификация автомобилей', 'Диагностика'],
    ya: { id: '161009443026', rating: 4.4, ratings: 9, reviews: 5, last: '2024-12-16', recent: 0, coords: [82.873091, 55.04484], hours: '' },
  },
};

/** Кто стоит первым в нише (порядок = места). */
export const PARTNER_NICHES: Record<string, string[]> = {
  'ustanovka-magnitol': ['teyes-sibir'],
  avtosignalizatsii: ['teyes-sibir'],
  'ustanovka-avtozapuska': ['teyes-sibir'],
  avtozvuk: ['teyes-sibir'],
  'rusifikatsiya-avtomobiley': ['evolution', 'teyes-sibir'],
  'servis-kitayskikh-avtomobiley': ['evolution'],
  'remont-elektromobiley-i-gibridov': ['evolution'],
  // китайские марки (владелец 01.11.2026): Evolution первым во всех
  'servis-zeekr': ['evolution'],
  'servis-lixiang': ['evolution'],
  'servis-voyah': ['evolution'],
  'servis-lynk-co': ['evolution'],
  'servis-changan': ['evolution'],
  'servis-byd': ['evolution'],
  'servis-avatr': ['evolution'],
};

export const partnersOf = (niche: string): Partner[] => (PARTNER_NICHES[niche] || []).map((k) => PARTNERS[k]);

/** Сайт показываем только у партнёров: остальные получают его после подтверждения данных. */
const PARTNER_SITES = Object.values(PARTNERS).map((p) => new URL(p.site).hostname.replace(/^www\./, ''));
export const isPartnerSite = (url?: string | null): boolean => {
  if (!url) return false;
  try {
    return PARTNER_SITES.includes(new URL(url).hostname.replace(/^www\./, ''));
  } catch {
    return false;
  }
};

/** Телефон партнёра с его сайта – вместо телефона из съёма карт (в карточке Яндекса старый номер). */
export const partnerPhone = (yaId: string): string | null => Object.values(PARTNERS).find((p) => p.ya.id === yaId)?.phone || null;
