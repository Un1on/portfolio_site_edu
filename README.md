ПРАКТИЧНА РОБОТА №4
Портфоліо Frontend Developer — Node.js + Express + SQLite
==========================================================

1. ЩО ВИКОРИСТАНО
-----------------
- Node.js (версія 20 або новіша)
- Express — HTTP-сервер та REST API
- SQLite — локальна файлова база даних (better-sqlite3)
- express-session — сесійна автентифікація адміністратора
- Helmet — базові HTTP security headers
- express-rate-limit — обмеження частоти спроб входу
- Fetch API — асинхронне надсилання форми без перезавантаження

2. ВСТАНОВЛЕННЯ
---------------
Переконайтеся, що встановлено Node.js 20+ та npm.
Відкрийте термінал у папці проєкту та виконайте:

    npm install

Скопіюйте .env.example у файл .env.
У Windows PowerShell:

    Copy-Item .env.example .env

У macOS / Linux:

    cp .env.example .env


Секрети не додавайте до ZIP та не публікуйте.

3. ЗАПУСК
---------
У корені проєкту виконайте:

    npm start

Відкрийте сайт:
    http://localhost:3000

Форма контактів надсилає POST-запит на /api/messages.
Після успішної серверної перевірки повідомлення записується у SQLite.

4. ПАНЕЛЬ АДМІНІСТРАТОРА
-----------------------
Сторінка входу:
    http://localhost:3000/admin/login

Сторінка збережених повідомлень:
    http://localhost:3000/messages


5. REST API
-----------
POST   /api/messages       Публічне створення повідомлення.
GET    /api/messages       Список повідомлень (потрібен admin login).
DELETE /api/messages/:id   Видалення повідомлення (потрібен admin login).

Для POST передається JSON:
{
  "name": "Ім'я",
  "email": "name@example.com",
  "message": "Текст повідомлення не коротший за 10 символів"
}

6. БАЗА ДАНИХ
-------------
Схема описана у server/schema.sql.
Під час першого запуску сервер автоматично створює папку data та файл:
    data/portfolio.sqlite

Таблиця messages:
- id — INTEGER PRIMARY KEY AUTOINCREMENT
- name — ім'я (2–80 символів)
- email — електронна адреса
- message — повідомлення (10–5000 символів)
- created_at — дата та час створення


7. БЕЗПЕКА
----------
- Сервер повторно перевіряє обов'язкові поля та формат email.
- SQL-запити з даними користувача використовують параметризовані prepared statements.
- Перегляд і видалення повідомлень доступні лише після входу адміністратора.
- Секрети зберігаються у .env, який виключено через .gitignore.
- Cookie сесії має HttpOnly та SameSite=Strict.
- Спроби входу обмежені rate limiter.
- Вміст повідомлень у панелі створюється через textContent, а не вставляється як HTML.


8. СТРУКТУРА ПРОЄКТУ
--------------------
index.html, styles.css, script.js — frontend попередніх практичних робіт.
server.js — Node.js сервер та API.
server/schema.sql — структура SQLite.
admin/ — сторінка входу, сторінка повідомлень та клієнтський код панелі.
images/ — локальні SVG-зображення.
.env.example — приклад конфігурації без секретів.
data/ — створюється автоматично, містить локальну базу даних.
