// Фильтры рейтинга: район и признаки. Скрывают строки таблицы и списка «Ещё в рейтинге», места не трогают.
document.querySelectorAll<HTMLElement>('[data-filter]').forEach((box) => {
  const list = document.getElementById(box.dataset.filter!);
  if (!list) return;
  const items = Array.from(list.querySelectorAll<HTMLElement>('[data-f]'));
  const sel = box.querySelector<HTMLSelectElement>('[data-rayon]')!;
  const checks = Array.from(box.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
  const count = box.querySelector<HTMLElement>('[data-count]')!;
  const empty = list.querySelector<HTMLElement>('[data-empty]')!;
  const initial = count.textContent;
  const apply = () => {
    const rayon = sel.value;
    const need = checks.filter((c) => c.checked).map((c) => c.value);
    let shown = 0;
    for (const el of items) {
      const f = (el.dataset.f || '').split(' ');
      const ok = (!rayon || (el.dataset.rayony || '').split('|').includes(rayon)) && need.every((k) => f.includes(k));
      el.hidden = !ok;
      if (ok) shown++;
    }
    const any = rayon || need.length;
    count.textContent = any ? `Показано ${shown} из ${items.length}. Места в рейтинге не меняются.` : initial;
    empty.hidden = shown > 0;
  };
  sel.addEventListener('change', apply);
  checks.forEach((c) => c.addEventListener('change', apply));
});
