# Автобалл (сайт 1, авто-рейтинг)

- Astro, статический; Pages с base `/reyting-avto`, тест закрыт noindex. Node: `export PATH=~/.local/node/bin:$PATH`.
- Карта сайта и тексты – `~/Sites/reytingi/docs` (не править тот репо). Страницы и адреса строго по karta-avto.md.
- Баллы считаются при сборке формулой `src/lib/formula.mjs` из сырых полей; `npm run build` падает, если балл разошёлся с текстами без записи в `~/Sites/reytingi/docs/sayty/resheniya-avto.md (закрытый репо)`.
- Тексты дословно; чего нет – `{?что подтвердить?}`, не выдумывать отзывы, цифры, юр. лицо.
- Нет `AggregateRating`/`Review`. Ссылки на компании – `rel="nofollow noopener"`. На сайты партнёров – скрытая UTM при клике (`src/components/Utm.astro`, владелец 30.10.2026), в href метки нет. Ссылок на сайт 2 (reyting-nsk) нет.
- Только короткое тире «–». Файлы кода ≤800 строк. Коммиты на русском.
- Решения и открытые вопросы – `~/Sites/reytingi/docs/sayty/resheniya-avto.md (закрытый репо)`.
