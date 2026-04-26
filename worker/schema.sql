CREATE TABLE vbs_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  theme_name TEXT NOT NULL,
  logo_url TEXT,
  accent_color TEXT NOT NULL DEFAULT '#4F46E5',
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'staff_admin', 'kiosk')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  home_church TEXT NOT NULL,
  vbs_year INTEGER NOT NULL REFERENCES vbs_settings(year),
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  grade TEXT NOT NULL CHECK(grade IN ('PK','K','1','2','3','4','5')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vbs_year INTEGER NOT NULL REFERENCES vbs_settings(year),
  label TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(child_id, session_id)
);

-- Seed: active VBS year
INSERT INTO vbs_settings (year, theme_name, accent_color, active)
VALUES (2026, 'VBS 2026', '#4F46E5', 1);

-- Seed: 5 nights (Sun–Thu, June 2026 — update dates in Settings once deployed)
INSERT INTO sessions (vbs_year, label, date) VALUES
  (2026, 'Night 1', '2026-06-07'),
  (2026, 'Night 2', '2026-06-08'),
  (2026, 'Night 3', '2026-06-09'),
  (2026, 'Night 4', '2026-06-10'),
  (2026, 'Night 5', '2026-06-11');

-- Seed: super admin (initial password: changeme2025 — change after first login)
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', 'admin@ridgeviewbaptist.org', '$2a$10$BoBCvr8IDvEBqDrJGnGyA.dCJ8XfUEPJXUPwORtNqSWxbTmemR3RG', 'super_admin');

-- Seed: kiosk account (initial password: kiosk2025)
INSERT INTO users (name, email, password_hash, role)
VALUES ('Kiosk', 'kiosk@ridgeviewbaptist.org', '$2a$10$ws2/vkcZWPbQTmmy5abpHOqT0/I2Mcd27VmTPL7i/cRrgYSRNtPu.', 'kiosk');
