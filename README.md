# Vacay — Minimal Leave Requests App

Fast to run. Easy to read. Tiny PHP API + React client for employee vacation requests with a manager dashboard.

---

## Contents

- [1) Quick start](#1-quick-start)
- [2) What’s inside](#2-whats-inside)
- [3) Configuration](#3-configuration)
  - [Database](#database)
  - [CORS & Sessions](#cors--sessions)
- [4) API Overview (session-based)](#4-api-overview-session-based)
  - [Auth](#auth)
  - [Public Registration (employee)](#public-registration-employee)
  - [Employee — My Requests](#employee--my-requests)
  - [Manager — Users](#manager--users)
  - [Manager — Requests](#manager--requests)
- [5) Frontend (React + Vite)](#5-frontend-react--vite)
- [6) Example requests (cURL)](#6-example-requests-curl)
- [7) Security notes](#7-security-notes)
- [8) Troubleshooting](#8-troubleshooting)
- [9) Code style & comments](#9-code-style--comments)
- [10) License](#10-license)
- [11) Credits](#11-credits)

---

## 1) Quick start

```bash
# requirements
php -v        # PHP 8.4+
composer -V   # Composer
node -v       # Node 18+ recommended
npm -v

# install deps
composer install
npm install
```

### Initialize DB

```bash
php bin/migrate.php
```

- Applies `schema.sql` and seeds a **manager** *iff* `users` is empty:
  - Email: `manager@example.com`
  - Password: `pass`
  - Role: `manager`
  - Random `employee_code`

> **Change this credential immediately**.

### Dev: run API + Web (two terminals)

```bash
# Terminal A — PHP API (http://localhost:8000)
php -S localhost:8000 -t public
```

```bash
# Terminal B — Vite dev (http://localhost:5173)
npm run dev
```

> CORS allows `http://localhost:5173` with **credentials (cookies)**.

---

## 2) What’s inside

```
public/
  index.php                # Minimal API front controller (sessions, CORS, routes)
src/
  db.php                   # PDO bootstrap (App\DB::pdo) + tiny legacy helpers
bin/
  migrate.php              # One-shot schema apply + seed
schema.sql                 # Tables: users, vacation_requests, etc.

frontend/
  src/
    App.jsx                # Router (Login / Register / Employee / Manager)
    api.js                 # Fetch wrapper + typed endpoints
    pages/
      Login.jsx
      Register.jsx
      EmployeeHome.jsx     # My requests, create modal, filters, pagination
      ManagerHome.jsx      # Tabs: Requests & Users (approve/reject, CRUD)
    components/
      Brand.jsx            # Branding stub (logo/title)
```

> Paths can vary slightly; code assumes these conventions.

---

## 3) Configuration

### Database

- Default **SQLite**: `var/app.sqlite` (project root).
- Override via `DB_DSN`:

```
# .env (optional; loaded by bin/migrate.php if phpdotenv is installed)
DB_DSN=sqlite:/absolute/path/to/app.sqlite
# MySQL:
# DB_DSN="mysql:host=127.0.0.1;port=3306;dbname=vacay;charset=utf8mb4"
# Postgres:
# DB_DSN="pgsql:host=127.0.0.1;port=5432;dbname=vacay"
```

`src/db.php` PDO options:
- `PDO::ATTR_ERRMODE = EXCEPTION`
- `PDO::ATTR_DEFAULT_FETCH_MODE = FETCH_ASSOC`

SQLite note (legacy `db()`): `PRAGMA foreign_keys = ON`.

### CORS & Sessions

- Allowed origin: `http://localhost:5173`
- Credentials enabled
- Cookie: `httponly=true`, `samesite=Lax`

**Production tips**
- Serve FE + API under the **same origin** (best).
- If cross-origin, set exact `Access-Control-Allow-Origin`, enable HTTPS, `Secure` cookies.

---

## 4) API Overview (session-based)

Base during dev: `http://localhost:8000`  
JSON requests require `Content-Type: application/json`.  
Errors: `{ "error": "Message" }`.

### Auth

- **POST** `/login` → `{email,password}` → sets session, returns `{ id, name, email, role, employee_code }`
- **POST** `/logout` → `{ ok: true }`
- **GET** `/me` → current user or **401**

### Public Registration (employee)

- **POST** `/register` → `{ name, email, password }`
- Validates: name, valid email, password ≥ 6, unique email
- Creates `employee` + generated `employee_code`
- **201** `{ ok: true, employee_code: "123-456-789" }`

### Employee — My Requests

- **GET** `/me/requests` → list of own requests
- **POST** `/me/requests` → `{ date_from:"YYYY-MM-DD", date_to:"YYYY-MM-DD", reason }` → **201** `{ id }`

### Manager — Users

- **GET** `/admin/users` → list `{ id, name, email, role, employee_code, created_at }`
- **POST** `/admin/users` → `{ name, email, password, role?, employee_code? }` → **201** `{ id, employee_code }`
- **PUT** `/admin/users/{id}` → partial `{ name?, email?, password? }` → `{ ok: true }`
- **DELETE** `/admin/users/{id}` → **204** No Content (expects FK cascade)

### Manager — Requests

- **GET** `/admin/requests` → all requests joined with user info
- **POST** `/admin/requests/{id}/approve`
- **POST** `/admin/requests/{id}/reject` → `{ ok: true }`

---

## 5) Frontend (React + Vite)

- `src/api.js`:
  - Base: `/api` (server strips `/api` in `public/index.php`)
  - `credentials: "include"` for session cookies
  - Throws `Error(message)` on non-2xx (surfaces `{error}`)

- Pages:
  - `Login.jsx` → `api.login` → redirect:
    - `manager` → `/manager`
    - else → `/employee`
  - `Register.jsx` → public sign-up (UI role radio is ignored by backend)
  - `EmployeeHome.jsx` → list/filter/paginate + create modal
  - `ManagerHome.jsx` → tabs:
    - **Requests**: approve/reject
    - **Users**: list, create (modal), edit (modal), delete

Frontend dependencies (install first):

Before running the app, install the frontend dependencies and React Router:

```bash
# from the frontend folder (adjust if your src/ is elsewhere)
npm i

# install React Router (routing for /login, /register, /employee, /manager)
npm i react-router-dom
```

Dev:

```bash
npm run dev
# open http://localhost:5173
```

Build:

```bash
npm run build
```

---

## 6) Example requests (cURL)

```bash
# Login (store cookies)
curl -i -c cookie.txt -H "Content-Type: application/json"   -d '{"email":"manager@example.com","password":"pass"}'   http://localhost:8000/login

# Me (authenticated)
curl -b cookie.txt http://localhost:8000/me

# Create employee (manager)
curl -b cookie.txt -H "Content-Type: application/json"   -d '{"name":"Alice","email":"alice@example.com","password":"secret"}'   http://localhost:8000/admin/users

# List all requests (manager)
curl -b cookie.txt http://localhost:8000/admin/requests

# Approve a request (manager)
curl -b cookie.txt -X POST http://localhost:8000/admin/requests/42/approve
```

---

## 7) Security notes

- **Passwords**: `PASSWORD_DEFAULT` (argon/bcrypt per PHP build)
- **Sessions**: HttpOnly, `SameSite=Lax` (use `Secure` under HTTPS)
- **CORS**: dev locked to `http://localhost:5173`
- **Errors**: `display_errors=0`, PHP errors → exceptions → JSON 500
- **AuthZ**: `require_auth()` for employee, `require_manager()` for admin
- **Validation**: email via `FILTER_VALIDATE_EMAIL`, password length, uniqueness (409)

**Hardening (prod)**
- Rate limit `/login`, brute-force protection
- CSRF protection if cross-origin
- Rotate seed credentials; enforce strong passwords
- HTTPS-only; HSTS; audit admin actions

---

## 8) Troubleshooting

- **CORS**: use FE at `http://localhost:5173` and API at `http://localhost:8000`, or configure a Vite proxy
- **Session not sticking**: ensure browser allows cookies (cross-origin in dev); or proxy API through Vite
- **“DB not initialized”**: run `php bin/migrate.php`, check `DB_DSN`
- **409 email in use**: use another email or delete the user (manager)
- **204 on DELETE**: expected (empty body)
- **SQLite locks**: avoid concurrent writers; consider MySQL/Postgres

---

## 9) Code style & comments

- Top-of-file headers for PHP + functions/`if` comments
- PHP formatted PSR-12 without behavior changes
- React components documented with JSDoc + inline guard comments

---

## 10) License

Unlicensed/internal by default. Add a license if distributing.

---

## 11) Credits

Author: **Christos Polimatidis**  
Date: **2025-11-01**
