-- SQLite schema for the portfolio contact form.
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
  email TEXT NOT NULL CHECK(length(email) BETWEEN 5 AND 254),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 10 AND 5000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
ON messages(created_at DESC);
