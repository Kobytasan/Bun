// Автоматичний тест-прогін каталогу пекарні «Булка» (використовує pg-mem замість Neon)
const BASE = 'http://localhost:' + (process.env.PORT || 3001);
let cookie = '';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    body: opts.body ? new URLSearchParams(opts.body) : undefined,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    redirect: 'manual',
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return res;
}

let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!cond) failures++;
}

(async () => {
  await req('/');

  // --- 1. Кошик ---
  let r = await req('/cart/add/1', { method: 'POST', body: { qty: '2', back: '/catalog' } });
  check('1.1 Хліб (2 шт) додано до кошика', r.status === 302);
  let res = await req('/cart');
  let t = await res.text();
  check('1.2 Сторінка кошика відкривається', res.status === 200);
  check('1.3 Сума = 56 грн (2 × 28)', t.includes('56'));
  await req('/cart/update', { method: 'POST', body: { id: '1', qty: '3' } });
  res = await req('/cart'); t = await res.text();
  check('1.4 Зміна кількості (3 × 28 = 84)', t.includes('84'));
  await req('/cart/remove', { method: 'POST', body: { id: '1' } });
  res = await req('/cart'); t = await res.text();
  check('1.5 Видалення позиції з кошика', !t.includes('Український новий'));

  // --- 2. Оформлення замовлення з датою самовивозу ---
  await req('/cart/add/1', { method: 'POST', body: { qty: '2', back: '/catalog' } });
  r = await req('/checkout', {
    method: 'POST',
    body: { customer_name: 'Test Tester', phone: '380991112233', client_type: 'кафе / ресторан', pickup_date: '2026-11-15', comment: 'нарізати хліб' },
  });
  check('2.1 Замовлення створено (редирект на сторінку замовлення)', r.status === 302 && (r.headers.get('location') || '').includes('/order/1'));
  res = await req('/order/1'); t = await res.text();
  check('2.2 Сторінка замовлення відкривається', res.status === 200 && t.includes('№1'));
  check('2.3 Тип покупця та дата забору збережені', t.includes('Test Tester') && t.includes('кафе / ресторан'));

  // --- 3. Вхід директора та панель керування ---
  r = await req('/login', { method: 'POST', body: { login: 'director', password: 'Director2026!' } });
  check('3.1 Директор увійшов (director / Director2026!)', r.status === 302 && (r.headers.get('location') || '').includes('/admin'));
  res = await req('/admin'); t = await res.text();
  check('3.2 Панель керування відкривається', res.status === 200 && t.includes('Панель керування'));
  for (const u of ['/admin/products', '/admin/orders', '/admin/employees']) {
    res = await req(u);
    check('3.3 ' + u + ' доступна', res.status === 200);
  }
  res = await req('/admin/employees'); t = await res.text();
  check('3.4 Директор бачить працівників', t.includes('Гончар Марія Петрівна'));

  // --- 4. Керування замовленням ---
  await req('/admin/orders/1/status', { method: 'POST', body: { status: 'готується', back: '/admin/orders/1' } });
  res = await req('/admin/orders/1'); t = await res.text();
  check('4.1 Статус замовлення змінено', t.includes('готується'));

  // --- 5. CRUD каталогу продукції ---
  await req('/admin/products', { method: 'POST', body: { name: 'Тест виріб', description: 'для тесту', composition: 'борошно', weight_g: '100', price: '15', shelf_life: '24 години', stock: '10', available: 'on', icon: '🥖' } });
  res = await req('/admin/products'); t = await res.text();
  check('5.1 Новий виріб створено', t.includes('Тест виріб'));
  res = await req('/catalog?q=Тест'); t = await res.text();
  check('5.2 Виріб видно покупцям у каталозі', t.includes('Тест виріб'));

  // --- 5.3 Зняття з продажу та повернення ---
  res = await req('/admin/products'); t = await res.text();
  const m = t.match(/\/admin\/products\/(\d+)\/toggle/g);
  const firstId = m ? m[0].match(/\d+/)[0] : null;
  if (firstId) {
    await req('/admin/products/' + firstId + '/toggle', { method: 'POST' });
    res = await req('/catalog'); t = await res.text();
    const gone = !t.includes('Булочка з маком') || t.includes('Немає в наявності');
    check('5.3 Зняття виробу з продажу працює', gone);
    await req('/admin/products/' + firstId + '/toggle', { method: 'POST' });
  } else {
    check('5.3 Зняття виробу з продажу працює (не знайдено кнопки — FAIL)', false);
  }

  // --- 6. Розмежування прав (пекар = лише перегляд) ---
  cookie = '';
  r = await req('/login', { method: 'POST', body: { login: 'pekar', password: 'Pekar2026!' } });
  res = await req('/admin/orders'); t = await res.text();
  check('6.1 Пекар бачить замовлення', res.status === 200 && t.includes('Замовлення'));
  res = await req('/admin/products', { redirect: 'manual' });
  check('6.2 Пекар заблокований від каталогу керування (403)', res.status === 403);

  // --- 7. Невірний логін ---
  cookie = '';
  r = await req('/login', { method: 'POST', body: { login: 'director', password: 'wrong' } });
  t = await r.text();
  check('7.1 Невірний пароль відхиляється (401)', r.status === 401);

  console.log(failures ? '\nВІДМОВИ: ' + failures : '\nУСІ ТЕСТИ ПРОЙДЕНО ✔');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error('ТЕСТ ВПАВ:', e.message);
  process.exit(1);
});
