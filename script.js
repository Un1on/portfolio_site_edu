// Інтерактивність портфоліо Frontend Developer
document.addEventListener("DOMContentLoaded", () => {
  // 1. Мобільне меню: відкриття, закриття та закриття після переходу.
  const menuToggle = document.querySelector("#menuToggle");
  const mainNav = document.querySelector("#mainNav");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Закрити меню" : "Відкрити меню");
    });

    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Відкрити меню");
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        mainNav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // 2. Перемикання теми зі збереженням вибору у localStorage.
  const themeToggle = document.querySelector("#themeToggle");
  const themeIcon = themeToggle?.querySelector(".theme-icon");
  const savedTheme = localStorage.getItem("portfolio-theme");

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === "dark";
    if (themeIcon) themeIcon.textContent = dark ? "☀" : "☾";
    if (themeToggle) {
      themeToggle.setAttribute("aria-label", dark ? "Увімкнути світлу тему" : "Увімкнути темну тему");
      themeToggle.setAttribute("aria-pressed", String(dark));
    }
  }

  applyTheme(savedTheme === "dark" ? "dark" : "light");

  themeToggle?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("portfolio-theme", nextTheme);
  });

  // 3. Динамічний текст: показати або приховати додаткову інформацію.
  const detailsToggle = document.querySelector("#detailsToggle");
  const extraDetails = document.querySelector("#extraDetails");

  detailsToggle?.addEventListener("click", () => {
    const expanded = detailsToggle.getAttribute("aria-expanded") === "true";
    detailsToggle.setAttribute("aria-expanded", String(!expanded));
    extraDetails.hidden = expanded;
    detailsToggle.innerHTML = expanded
      ? 'Більше про мій підхід <span aria-hidden="true">＋</span>'
      : 'Приховати інформацію <span aria-hidden="true">−</span>';
  });

  // 4. Динамічне створення елементів із масиву JavaScript-об'єктів.
  const initialTools = [
    { id: 1, name: "HTML5", category: "Розмітка" },
    { id: 2, name: "CSS3", category: "Стилізація" },
    { id: 3, name: "JavaScript", category: "Логіка" },
    { id: 4, name: "Git & GitHub", category: "Інструменти" }
  ];
  let tools = [...initialTools];
  let nextId = 5;

  const toolsContainer = document.querySelector("#dynamicTools");
  const addToolForm = document.querySelector("#addToolForm");
  const toolInput = document.querySelector("#toolInput");
  const listFeedback = document.querySelector("#listFeedback");

  function renderTools() {
    if (!toolsContainer) return;
    toolsContainer.replaceChildren();

    if (tools.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "empty-tools";
      emptyMessage.textContent = "Список порожній. Додайте першу технологію.";
      toolsContainer.append(emptyMessage);
      return;
    }

    tools.forEach((tool, index) => {
      const item = document.createElement("article");
      item.className = "dynamic-tool";
      item.dataset.id = String(tool.id);

      const number = document.createElement("span");
      number.className = "dynamic-tool-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const content = document.createElement("div");
      content.className = "dynamic-tool-content";

      const title = document.createElement("h3");
      title.textContent = tool.name;

      const category = document.createElement("p");
      category.textContent = tool.category;

      const removeButton = document.createElement("button");
      removeButton.className = "remove-tool";
      removeButton.type = "button";
      removeButton.textContent = "Видалити";
      removeButton.setAttribute("aria-label", `Видалити ${tool.name}`);
      removeButton.addEventListener("click", () => {
        tools = tools.filter((currentTool) => currentTool.id !== tool.id);
        renderTools();
        if (listFeedback) listFeedback.textContent = `Елемент «${tool.name}» видалено.`;
      });

      content.append(title, category);
      item.append(number, content, removeButton);
      toolsContainer.append(item);
    });
  }

  addToolForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = toolInput.value.trim();

    if (name.length < 2) {
      listFeedback.textContent = "Введіть назву щонайменше з двох символів.";
      toolInput.focus();
      return;
    }

    const alreadyExists = tools.some((tool) => tool.name.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      listFeedback.textContent = "Така технологія вже є у списку.";
      toolInput.focus();
      return;
    }

    tools.push({ id: nextId++, name, category: "Додано користувачем" });
    renderTools();
    addToolForm.reset();
    listFeedback.textContent = `«${name}» успішно додано до списку.`;
    toolInput.focus();
  });

  renderTools();

  // 5. Клієнтська перевірка та асинхронне надсилання на Node.js API.
  const contactForm = document.querySelector("#contactForm");
  const formFeedback = document.querySelector("#formFeedback");

  contactForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nameField = contactForm.querySelector("#name");
    const emailField = contactForm.querySelector("#email");
    const messageField = contactForm.querySelector("#message");

    [nameField, emailField, messageField].forEach((field) => {
      field.setAttribute("aria-invalid", "false");
    });

    const errors = [];
    if (!nameField.value.trim() || nameField.value.trim().length < 2) {
      errors.push("Ім’я має містити щонайменше 2 символи.");
      nameField.setAttribute("aria-invalid", "true");
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailPattern.test(emailField.value.trim())) {
      errors.push("Введіть коректну адресу електронної пошти.");
      emailField.setAttribute("aria-invalid", "true");
    }

    if (!messageField.value.trim() || messageField.value.trim().length < 10) {
      errors.push("Повідомлення має містити щонайменше 10 символів.");
      messageField.setAttribute("aria-invalid", "true");
    }

    if (errors.length > 0) {
      formFeedback.className = "form-feedback is-error";
      formFeedback.textContent = errors.join(" ");
      contactForm.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = "Надсилання…";
    formFeedback.className = "form-feedback";
    formFeedback.textContent = "";

    try {
      const response = await fetch(contactForm.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameField.value.trim(),
          email: emailField.value.trim(),
          message: messageField.value.trim()
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Не вдалося зберегти повідомлення.");
      }

      formFeedback.className = "form-feedback is-success";
      formFeedback.textContent = result.message || "Повідомлення успішно збережено.";
      contactForm.reset();
    } catch (error) {
      formFeedback.className = "form-feedback is-error";
      formFeedback.textContent = error.message || "Помилка з’єднання із сервером. Перевірте, чи запущений Node.js.";
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
    }
  });

  // При редагуванні поля прибираємо попередню позначку помилки.
  contactForm?.querySelectorAll("input, textarea").forEach((field) => {
    field.addEventListener("input", () => {
      field.setAttribute("aria-invalid", "false");
      if (formFeedback) {
        formFeedback.textContent = "";
        formFeedback.className = "form-feedback";
      }
    });
  });
});
