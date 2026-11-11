require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

let initPromise = null;

function init() {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Змінна середовища DATABASE_URL не задана. Вставте рядок підключення з Neon (Project → Connection Details → Connection string).'
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '🥖'
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      category_id INT REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      composition TEXT DEFAULT '',
      weight_g INT DEFAULT 0,
      price NUMERIC(10,2) NOT NULL,
      shelf_life TEXT DEFAULT '24 години',
      stock INT DEFAULT 0,
      available BOOLEAN DEFAULT TRUE,
      featured BOOLEAN DEFAULT FALSE,
      icon TEXT DEFAULT '🥖'
    );
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'worker'
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      client_type TEXT,
      pickup_date TEXT,
      comment TEXT,
      total NUMERIC(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'нове',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES orders(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      qty INT NOT NULL,
      price NUMERIC(10,2) NOT NULL
    );
  `);

  await seedEmployees();
  await seedProducts();
}

async function seedEmployees() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM employees');
  if (rows[0].n > 0) return;

  const users = [
    ['Гончар Марія Петрівна', 'Директор пекарні', 'director', 'Director2026!', 'director'],
    ['Дячук Оксана Іванівна', 'Менеджер замовлень', 'manager', 'Manager2026!', 'manager'],
    ['Литвин Соломія Андріївна', 'Технолог', 'tehnolog', 'Tehnolog2026!', 'manager'],
    ['Савчук Петро Миколайович', 'Пекар', 'pekar', 'Pekar2026!', 'worker'],
  ];
  for (const [name, position, login, pass, role] of users) {
    await pool.query(
      'INSERT INTO employees (name, position, login, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
      [name, position, login, bcrypt.hashSync(pass, 10), role]
    );
  }
  console.log('✔ Створено облікові записи працівників (директор: director / Director2026!)');
}

async function seedProducts() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products');
  if (rows[0].n > 0) return;

  const catalog = [
    {
      name: 'Хліб та багети',
      icon: '🍞',
      items: [
        ['Хліб «Український новий», 700 г', 'Класичний пшенично-житній хліб на натуральній заквасці. Випікаємо щодня о 6:00.', 'Пшеничне борошно в/г, житнє борошно, закваска, сіль, вода, дріжджі', 700, 28, '48 годин', 120, true, '🍞'],
        ['Хліб «Бородинський», 500 г', 'Ароматний житній хліб з коріандром та солодом.', 'Житнє борошно, пшеничне борошно, солод, коріандр, сіль, вода', 500, 32, '72 години', 80, false, '🍞'],
        ['Багет «Класичний», 250 г', 'Хрустка скоринка й м\'який м\'якуш — ідеальний до сніданку.', 'Пшеничне борошно в/г, сіль, вода, дріжджі', 250, 25, '24 години', 150, true, '🥖'],
        ['Хала з кунжутом, 400 г', 'Плетена здобна хала, змащена яйцем та посипана кунжутом.', 'Борошно в/г, яйця, цукор, масло вершкове, кунжут, сіль', 400, 45, '36 годин', 60, false, '🥖'],
      ],
    },
    {
      name: 'Булочки та круасани',
      icon: '🥐',
      items: [
        ['Булочка з маком, 100 г', 'Здобна булочка з начинкою з маку та цукровою глазур\'ю.', 'Борошно в/г, мак, цукор, молоко, яйця, дріжджі', 100, 15, '24 години', 200, true, '🥯'],
        ['Круасан з шоколадом, 90 г', 'Хрусткі шари тіста і начинка з темного шоколаду.', 'Борошно в/г, масло вершкове, шоколад, молоко, дріжджі', 90, 32, '18 годин', 140, true, '🥐'],
        ['Плюшка «Московська», 100 г', 'Класична здобна плюшка-серце з цукровою посипкою.', 'Борошно в/г, цукор, масло вершкове, яйця, ванілін', 100, 14, '24 години', 180, false, '🥯'],
        ['Синнабон з корицею, 120 г', 'Рол з корицею з кремом на вершковому сирі.', 'Борошно, кориця, масло, вершковий сир, цукрова пудра', 120, 42, '18 годин', 90, false, '🌀'],
      ],
    },
    {
      name: 'Кондитерські вироби',
      icon: '🧁',
      items: [
        ['Тістечко «Київське», 120 г', 'Легендарне тістечко з білково-горіхових коржів та шарлотного крему.', 'Білки, горіхи кеш\'ю, цукор, масло вершкове, згущене молоко', 120, 45, '24 години', 70, true, '🧁'],
        ['Тістечко «Наполеон», 120 г', 'Тісто листкове з кремом патісьєр на ванільному стручку.', 'Листкове тісто, молоко, яйця, цукор, масло вершкове, ваніль', 120, 42, '24 години', 85, false, '🍰'],
        ['Рулет маковий, 400 г', 'Здобний рулет з рясною маковою начинкою.', 'Борошно в/г, мак, цукор, яйця, масло вершкове', 400, 68, '36 годин', 45, false, '🥧'],
        ['Кекс з родзинками, 350 г', 'Ніжний кекс з ізюмом, посипаний цукровою пудрою.', 'Борошно, родзинки, масло, яйця, цукор, ванілін', 350, 52, '48 годин', 40, false, '🧁'],
        ['Пиріг з вишнею, 600 г', 'Домашній пиріг з вишневою начинкою та крихтеним штрейзелем.', 'Борошно, вишня, цукор, крохмаль, масло вершкове', 600, 95, '24 години', 30, true, '🥧'],
      ],
    },
  ];

  for (const cat of catalog) {
    const { rows } = await pool.query(
      'INSERT INTO categories (name, icon) VALUES ($1,$2) RETURNING id',
      [cat.name, cat.icon]
    );
    const catId = rows[0].id;
    for (const [name, description, composition, weight_g, price, shelf_life, stock, featured, icon] of cat.items) {
      await pool.query(
        `INSERT INTO products
         (category_id, name, description, composition, weight_g, price, shelf_life, stock, available, featured, icon)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [catId, name, description, composition, weight_g, price, shelf_life, stock, stock > 0, featured, icon]
      );
    }
  }
  console.log('✔ Наповнено каталог тестовою продукцією пекарні');
}

module.exports = { pool, init, query: (t, p) => pool.query(t, p) };
