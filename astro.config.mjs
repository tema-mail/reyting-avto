import { defineConfig } from 'astro/config';

// Адрес сайта для canonical и sitemap. Боевой домен не выбран (docs/resheniya.md),
// на время показа – GitHub Pages: PUBLIC_SITE_URL и PUBLIC_BASE задаёт workflow.
const SITE = process.env.PUBLIC_SITE_URL || 'https://tema-mail.github.io/reyting-avto';
// Подпапка для GitHub Pages (/reyting-avto), на своём домене – пусто.
const BASE = process.env.PUBLIC_BASE || '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  // Страницы-списка компаний нет (карта сайта): адрес ведёт на хаб города.
  redirects: { '/novosibirsk/kompanii/': '/novosibirsk/' },
});
