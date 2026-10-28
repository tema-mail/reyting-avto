# Автобалл – авто-рейтинг (сайт 1)

Рейтинги авто-ниш по городам по открытой формуле из данных Яндекс Карт, 2ГИС и сайтов компаний.
Новосибирск: 24 рейтинга в 5 группах. 22 ниши – по данным Яндекс Карт (съём 28.10.2026, формула владельца), установка магнитол и сервис китайских автомобилей – Яндекс Карты, 2ГИС и сайты (25.10.2026, формула v2). Карточки компаний топ-10 каждой ниши.
Название «Автобалл» рабочее.

- Тест: https://tema-mail.github.io/reyting-avto/ (весь сайт noindex)
- Исходники текстов, карты и данных: `~/Sites/reytingi/docs` (karta-avto.md, teksty-avto.md, dannye/)
- Решения и открытые вопросы: `docs/resheniya.md`

## Где что
- `src/data/source/*.json` – съём 25.10.2026 (копия itog.json), `src/lib/formula.mjs` – формула v2, `src/lib/reyting.ts` – модель двух старых ниш.
- `src/data/source/avto/<ключ>.json` – съём Яндекс Карт 28.10.2026; `src/lib/otbor.mjs` – группы и правила отбора, `src/lib/formula-ya.mjs` – формула, `src/lib/ya.ts` – модель ниш и карточек, `src/lib/katalog.ts` – все рейтинги одним списком (меню, главная, хаб, sitemap).
- `src/data/nishi/<ключ>.ts` – тексты ниш; `src/data/rayony.json` – границы районов из OpenStreetMap.
- `src/data/teksty-*.ts`, `src/data/kartochki.ts` – тексты дословно; `{?…?}` выводится пометкой «подтвердить».
- `src/pages/` – страницы по карте сайта, `scripts/` – сверка баллов (v2 с текстами, ниши Яндекса – независимым пересчётом) и проверка ссылок.

## Сборка
```
export PATH=~/.local/node/bin:$PATH
npm ci
npm run build      # сверка баллов v2 → проверка ниш Яндекса → astro build → проверка ссылок, якорей и длинного тире
```
Переменные: `PUBLIC_BASE` (/reyting-avto на Pages), `PUBLIC_SITE_URL`, `PUBLIC_NOINDEX=1` (тест), `PUBLIC_FORM_ENDPOINT` (куда POST JSON заявок; пусто – тестовое сообщение).
Выкладка – `.github/workflows/pages.yml` при пуше в main.
