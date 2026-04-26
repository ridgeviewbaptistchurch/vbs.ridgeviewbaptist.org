# VBS Registration System — Project Spec

> Hand this file to Claude Code as your first message. It contains everything needed to start building.

## Project overview

A custom vacation bible school registration and check-in system for Ridgeview Baptist Church. Replaces VBSPro. No volunteer management needed. Parents register their kids online, staff check kids in each night, admins run reports.

**Live URL:** `vbs.ridgeviewbaptist.org`
**Confirmation email from:** `noreply@vbs.ridgeviewbaptist.org`

---

## Tech stack

| Layer | Technology |
|---|---|
| API + logic | Cloudflare Workers (Hono router) |
| Database | Cloudflare D1 (SQLite) |
| Frontend hosting | Cloudflare Pages |
| File storage | Cloudflare R2 (yearly logo uploads) |
| Email | Cloudflare Email Workers |
| Auth | JWT in httpOnly cookies, bcrypt passwords |

The client already has a Cloudflare account. All infrastructure lives there.

---

## User roles

Three roles stored in the `users` table as a string enum.

### `super_admin`
Full access to everything. Intended for 1–2 people (church lead + one trusted staff).
- All staff_admin permissions
- Manage user accounts (create, edit, delete)
- Manage VBS sessions (dates, labels)
- Manage VBS settings (theme name, logo, accent color, active year)
- Undo / override check-ins
- Access `/admin/settings`

### `staff_admin`
Operational staff. 3–4 people with individual logins.
- Register new families and children
- Perform nightly check-ins
- View full family and children list
- Edit and delete registrations
- View stats dashboard
- Run reports and export CSV
- Cannot manage users, sessions, or settings

### `kiosk`
Shared login used on a volunteer's laptop during check-in nights.
- Register new families (walk-in)
- Perform nightly check-ins
- Cannot view family list, stats, reports, or any admin area
- Session never expires (long-lived JWT)

---

## Auth details

- Passwords hashed with bcrypt (cost factor 10)
- JWT stored in `httpOnly`, `Secure`, `SameSite=Strict` cookie
- Admin sessions (`super_admin`, `staff_admin`): expire after 8 hours
- Kiosk sessions: expire after 30 days (auto-renewing)
- Login at `/login`, redirects to `/checkin` (kiosk) or `/admin` (admin roles) based on role
- All `/admin/*` routes protected by middleware checking JWT + role
- `/checkin` requires any authenticated role

---

## Database schema (Cloudflare D1 / SQLite)

### `vbs_settings`
One row per year. Only one row has `active = 1` at a time.
```sql
CREATE TABLE vbs_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  theme_name TEXT NOT NULL,
  logo_url TEXT,
  accent_color TEXT NOT NULL DEFAULT '#4F46E5',
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `users`
Staff accounts only. Parents do not have accounts.
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'staff_admin', 'kiosk')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);
```

