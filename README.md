# Автобалл – авто-рейтинг (сайт 1)

Рейтинги авто-ниш по городам по открытой формуле из данных Яндекс Карт, 2ГИС и сайтов компаний.
Старт – Новосибирск: установка магнитол (12 центров), сервис китайских автомобилей (10 компаний), 22 карточки компаний.
Название «Автобалл» рабочее.

- Тест: https://tema-mail.github.io/reyting-avto/ (весь сайт noindex)
- Исходники текстов, карты и данных: `~/Sites/reytingi/docs` (karta-avto.md, teksty-avto.md, dannye/)
- Решения и открытые вопросы: `docs/resheniya.md`

## Где что
- `src/data/source/*.json` – съём 25.10.2026 (копия itog.json), `src/lib/formula.mjs` – формула v2, `src/lib/reyting.ts` – модель.
- `src/data/teksty-*.ts`, `src/data/kartochki.ts` – тексты дословно; `{?…?}` выводится пометкой «подтвердить».
- `src/pages/` – страницы по карте сайта, `scripts/` – сверка баллов с текстами и проверка ссылок.

## Сборка
```
export PATH=~/.local/node/bin:$PATH
npm ci
npm run build      # сверка баллов → astro build → проверка ссылок, якорей и длинного тире
```
Переменные: `PUBLIC_BASE` (/reyting-avto на Pages), `PUBLIC_SITE_URL`, `PUBLIC_NOINDEX=1` (тест), `PUBLIC_FORM_ENDPOINT` (куда POST JSON заявок; пусто – тестовое сообщение).
Выкладка – `.github/workflows/pages.yml` при пуше в main.
