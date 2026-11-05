"use strict";

const list = document.querySelector("#messageList");
const statusText = document.querySelector("#status");

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("uk-UA");
}

function createMessageCard(message) {
  const article = document.createElement("article");
  article.className = "message-card";

  const top = document.createElement("div");
  top.className = "message-top";

  const heading = document.createElement("h2");
  heading.textContent = message.name;

  const date = document.createElement("time");
  date.dateTime = message.created_at;
  date.textContent = formatDate(message.created_at);

  const email = document.createElement("a");
  email.href = `mailto:${message.email}`;
  email.textContent = message.email;

  const body = document.createElement("p");
  body.className = "message-body";
  body.textContent = message.message;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-button";
  remove.textContent = "Видалити";
  remove.addEventListener("click", async () => {
    if (!window.confirm(`Видалити повідомлення від ${message.name}?`)) return;
    remove.disabled = true;
    try {
      const response = await fetch(`/api/messages/${message.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не вдалося видалити запис.");
      article.remove();
      if (!list.children.length) statusText.textContent = "Поки що повідомлень немає.";
    } catch (error) {
      statusText.textContent = error.message;
      remove.disabled = false;
    }
  });

  top.append(heading, date);
  article.append(top, email, body, remove);
  return article;
}

async function loadMessages() {
  try {
    const response = await fetch("/api/messages");
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не вдалося отримати повідомлення.");

    list.replaceChildren();
    if (!result.messages.length) {
      statusText.textContent = "Поки що повідомлень немає.";
      return;
    }

    statusText.textContent = `Усього повідомлень: ${result.messages.length}`;
    result.messages.forEach((message) => list.append(createMessageCard(message)));
  } catch (error) {
    statusText.textContent = error.message;
  }
}

loadMessages();
