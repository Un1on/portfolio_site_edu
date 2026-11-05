// Node.js + Express + SQLite backend with basic error logging.
"use strict";

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "server.log");
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, "portfolio.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

// Server error logging
function logServerError(message, error) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: "error",
    message,
    error: error ? String(error.message || error) : undefined
  };

  const line = JSON.stringify(entry) + "\n";

  fs.appendFile(LOG_FILE, line, (writeError) => {
    if (writeError) {
      console.error("Не вдалося записати журнал:", writeError.message);
    }
  });

  console.error(line.trim());
}

// Environment validation
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("Помилка: задайте SESSION_SECRET довжиною щонайменше 32 символи у файлі .env");
  process.exit(1);
}

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  console.error("Помилка: задайте ADMIN_USERNAME та ADMIN_PASSWORD у файлі .env");
  process.exit(1);
}

// SQLite database
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schema = fs.readFileSync(
  path.join(ROOT, "server", "schema.sql"),
  "utf8"
);

db.exec(schema);

app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      imgSrc: ["'self'", "data:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));

// Request monitoring
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;

    if (res.statusCode >= 500) {
      logServerError(
        `${req.method} ${req.originalUrl} returned ${res.statusCode} (${durationMs} ms)`
      );
    }
  });

  next();
});

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// Session configuration
app.use(session({
  name: "portfolio.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 60 * 1000
  }
}));

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Забагато спроб входу. Спробуйте через 15 хвилин."
  }
});

// Email validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Timing-safe comparison
function safeEqual(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));

  return first.length === second.length &&
    crypto.timingSafeEqual(first, second);
}

// Admin authorization
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({
      error: "Потрібна авторизація адміністратора."
    });
  }

  return res.redirect("/admin/login");
}

// Block access to private project files
app.use((req, res, next) => {
  const blockedExact = new Set([
    "/server.js",
    "/package.json",
    "/package-lock.json",
    "/README.txt",
    "/README.md",
    "/.env",
    "/.env.example",
    "/.gitignore",
    "/render.yaml",
    "/admin/login.html",
    "/admin/messages.html"
  ]);

  const blockedDirectories = [
    "/server/",
    "/data/",
    "/logs/",
    "/tests/",
    "/.github/",
    "/.git/"
  ];

  if (
    blockedExact.has(req.path) ||
    blockedDirectories.some(directory =>
      req.path.startsWith(directory)
    )
  ) {
    return res.sendStatus(404);
  }

  next();
});

// Static frontend files
app.use(express.static(ROOT, {
  index: "index.html",
  dotfiles: "ignore",
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  etag: true
}));

// Create a new message
app.post("/api/messages", (req, res) => {
  const name = typeof req.body.name === "string"
    ? req.body.name.trim()
    : "";

  const email = typeof req.body.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";

  const message = typeof req.body.message === "string"
    ? req.body.message.trim()
    : "";

  const errors = [];

  if (name.length < 2 || name.length > 80) {
    errors.push("Ім’я має містити від 2 до 80 символів.");
  }

  if (email.length > 254 || !isValidEmail(email)) {
    errors.push("Вкажіть коректну email-адресу.");
  }

  if (message.length < 10 || message.length > 5000) {
    errors.push("Повідомлення має містити від 10 до 5000 символів.");
  }

  if (errors.length) {
    return res.status(400).json({
      error: errors.join(" ")
    });
  }

  try {
    const insert = db.prepare(
      "INSERT INTO messages (name, email, message) VALUES (@name, @email, @message)"
    );

    const result = insert.run({
      name,
      email,
      message
    });

    return res.status(201).json({
      ok: true,
      id: Number(result.lastInsertRowid),
      message: "Дякуємо! Повідомлення успішно збережено."
    });

  } catch (error) {
    logServerError("Не вдалося зберегти повідомлення", error);

    return res.status(500).json({
      error: "Внутрішня помилка сервера. Спробуйте пізніше."
    });
  }
});

// Admin login page
app.get("/admin/login", (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect("/messages");
  }

  res.sendFile(path.join(ROOT, "admin", "login.html"));
});

// Admin authentication
app.post("/admin/login", loginLimiter, (req, res) => {
  const username = typeof req.body.username === "string"
    ? req.body.username
    : "";

  const password = typeof req.body.password === "string"
    ? req.body.password
    : "";

  if (
    !safeEqual(username, process.env.ADMIN_USERNAME) ||
    !safeEqual(password, process.env.ADMIN_PASSWORD)
  ) {
    return res.status(401).send(
      loginPageError("Неправильний логін або пароль.")
    );
  }

  req.session.regenerate((error) => {
    if (error) {
      logServerError("Не вдалося створити сесію адміністратора", error);
      return res.status(500).send("Не вдалося створити сесію.");
    }

    req.session.isAdmin = true;

    req.session.save((saveError) => {
      if (saveError) {
        logServerError("Не вдалося зберегти сесію адміністратора", saveError);
        return res.status(500).send("Не вдалося зберегти сесію.");
      }

      res.redirect("/messages");
    });
  });
});

// Login error page
function loginPageError(errorMessage) {
  const safeMessage = String(errorMessage).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Вхід адміністратора</title>
<link rel="stylesheet" href="/admin/admin.css">
</head>
<body>
<main class="login-card">
<p class="eyebrow">ADMIN ACCESS</p>
<h1>Вхід до панелі</h1>
<p class="error">${safeMessage}</p>
<form method="post" action="/admin/login">
<label for="username">Логін</label>
<input id="username" name="username" required autocomplete="username">
<label for="password">Пароль</label>
<input id="password" name="password" type="password" required autocomplete="current-password">
<button type="submit">Увійти</button>
</form>
<a href="/">← На головну</a>
</main>
</body>
</html>`;
}

// Admin logout
app.post("/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      logServerError("Не вдалося завершити сесію", error);
    }

    res.redirect("/admin/login");
  });
});

// Protected messages page
app.get("/messages", requireAdmin, (req, res) => {
  res.sendFile(path.join(ROOT, "admin", "messages.html"));
});

// Get messages
app.get("/api/messages", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT id, name, email, message, created_at FROM messages ORDER BY created_at DESC, id DESC"
  ).all();

  res.json({
    messages: rows
  });
});

// Delete message
app.delete("/api/messages/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Некоректний ID повідомлення."
    });
  }

  const result = db.prepare(
    "DELETE FROM messages WHERE id = ?"
  ).run(id);

  if (result.changes === 0) {
    return res.status(404).json({
      error: "Повідомлення не знайдено."
    });
  }

  res.json({
    ok: true,
    message: "Повідомлення видалено."
  });
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "Маршрут не знайдено."
    });
  }

  res.status(404).send("Сторінку не знайдено.");
});

// Global error handler
app.use((error, req, res, next) => {
  logServerError("Необроблена помилка Express", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Внутрішня помилка сервера."
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Portfolio server запущено: http://localhost:${PORT}`);
  console.log(`Сторінка повідомлень (потрібен вхід): http://localhost:${PORT}/messages`);
});

// Graceful shutdown
function shutdown() {
  try {
    db.close();
  } catch (_) {}

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);