### `families`
One row per parent/guardian who registers. Tied to a VBS year.
```sql
CREATE TABLE families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  home_church TEXT NOT NULL,
  vbs_year INTEGER NOT NULL REFERENCES vbs_settings(year),
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `children`
One or more children per family. Grade stored as text: K, 1, 2, 3, 4, 5.
PK (pre-K) is intentionally excluded from the current UI but the column accepts it for future use.
```sql
CREATE TABLE children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  grade TEXT NOT NULL CHECK(grade IN ('PK','K','1','2','3','4','5')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `sessions`
One row per VBS night. Tied to a VBS year.
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vbs_year INTEGER NOT NULL REFERENCES vbs_settings(year),
  label TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `attendance`
Junction table. One row per child per night they attend. Unique constraint prevents double check-in.
```sql
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(child_id, session_id)
);
```

### Seed data for development
```sql
-- Active VBS year
INSERT INTO vbs_settings (year, theme_name, accent_color, active)
VALUES (2025, 'VBS 2025', '#4F46E5', 1);

-- 5 nights: Sunday–Thursday, June 2025
INSERT INTO sessions (vbs_year, label, date) VALUES
  (2025, 'Night 1', '2025-06-01'),
  (2025, 'Night 2', '2025-06-02'),
  (2025, 'Night 3', '2025-06-03'),
  (2025, 'Night 4', '2025-06-04'),
  (2025, 'Night 5', '2025-06-05');

-- Initial super admin (password: changeme — must be updated before deploy)
-- Replace password_hash with actual bcrypt hash of a real password
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', 'admin@ridgeviewbaptist.org', '$BCRYPT_HASH_HERE', 'super_admin');

-- Shared kiosk account
INSERT INTO users (name, email, password_hash, role)
VALUES ('Kiosk', 'kiosk@ridgeviewbaptist.org', '$BCRYPT_HASH_HERE', 'kiosk');
```

---

## Pages and routes

| Route | Access | Description |
|---|---|---|
| `/register` | Public | Parent self-registration form |
| `/login` | Public | Staff login, redirects by role |
| `/checkin` | All roles | Search families, check in kids, walk-in registration |
| `/admin` | staff_admin + | Dashboard: totals, nightly attendance, church breakdown |
| `/admin/families` | staff_admin + | Full searchable list, edit and delete |
| `/admin/reports` | staff_admin + | Grade rosters, attendance sheets, CSV export |
| `/admin/settings` | super_admin | Theme, logo, accent color, session dates, user accounts |

---

## Feature details

### `/register` — public registration form
- Shows current VBS theme name and logo (pulled from active `vbs_settings` row)
- Accent color from settings applied to button and header
- Parent fields: full name, phone, email, home church (free text)
- Child section: first name, last name, grade (dropdown: Finished Kindergarten, Finished 1st Grade … Finished 5th Grade)
- "Add another child" button — no hard limit, reasonable UX limit of ~6
- On submit: insert family row, insert child rows, send confirmation email, show success message
- No login required

### Confirmation email
- Sent from `noreply@vbs.ridgeviewbaptist.org` via Cloudflare Email Workers
- To: parent's email
- Subject: `You're registered for [theme_name]!`
- Body: parent name, list of registered children with grades, VBS dates (Night 1 through Night 5 with dates), church contact info
- Plain text + simple HTML version

### `/checkin` — check-in and walk-in registration
- Requires login (any role)
- Shows which session is active tonight (matched by today's date against sessions table; falls back to most recent if no exact match)
- Search bar: type last name or phone number, results update as you type
- Results show family card: parent name, phone, list of children
- Each child shows name, grade, notes (if any), and a "Check in" button
- If child already checked in tonight: button replaced with green "Checked in [time]" badge
- Super admin sees an "Undo" link next to checked-in badge
- "Register new family" button at top opens inline form (same fields as `/register` but without email confirmation — staff-initiated walk-in)
- Walk-in registrations do go through the same DB insert path; email confirmation is optional/skipped for walk-ins

### `/admin` — dashboard
- Total registered families
- Total registered children
- Breakdown by grade (K through 5)
- Breakdown by home church
- Nightly attendance totals (one number per session night)
- Simple stat cards layout, no heavy charting library needed

### `/admin/families` — family list
- Searchable, sortable table: parent name, phone, email, home church, # of children, registered date
- Click a row to expand children inline (names, grades, notes)
- Edit button: opens modal to edit parent info or child info
- Delete button: removes family and all children (with confirmation)
- Super admin only: can also delete individual children within a family

### `/admin/reports`
- **Grade roster:** select a grade → printable list of all children in that grade, sorted by last name, with parent name and phone
- **Nightly attendance sheet:** select a session → printable list of all registered children sorted by last name, with a checkbox column (for paper backup if needed)
- **Full export:** CSV download of all families + children for active year
- **Attendance export:** CSV of all check-ins for active year (child name, grade, session date)
- Print styles: clean, no nav, no buttons

### `/admin/settings`
- **Theme section:** edit theme name, upload logo (goes to R2, saves URL), pick accent color (color picker input)
- **Sessions section:** list of 5 nights with editable label and date fields
- **Users section:** table of all user accounts, add new user (name, email, password, role), edit role, delete user
- Cannot delete your own account
- Year management: view past years' settings (read-only), create new year (copies structure, sets active)

---

## API routes (Worker endpoints)

All API routes under `/api/*`. JSON request/response.

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/settings/active
PUT    /api/settings           (super_admin)
POST   /api/settings/logo      (super_admin, multipart)

POST   /api/register           (public)

GET    /api/families           (staff_admin+)
GET    /api/families/:id       (staff_admin+)
PUT    /api/families/:id       (staff_admin+)
DELETE /api/families/:id       (super_admin)

GET    /api/children/:id       (staff_admin+)
PUT    /api/children/:id       (staff_admin+)
DELETE /api/children/:id       (super_admin)

GET    /api/checkin/search     (all roles) ?q=lastname_or_phone&year=2025
POST   /api/checkin            (all roles) { child_id, session_id }
DELETE /api/checkin/:id        (super_admin)

GET    /api/sessions           (staff_admin+)
PUT    /api/sessions/:id       (super_admin)

GET    /api/reports/grades     (staff_admin+) ?grade=K&year=2025
GET    /api/reports/attendance (staff_admin+) ?session_id=1
GET    /api/reports/export/families   (staff_admin+) returns CSV
GET    /api/reports/export/attendance (staff_admin+) returns CSV

GET    /api/admin/stats        (staff_admin+)

GET    /api/users              (super_admin)
POST   /api/users              (super_admin)
PUT    /api/users/:id          (super_admin)
DELETE /api/users/:id          (super_admin)
```

---

## Project structure

Monorepo — one git repository, two deployable pieces. A single `git push` to `main` triggers both.

```
vbs-registration/              ← one git repo, push here to deploy everything
├── package.json               ← root scripts: deploy, dev, setup
├── .github/
│   └── workflows/
│       └── deploy.yml         ← CI: deploys worker then pages on push to main
│
├── worker/                    ← Cloudflare Worker (API)
│   ├── src/
│   │   ├── index.ts           # Hono app entry, route registration
│   │   ├── middleware/
│   │   │   ├── auth.ts        # JWT validation, role checking
│   │   │   └── cors.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── register.ts
│   │   │   ├── checkin.ts
│   │   │   ├── families.ts
│   │   │   ├── reports.ts
│   │   │   ├── sessions.ts
│   │   │   ├── settings.ts
│   │   │   └── users.ts
│   │   ├── lib/
│   │   │   ├── db.ts          # D1 query helpers
│   │   │   ├── email.ts       # Email Workers sender
│   │   │   └── auth.ts        # JWT sign/verify, bcrypt
│   │   └── types.ts           # Shared TS types/interfaces
│   ├── schema.sql             # Full schema + seed data
│   ├── package.json
│   └── wrangler.toml
│
├── frontend/                  ← Cloudflare Pages (static site)
│   ├── public/
│   │   ├── register/index.html
│   │   ├── login/index.html
│   │   ├── checkin/index.html
│   │   └── admin/
│   │       ├── index.html
│   │       ├── families/index.html
│   │       ├── reports/index.html
│   │       └── settings/index.html
│   ├── src/
│   │   ├── css/
│   │   │   └── main.css       # Theme-aware styles, CSS custom properties
│   │   └── js/
│   │       ├── api.js         # Fetch wrapper for all API calls
│   │       ├── auth.js        # Login state, redirect logic
│   │       ├── register.js
│   │       ├── checkin.js
│   │       └── admin/
│   │           ├── dashboard.js
│   │           ├── families.js
│   │           ├── reports.js
│   │           └── settings.js
│   └── wrangler.toml          # Pages project config
│
└── README.md
```

**Frontend approach:** Vanilla HTML/CSS/JS — no framework needed at this scale. Keep it simple and fast. CSS custom properties for theming (accent color from settings injected at page load via `/api/settings/active`).

---

## Deployment

### How it works

This is a monorepo with two Cloudflare targets:

| Target | Tool | Trigger |
|---|---|---|
| `worker/` → Cloudflare Worker | `wrangler deploy` | GitHub Actions on push to `main` |
| `frontend/` → Cloudflare Pages | `wrangler pages deploy` | GitHub Actions on push to `main` |

A single `git push origin main` runs the GitHub Actions workflow which deploys both in sequence — Worker first, then Pages.

### Root `package.json`

```json
{
  "name": "vbs-registration",
  "private": true,
  "scripts": {
    "dev:worker": "cd worker && wrangler dev",
    "dev:frontend": "cd frontend && npx serve public",
    "deploy:worker": "cd worker && wrangler deploy",
    "deploy:frontend": "cd frontend && wrangler pages deploy public --project-name=vbs-registration",
    "deploy": "npm run deploy:worker && npm run deploy:frontend",
    "setup": "cd worker && wrangler d1 create vbs-db && wrangler r2 bucket create vbs-assets"
  }
}
```

### GitHub Actions workflow (`.github/workflows/deploy.yml`)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install worker dependencies
        run: cd worker && npm install

      - name: Deploy Worker
        run: cd worker && npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy Pages
        run: cd frontend && npx wrangler pages deploy public --project-name=vbs-registration
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### GitHub secrets required

Add these in the GitHub repo under Settings → Secrets → Actions:

| Secret | Where to find it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token (use "Edit Cloudflare Workers" template, add Pages and D1 permissions) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar on any zone page |

### Local development

- Worker: `npm run dev:worker` — runs on `localhost:8787`, hot reloads
- Frontend: `npm run dev:frontend` — serves `frontend/public/` statically
- Frontend's `api.js` should point to `http://localhost:8787` in dev and `https://vbs-api.ridgeviewbaptist.org` (or the worker's `*.workers.dev` URL) in production, controlled by an environment check

### Manual deploy (no CI)

```bash
npm run deploy        # deploys both worker and frontend
npm run deploy:worker # worker only
npm run deploy:frontend # frontend only
```

### Custom domain setup (one-time, in Cloudflare dashboard)

1. **Worker:** Cloudflare dashboard → Workers → vbs-api → Triggers → Add Custom Domain → `vbs-api.ridgeviewbaptist.org`
2. **Pages:** Cloudflare dashboard → Pages → vbs-registration → Custom Domains → `vbs.ridgeviewbaptist.org`
3. DNS records are created automatically since the domain is already on Cloudflare

---

## Yearly theme system

On every page load, the frontend fetches `/api/settings/active` and applies:
- Theme name → page title and registration form header
- Logo URL → `<img>` in the header
- Accent color → CSS custom property `--accent` on `:root`, used for buttons, active states, links

This means next year's theme change is: upload new logo, update theme name, change accent color in settings. Zero code changes.

---

## Deferred / future features

- Parent self-service registration edit (edit their own registration via email link)
- Pre-K grade support (schema already supports `grade = 'PK'`, just needs UI)
- Dymo label printing (print endpoint that formats child name + grade as ZPL, sends to local Dymo via network)
- Multi-year data comparison in reports

---

## How to start (Claude Code instructions)

### Step 1 — Scaffold the monorepo

```bash
mkdir vbs-registration && cd vbs-registration
git init
```

Create the root `package.json` with the scripts shown in the Deployment section above.

### Step 2 — Create the Worker

```bash
mkdir worker && cd worker
npm create cloudflare@latest . -- --type=hono
```

Replace the generated `wrangler.toml` with:

```toml
name = "vbs-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
account_id = "efdb9bf05190f003e42285057bfeca6f"

[[d1_databases]]
binding = "DB"
database_name = "vbs-db"
database_id = "FILL_IN_AFTER_CREATE"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "vbs-assets"

[vars]
ENVIRONMENT = "production"
```

Set the JWT secret (never put in wrangler.toml):
```bash
wrangler secret put JWT_SECRET
```

### Step 3 — Create D1 database and R2 bucket

```bash
wrangler d1 create vbs-db          # copy the database_id into wrangler.toml
wrangler r2 bucket create vbs-assets
```

### Step 4 — Apply schema and seed data

```bash
wrangler d1 execute vbs-db --file=schema.sql          # production D1
wrangler d1 execute vbs-db --file=schema.sql --local  # local dev D1
```

After seeding, generate real bcrypt hashes for the initial super_admin and kiosk users and update the seed data or insert directly.

### Step 5 — Create the Pages project

```bash
mkdir -p ../frontend/public
cd ../frontend
```

Create `wrangler.toml`:
```toml
name = "vbs-registration"
pages_build_output_dir = "public"
account_id = "efdb9bf05190f003e42285057bfeca6f"
```

### Step 6 — Set up GitHub Actions

Create `.github/workflows/deploy.yml` as shown in the Deployment section. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repo secrets.

### Step 7 — Build order

Build in this sequence — each layer depends on the one before:

1. `worker/src/lib/auth.ts` — JWT sign/verify, bcrypt helpers
2. `worker/src/middleware/auth.ts` — JWT cookie validation, role guard middleware
3. `worker/src/routes/auth.ts` — login, logout, /me endpoints
4. `worker/src/routes/register.ts` + email sender — public registration + confirmation email
5. `worker/src/routes/checkin.ts` — search and check-in endpoints
6. `worker/src/routes/families.ts`, `reports.ts` — admin data endpoints
7. `worker/src/routes/settings.ts`, `users.ts` — super_admin management endpoints
8. Frontend pages in same order: register → login → checkin → admin → reports → settings
9. Email Workers + DNS setup last (needs ridgeviewbaptist.org DNS records for SPF/DKIM)

### Step 8 — Custom domains (Cloudflare dashboard, one-time)

1. Workers → vbs-api → Triggers → Custom Domain → `vbs-api.ridgeviewbaptist.org`
2. Pages → vbs-registration → Custom Domains → `vbs.ridgeviewbaptist.org`
3. DNS records auto-create since the domain is already on Cloudflare

### Notes

- The frontend's `api.js` base URL should be `http://localhost:8787` in dev and `https://vbs-api.ridgeviewbaptist.org` in production — use a `const API_BASE` at the top of `api.js` toggled by `window.location.hostname`
- CORS on the Worker must allow `https://vbs.ridgeviewbaptist.org` in production and `http://localhost:*` in dev
- Never commit `wrangler.toml` values for `JWT_SECRET` — use `wrangler secret put` and GitHub Actions secrets only