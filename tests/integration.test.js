// Integration tests: Node.js built-in test runner; no extra test framework required.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const net = require("node:net");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-tests-"));
const dbPath = path.join(tempDir, "test.sqlite");
const logDir = path.join(tempDir, "logs");
const adminUser = "test-admin";
const adminPassword = "test-password-strong";
const sessionSecret = "test-session-secret-which-is-long-enough-123456";
let serverProcess;
let port;
let baseUrl;
let adminCookie;

async function getFreePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const selectedPort = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return selectedPort;
}

async function startServer() {
  port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      LOG_DIR: logDir,
      SESSION_SECRET: sessionSecret,
      ADMIN_USERNAME: adminUser,
      ADMIN_PASSWORD: adminPassword,
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  serverProcess.stdout.on("data", (chunk) => { output += chunk.toString(); });
  serverProcess.stderr.on("data", (chunk) => { output += chunk.toString(); });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Сервер завершився передчасно:\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status === 200) return;
    } catch (_) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  serverProcess.kill("SIGTERM");
  throw new Error(`Сервер не запустився за 10 секунд:\n${output}`);
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  const processToStop = serverProcess;
  processToStop.kill("SIGTERM");
  await Promise.race([
    once(processToStop, "exit"),
    new Promise((resolve) => setTimeout(resolve, 3000))
  ]);
  if (processToStop.exitCode === null) processToStop.kill("SIGKILL");
  serverProcess = null;
}

async function loginAsAdmin() {
  const response = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: adminUser, password: adminPassword })
  });
  assert.equal(response.status, 302, "адміністратор має успішно увійти");
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie, "сервер має встановити сесійну cookie");
  adminCookie = cookie.split(";")[0];
}

test.before(async () => {
  await startServer();
});

test.after(async () => {
  await stopServer();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("1. Головна сторінка та статичні ресурси доступні, службові файли приховані", async () => {
  const home = await fetch(baseUrl);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /Frontend Developer|oleksii/i);
  assert.match(html, /contactForm/);

  const css = await fetch(`${baseUrl}/styles.css`);
  assert.equal(css.status, 200);
  const image = await fetch(`${baseUrl}/images/project-dashboard.svg`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /image\/svg\+xml/);

  const privateSource = await fetch(`${baseUrl}/server.js`);
  assert.equal(privateSource.status, 404);
  const adminPage = await fetch(`${baseUrl}/admin/messages.html`);
  assert.equal(adminPage.status, 404);
  const testSource = await fetch(`${baseUrl}/tests/integration.test.js`);
  assert.equal(testSource.status, 404);
  const loginPage = await fetch(`${baseUrl}/admin/login`);
  assert.equal(loginPage.status, 200);
  const protectedPage = await fetch(`${baseUrl}/messages`, { redirect: "manual" });
  assert.equal(protectedPage.status, 302);
  const frontendScript = await fetch(`${baseUrl}/script.js`);
  assert.equal(frontendScript.status, 200);
  assert.match(await frontendScript.text(), /fetch\(contactForm.action/);

  const responsiveCss = await css.text();
  assert.match(responsiveCss, /max-width:\s*600px/);
  assert.match(responsiveCss, /max-width:\s*900px/);
  assert.match(responsiveCss, /min-width:\s*601px/);
});

test("2. Сервер відхиляє некоректні поля та email", async () => {
  const invalid = await fetch(`${baseUrl}/api/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "A", email: "not-an-email", message: "short" })
  });
  assert.equal(invalid.status, 400);
  const body = await invalid.json();
  assert.match(body.error, /Ім’я|email|Повідомлення/);
});

test("3. Неправильні облікові дані не надають доступ до панелі", async () => {
  const response = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: adminUser, password: "wrong-password" })
  });
  assert.equal(response.status, 401);
  assert.match(await response.text(), /Неправильний логін або пароль/);
});

test("4. Повідомлення зберігається, переживає перезапуск сервера і доступне адміністратору", async () => {
  const created = await fetch(`${baseUrl}/api/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Тестовий користувач",
      email: "test@example.com",
      message: "Тест з 'лапками'; DROP TABLE messages; -- перевірка prepared statements."
    })
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.ok(createdBody.id > 0);

  const unauthorized = await fetch(`${baseUrl}/api/messages`);
  assert.equal(unauthorized.status, 401);

  await stopServer();
  await startServer();

  await loginAsAdmin();
  const list = await fetch(`${baseUrl}/api/messages`, {
    headers: { cookie: adminCookie }
  });
  assert.equal(list.status, 200);
  const result = await list.json();
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].email, "test@example.com");
  assert.match(result.messages[0].message, /DROP TABLE messages/);
});

test("5. REST API видаляє повідомлення лише після авторизації", async () => {
  const list = await fetch(`${baseUrl}/api/messages`, { headers: { cookie: adminCookie } });
  const data = await list.json();
  assert.equal(data.messages.length, 1);
  const id = data.messages[0].id;

  const forbiddenDelete = await fetch(`${baseUrl}/api/messages/${id}`, { method: "DELETE" });
  assert.equal(forbiddenDelete.status, 401);

  const deleted = await fetch(`${baseUrl}/api/messages/${id}`, {
    method: "DELETE",
    headers: { cookie: adminCookie }
  });
  assert.equal(deleted.status, 200);

  const afterDelete = await fetch(`${baseUrl}/api/messages`, { headers: { cookie: adminCookie } });
  const afterData = await afterDelete.json();
  assert.equal(afterData.messages.length, 0);
});
