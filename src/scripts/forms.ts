// Формы «Помочь выбрать» и «Добавить компанию»: маска +7, проверка полей, пустая галочка согласия
// держит кнопку неактивной. Отправка – на PUBLIC_FORM_ENDPOINT (data-endpoint). Адреса нет – честное
// сообщение тестовой версии, без «Спасибо» (куда идут заявки, владелец не решил: ~/Sites/reytingi/docs/sayty/resheniya-avto.md (закрытый репо)).

function digits(v: string): string {
  // «+7 (» маски – не часть номера; 8 или 7 первым символом или 11 цифр – код страны
  let d = v.replace(/^\s*\+7/, '').replace(/\D/g, '');
  if (d.length === 11 || (d.length === 1 && /[78]/.test(d))) d = d.slice(1);
  return d.slice(0, 10);
}

function maskPhone(d: string): string {
  if (!d) return '+7 (';
  let s = '+7 (' + d.slice(0, 3);
  if (d.length >= 3) s += ') ' + d.slice(3, 6);
  if (d.length >= 6) s += '-' + d.slice(6, 8);
  if (d.length >= 8) s += '-' + d.slice(8, 10);
  return s;
}

function bindPhone(input: HTMLInputElement) {
  input.addEventListener('focus', () => {
    if (!input.value) input.value = '+7 (';
  });
  input.addEventListener('blur', () => {
    if (digits(input.value).length === 0) input.value = '';
  });
  input.addEventListener('input', () => {
    input.value = maskPhone(digits(input.value));
  });
}

function setError(field: HTMLElement, msg: string) {
  const box = field.closest('.f');
  const err = box?.querySelector<HTMLElement>('.err');
  if (err) err.textContent = msg;
  field.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function validate(form: HTMLFormElement): boolean {
  let ok = true;
  let first: HTMLElement | null = null;
  const fail = (el: HTMLElement, msg: string) => {
    setError(el, msg);
    ok = false;
    first ??= el;
  };
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((el) => {
    if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden' || el.name === 'website') return;
    setError(el, '');
    const v = el.value.trim();
    if (el.required && !v) return fail(el, 'Заполните поле');
    if (el.type === 'tel' && v && digits(v).length !== 10) return fail(el, 'Номер из 10 цифр после +7');
    if (el.type === 'url' && v && !/^https?:\/\/\S+\.\S+/.test(v)) return fail(el, 'Ссылка начинается с https://');
    if (el.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) return fail(el, 'Проверьте адрес почты');
  });
  // «телефон или Telegram / почта» – хотя бы одно
  const group = form.querySelectorAll<HTMLInputElement>('[data-one-of]');
  if (group.length && !Array.from(group).some((el) => el.value.trim() && (el.type !== 'tel' || digits(el.value).length === 10))) {
    if (!Array.from(group).some((el) => el.getAttribute('aria-invalid') === 'true')) fail(group[0], 'Оставьте телефон или другой способ связи');
  }
  form.querySelectorAll<HTMLFieldSetElement>('fieldset[data-required]').forEach((fs) => {
    const err = fs.querySelector<HTMLElement>('.err');
    const picked = fs.querySelector('input:checked');
    if (err) err.textContent = picked ? '' : 'Выберите вариант';
    if (!picked) {
      ok = false;
      first ??= fs.querySelector('input');
    }
  });
  (first as HTMLElement | null)?.focus();
  return ok;
}

document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((form) => {
  const consent = form.querySelector<HTMLInputElement>('input[name="consent"]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const msg = form.querySelector<HTMLElement>('.form__msg');
  const sync = () => {
    if (submit) submit.disabled = !consent?.checked;
  };
  consent?.addEventListener('change', sync);
  sync();
  form.querySelectorAll<HTMLInputElement>('input[type="tel"]').forEach(bindPhone);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!consent?.checked || !validate(form)) return;
    if ((form.elements.namedItem('website') as HTMLInputElement | null)?.value) return; // ловушка для ботов
    const endpoint = form.dataset.endpoint || '';
    if (!msg) return;
    msg.hidden = false;
    if (!endpoint) {
      msg.className = 'form__msg form__msg--test';
      msg.textContent = form.dataset.testMsg || 'Тестовая версия: заявки пока не принимаются.';
      msg.focus();
      return;
    }
    const data: Record<string, string> = { form: form.dataset.form || '', page: location.pathname };
    new FormData(form).forEach((v, k) => {
      if (k !== 'website') data[k] = data[k] ? data[k] + ', ' + String(v) : String(v);
    });
    if (submit) submit.disabled = true;
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(String(res.status));
      location.href = form.dataset.thanks || '/';
    } catch {
      msg.className = 'form__msg form__msg--err';
      msg.textContent = 'Заявка не отправилась. Попробуйте ещё раз через минуту.';
      msg.focus();
      sync();
    }
  });
});
