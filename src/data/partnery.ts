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
}

export const PARTNERS: Record<string, Partner> = {
  'teyes-sibir': {
    key: 'teyes-sibir',
    name: 'Teyes Sibir',
    about: 'Официальный дилер и установочный центр мультимедиа Teyes в Новосибирске: Android-магнитолы, камеры, парктроники, сигнализации и автозапуск.',
    address: 'Сухарная ул., 35, корп. 13',
    phone: '+7 (905) 945-06-95',
    site: 'https://teyes-sibir.ru/',
    yandex: 'https://yandex.ru/maps/org/teyes_sibir/103758102748/',
    services: ['Установка мультимедиа Teyes', 'Камеры и парктроники', 'Сигнализации и автозапуск', 'Русификация мультимедиа'],
  },
  evolution: {
    key: 'evolution',
    name: 'Evolution Car Service',
    about: 'Техцентр электромобилей, гибридов и китайских автомобилей в Новосибирске: техническое обслуживание, диагностика, ремонт и русификация.',
    address: 'Сухарная ул., 35, корп. 13',
    phone: '+7 (993) 953-37-28',
    site: 'https://evolutioncarservice.ru/',
    services: ['ТО электромобилей и гибридов', 'Сервис китайских автомобилей', 'Русификация автомобилей', 'Диагностика'],
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
