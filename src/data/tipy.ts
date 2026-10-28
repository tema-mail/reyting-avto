// Типы текстов рейтинга и компании.

export interface CompanyTexts {
  name: string; // как в рейтинге: «Reaktor (ул. Писарева, 73)»
  brand: string; // бренд без ООО/«автосервис» – из него slug и заголовок карточки
  cells: string[]; // ячейки таблицы рейтинга после цифр карт (столбцы tableCols)
  note?: string; // строка под заголовком компании (раскрытие связи)
  pros?: string[];
  attention?: string;
  fit?: string;
  short?: string; // строка для компаний ниже седьмого места
  phoneNote?: string;
}

export interface NicheTexts {
  slug: string;
  title: string;
  description: string;
  h1: string;
  crumb: string;
  menu: string;
  who: string; // «центров» / «сервисов»
  whoGen: string; // «установочных центров»
  schemaType: 'AutomotiveBusiness' | 'AutoRepair';
  kind: (c: { dealer: boolean; brands: string | null }) => string;
  short: string; // «Коротко»: {s:<название в съёме>} подставляет балл из формулы
  shortAfter: string;
  disclosure?: string;
  bullets: string[];
  tableH2: string;
  tableLead: string;
  tableCols: string[];
  tableNote: string;
  bestH2: string;
  best: string[];
  detailH2: string;
  restH3: string;
  help: {
    title: string;
    text: string;
    carLabel: string;
    carPlaceholder: string;
    selectLabel: string;
    options: string[];
    extraLabel: string;
    extraOptions?: string[];
    button: string;
  };
  howH2: string;
  how: string;
  checkH2: string;
  check: string[];
  pricesH2: string;
  pricesLead: string;
  prices: [string, string, string][];
  pricesNote: string;
  faq: [string, string][];
  otherNote: string;
  addH2: string;
  add: string;
  homeLine: string;
  hubScenario: string;
  methodNote: string;
  companies: Record<string, CompanyTexts>;
}
