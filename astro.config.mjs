import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import { READY_SLUGS } from './src/lib/gorod-dannye.mjs';

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
  // острова Preact – только в кабинете /admin/ (перенос кабинета gaz-mag), на публичных страницах их нет
  integrations: [preact()],
  // Списка районов нет: /novosibirsk/districts/ ведёт на рейтинги города (районы – там).
  // Каталог компаний с 01.11.2026 – сама страница города: /<город>/companies/ → /<город>/.
  // цель с учётом base: Astro сам подпапку к цели редиректа не добавляет
  redirects: {
    '/novosibirsk/districts/': BASE.replace(/\/$/, '') + '/novosibirsk/ratings/',
    ...Object.fromEntries(READY_SLUGS.map((g) => [`/${g}/companies/`, `${BASE.replace(/\/$/, '')}/${g}/`])),
  },
});
