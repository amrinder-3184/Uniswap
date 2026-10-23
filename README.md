# UniSwap

Full-stack app for **UniSwap**, a second-hand marketplace where students buy and sell items such as textbooks, notes, furniture and electronics within their campus.

- **Backend (repository root):** REST API built with Node.js, Express 5 and PostgreSQL. It includes JWT authentication, input validation, an automated API test suite (Jest + Supertest) running against an isolated test database, and a Docker Compose setup.
- **Frontend (`frontend/`):** React 19 + Vite single-page app that uses the API.
- **CI:** a GitHub Actions workflow checks both on every push and pull request.

- [API reference](docs/API.md)
- [Quick start (local)](#local-setup-nodejs--postgresql)
- [Quick start (Docker)](#running-with-docker)
- [Frontend](#frontend)
- [Testing](#testing)

---

## Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Technology stack](#technology-stack)
5. [Repository structure](#repository-structure)
6. [Local setup (Node.js + PostgreSQL)](#local-setup-nodejs--postgresql)
7. [Environment variables](#environment-variables)
8. [Running with Docker](#running-with-docker)
9. [Frontend](#frontend)
10. [API overview](#api-overview)
11. [Database schema](#database-schema)
12. [Security, validation and error handling](#security-validation-and-error-handling)
13. [Testing](#testing)
14. [Continuous integration](#continuous-integration)
15. [Verification status](#verification-status)
16. [Troubleshooting](#troubleshooting)
17. [Known limitations and future improvements](#known-limitations-and-future-improvements)

---

## Overview

Students often sell used items through scattered chat groups, where listings get lost and nobody can tell whether an item is still available. UniSwap provides one place to list items, search and filter them, save favorites, message sellers and record purchases.

This repository holds both parts, which are installed and run separately:
- **The backend (API)** lives at the repository root. Most of this README is about it.
- **The React frontend** lives in [`frontend/`](frontend/), with its own `package.json` and [README](frontend/README.md).

The frontend calls the API over HTTP. The backend does not serve the frontend files.

## Features

- **Accounts:** register, log in (JWT), view and update your profile, change your password, delete your account.
- **Roles:** every account is a `student`; `admin` accounts can create categories. Roles can only be changed directly in the database.
- **Listings:**
  - Create, read, update and delete; only the owner can edit or delete.
  - Search by keyword, filter by category, sort by price, date or title; paginated.
- **Images:** up to 5 per listing. JPEG, PNG or WebP, max 5 MB, checked by file content (not just extension).
- **Favorites:** save and remove listings.
- **Messaging:** contact a listing's seller and view conversations.
- **Purchases:** buying a listing marks it sold inside a database transaction with a row lock, so two buyers can't buy the same item. Purchase and sales history are available. (No payment processing.)
- **Recommendations and similar listings:** rule-based scoring in SQL and JavaScript (category, price range, condition, recency).
- **AI assistant (optional):** `POST /ai/chat` uses the OpenAI API with read-only tools over marketplace data. Everything else works without an OpenAI key.

## Architecture

The code is split into layers. Each HTTP request passes through them in order:

```
HTTP request
   │
   ▼
src/app.js           helmet (security headers) → CORS → rate limit → JSON body parser (10 kB)
   │
   ▼
src/routes/          maps URL + method to a handler chain
   │
   ▼
src/middleware/      authenticateToken (JWT) → requireAdmin (role from DB) → validation
   │
   ▼
src/controllers/     reads the request, calls a service, sends the JSON response
   │
   ▼
src/services/        business rules and SQL (parameterised queries via the pg pool)
   │
   ▼
db.js                one shared PostgreSQL connection pool
   │
   ▼
PostgreSQL

Any error thrown along the way → src/middleware/error.middleware.js → consistent JSON error
```

`src/app.js` exports `createApp()`, which builds the Express app **without** starting a server. `index.js` calls it and listens on a port; the tests pass the same app straight to Supertest. Both run identical code, and tests need no open port.

## Technology stack

| Technology | Used for | Why |
|---|---|---|
| Node.js 24, ES modules | Runtime | Current LTS; native `import`/`export` |
| Express 5 | HTTP framework | Small and widely used; v5 forwards errors from `async` handlers to the error middleware automatically |
| PostgreSQL 18 + `pg` | Database | Relational data with foreign keys, unique and check constraints, transactions and row locks |
| bcrypt | Password hashing | Slow, salted hashing designed for passwords |
| jsonwebtoken | Authentication | Stateless signed tokens (HS256, 1 hour) |
| helmet, cors, express-rate-limit | HTTP hardening | Security headers, allowed origins, brute-force protection |
| multer + file-type | Image uploads | Multipart parsing, plus checking the file's real content |
| openai | Optional AI assistant | Chat with tool calling |
| Jest + Supertest | Testing | Real HTTP requests against the app, no running server needed |
| ESLint | Static checks | Catches unused code and common mistakes |
| React 19 + Vite 8 | Frontend (`frontend/`) | Component-based UI; Vite gives a fast dev server and production builds |
| Oxlint | Frontend static checks | Fast linter with React rules |
| GitHub Actions | CI | Lint, tests and the frontend build on every push and pull request |
| Docker + Compose | Containerised development | API and database with one command |

## Repository structure

```
.
├── index.js                 # Entry point: createApp() + listen + graceful shutdown
├── db.js                    # PostgreSQL connection pool
├── schema.sql               # Database schema (7 tables; safe to re-run, no DROP)
├── src/
│   ├── app.js               # createApp(): middleware, routes, error handling
│   ├── config/
│   │   ├── env.js           # Loads .env, or .env.test when NODE_ENV=test
│   │   ├── security.js      # JWT algorithm/expiry, secret check, rate-limit test switch
│   │   └── uploads.js       # Upload folder (UPLOAD_ROOT, default ./uploads)
│   ├── routes/              # One router per resource
│   ├── middleware/          # auth, validation, upload, error handling
│   ├── controllers/         # HTTP layer
│   ├── services/            # Business logic + SQL
│   └── utils/AppError.js    # Error class carrying an HTTP status
├── tests/
│   ├── *.test.js            # API tests, one file per area
│   ├── helpers/             # Test data builders, database reset
│   └── setup/               # Database safety guard, global setup/teardown, per-file hooks
├── docs/API.md              # Full endpoint reference
├── scripts/                 # Maintenance scripts (see below)
├── seed-categories.js       # Inserts default categories (skips existing ones)
├── Dockerfile, compose.yaml, .dockerignore
├── .github/workflows/ci.yml # Backend job + frontend job
├── jest.config.js, eslint.config.js
├── .env.example, .env.test.example, .env.docker.example   # Templates (placeholders only)
└── frontend/                # React + Vite app (own package.json, README, Oxlint, tests)
    ├── src/                 # main.jsx, App.jsx, components/, utils/
    ├── public/
    ├── tests/               # Unit tests (Node's built-in test runner)
    └── .env.example         # VITE_API_URL template
```

The backend tooling deliberately leaves `frontend/` alone:
- **ESLint** ignores it (the frontend has its own Oxlint).
- **Jest** only looks in `tests/`.
- **Coverage** only measures `src/` and `db.js`.
- **The Docker image** is built from an allowlist that doesn't include `frontend/`.

> ⚠️ **Legacy scripts. Do not run them.** The root folder also contains older standalone scripts from earlier development: `test-*.js`, `verify-*.js`, `run-all-tests.js`, `append-tool.js`, `fix-urls.cjs`, `check-pgvector.js`, `dump-schema.js` and `math.js`. They have **not been reviewed** and are not part of the test suite, linting or CI.
> - Most `test-*.js` / `verify-*.js` scripts run `DELETE`/`TRUNCATE` statements against the database configured in `.env`, which is your development data.
> - `append-tool.js` modifies source code.
> - `fix-urls.cjs` rewrites files in a sibling `../uniswap-frontend` folder from before the frontend moved into `frontend/`. Running it again would corrupt the API URLs.
>
> Use `npm test` instead.

## Local setup (Node.js + PostgreSQL)

### Prerequisites
- Node.js 24 and npm
- PostgreSQL 18 (the commands below use the default Windows install path)
- PowerShell (the commands are written for Windows; macOS/Linux equivalents are similar)

### First-time setup
```powershell
# 1. Install dependencies (exact versions from package-lock.json)
npm ci

# 2. Create the development database and its tables
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres uniswap_db
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d uniswap_db -f schema.sql

# 3. Create your settings file and replace the placeholders
copy .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # a value for JWT_SECRET

# 4. Optional: add the default categories (skips any that already exist)
node seed-categories.js

# 5. Start the API
npm start
```
The API listens on **http://localhost:3000**. Check it with `curl.exe http://localhost:3000/health`.

`schema.sql` only uses `CREATE ... IF NOT EXISTS`. Running it on an existing database adds anything missing and changes nothing else.

### Creating an admin account
New accounts are always `student`, and there is deliberately no API for changing roles. Register through the API, then promote the account in the database:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d uniswap_db -c "UPDATE users SET role = 'admin' WHERE email = 'you@example.com';"
```
The change takes effect immediately; the role is read from the database on every admin request.

### Starting again later
```powershell
npm start
```

## Environment variables

Each way of running the project has its own settings file. Only the `*.example` templates are committed.

| File | Used by | Created from |
|---|---|---|
| `.env` | `npm start` (local Node.js) | `.env.example` |
| `.env.test` | `npm test` (loaded **instead of** `.env`) | `.env.test.example` |
| `.env.docker` | `docker compose --env-file .env.docker ...` | `.env.docker.example` |
| *(workflow file)* | GitHub Actions | values are in `.github/workflows/ci.yml` |

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | no | `3000` | Port the API listens on |
| `DB_HOST` | yes | – | PostgreSQL host (`localhost` locally, `db` inside Compose) |
| `DB_PORT` | yes | – | PostgreSQL port (usually `5432`) |
| `DB_NAME` | yes | – | Database name (must end in `_test` for tests) |
| `DB_USER` | yes | – | Database user |
| `DB_PASSWORD` | yes | – | Database password |
| `JWT_SECRET` | yes | – | Token signing key. **The server refuses to start** if it is missing, shorter than 32 characters, or a placeholder. |
| `ALLOWED_ORIGINS` | no | `http://localhost:5173` | Comma-separated browser origins allowed by CORS |
| `OPENAI_API_KEY` | no | – | Enables `POST /ai/chat`. Without it that endpoint returns 503. |
| `OPENAI_BASE_URL` | no | OpenAI's API | Tests point this at an unreachable local address |
| `AI_MODEL` | no | `gpt-5.6-luna` | Chat model name |
| `UPLOAD_ROOT` | no | `./uploads` | Folder for uploaded images (tests use a temporary folder) |
| `NODE_ENV` | no | – | `test` for the test suite (Jest sets it), `production` in the Docker image |
| `TEST_DB_ALLOWED_HOSTS` | no | – | Tests only: extra database hosts allowed besides localhost |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Docker | – | Docker only: database created on first start; also passed to the API |
| `API_PORT` | no | `3000` | Docker only: port published on your machine |

## Running with Docker

Docker Compose runs the API and its own PostgreSQL 18 database in containers. Node.js and PostgreSQL don't need to be installed. This setup is separate from the local one: it has its own database and its own settings file, `.env.docker`.

### Prerequisites
- Docker Desktop with Compose v2 (`docker compose version`). Docker Desktop must be running.
- Port 3000 free on your machine, or set `API_PORT` in `.env.docker`.

### First-time setup
```powershell
# 1. Create your Docker settings file (git-ignored) and replace the placeholders:
#    POSTGRES_PASSWORD and JWT_SECRET (32+ random characters).
copy .env.docker.example .env.docker
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # a value for JWT_SECRET

# 2. Build the image and start both containers in the background
docker compose --env-file .env.docker up -d --build

# 3. Check that both services report "healthy"
docker compose --env-file .env.docker ps
curl.exe http://localhost:3000/health
```
The API is then available at **http://localhost:3000**. The port is published on `127.0.0.1` only, so it is reachable from this computer but not from other devices on your network.

Every `docker compose` command needs `--env-file .env.docker`. Compose reads `.env` by default, and that file holds your local Node settings. The compose file stops with an error if the `POSTGRES_*` variables are missing, so a forgotten flag can't start the containers with the wrong settings. To avoid typing the flag in a PowerShell session, run `$env:COMPOSE_ENV_FILES=".env.docker"` once.

### Subsequent starts and stops
```powershell
docker compose --env-file .env.docker up -d            # start again (add --build after code changes)
docker compose --env-file .env.docker logs -f api      # follow API logs (Ctrl+C stops following)
docker compose --env-file .env.docker logs db          # database logs
docker compose --env-file .env.docker stop             # stop containers, keep everything
docker compose --env-file .env.docker down             # remove containers, KEEP data volumes
```
**Your data is preserved by `stop`, `restart` and `down`.** It is deleted only by `docker compose down -v` or `docker volume rm`. Those permanently remove the `uniswap_pgdata` (database) and `uniswap_uploads` (images) volumes.

### How the Docker database is initialised
- On the **first** start, when the `uniswap_pgdata` volume is empty, PostgreSQL runs `schema.sql` from `/docker-entrypoint-initdb.d/`. That creates the 7 tables and their indexes.
- On **every later start**, PostgreSQL finds existing data, logs `Skipping initialization`, and leaves it untouched. The init script does **not** run on restarts.
- The database is not published to your machine; only the `api` container can reach it, at hostname `db`. For manual access:
  `docker compose --env-file .env.docker exec db psql -U uniswap -d uniswap` (use your `POSTGRES_USER` / `POSTGRES_DB`).
- To make an account admin:
  `docker compose --env-file .env.docker exec db psql -U uniswap -d uniswap -c "UPDATE users SET role = 'admin' WHERE email = 'you@example.com';"`

**Applying future schema changes:** add the change to `schema.sql` using `IF NOT EXISTS` (or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) so new databases get it, then apply it to an existing database by hand:
```powershell
Get-Content schema.sql | docker compose --env-file .env.docker exec -T db psql -U uniswap -d uniswap
```
`NOTICE: relation "..." already exists, skipping` lines are expected; existing tables and data are left as they are. For the local database, run `psql -U postgres -d uniswap_db -f schema.sql` the same way.

### Uploaded images
Listing images are stored in the named volume `uniswap_uploads`, mounted at `/app/uploads`. They survive restarts, `down` and rebuilds, and are served at `http://localhost:3000/uploads/listings/<file>`.

### What's in the image
- **Base image:** `node:24-slim`.
- **Contents:** production dependencies only (`npm ci --omit=dev`) plus `index.js`, `db.js` and `src/`. `.dockerignore` is an allowlist, so `.env*` files, `.git`, tests, coverage and local uploads never enter the build.
- **Runtime user:** the unprivileged `node` user.
- **Health check:** a Docker health check calls `/health`.
- **Shutdown:** `node` runs directly (not through npm), so `docker stop` triggers the app's graceful shutdown.
- **Frontend:** not included in the image or the Compose stack. Run it separately (see below).

## Frontend

The React app in [`frontend/`](frontend/) is a separate npm project. Details are in [frontend/README.md](frontend/README.md).

**Pages:** home with recommendations, browse and search, listing detail, sell, my listings, favorites, messages, transactions, plus an AI chat widget.

### Running it locally
Start the backend first, either locally (`npm start`) or with Docker. Both serve the API on `http://localhost:3000`. Then, in a second terminal:
```powershell
cd frontend
npm ci                          # first time only
copy .env.example .env          # optional; VITE_API_URL defaults to http://localhost:3000
npm run dev                     # http://localhost:5173
```

**CORS:** the backend's default `ALLOWED_ORIGINS` is `http://localhost:5173`, the Vite dev server, so no extra setup is needed. For another port, or `npm run preview` (port 4173), add that origin to `ALLOWED_ORIGINS` in the backend's settings file.

### Frontend checks
```powershell
cd frontend
npm run lint                    # Oxlint
npm test                        # unit tests (Node's built-in test runner)
npm run build                   # production build into frontend/dist (git-ignored)
```

## API overview

All endpoints, request rules and example responses are in **[docs/API.md](docs/API.md)**.

| Area | Endpoints | Auth |
|---|---|---|
| Health | `GET /health` | – |
| Auth | `POST /auth/register`, `POST /auth/login` | – |
| Own account | `GET/PATCH/DELETE /users/me`, `GET /users/me/listings`, `PATCH /users/me/password` | user |
| Categories | `GET /categories`, `GET /categories/:id` / `POST /categories` | – / **admin** |
| Listings | `GET /listings`, `GET /listings/:id` / `POST /listings`, `PATCH`/`DELETE /listings/:id` | – / user (owner for changes) |
| Images | `GET /listings/:listingId/images` / `POST`, `DELETE .../images/:imageId` | – / owner |
| Similar | `GET /listings/:listingId/similar` | – |
| Purchases | `POST /listings/:listingId/buy`, `GET /transactions/purchases`, `GET /transactions/sales` | user |
| Favorites | `GET /favorites`, `POST`/`DELETE /favorites/:listingId` | user |
| Messages | `GET /messages`, `POST /messages`, `GET /messages/:listingId/:otherUserId` | user |
| Recommendations | `GET /recommendations` | user |
| AI assistant | `POST /ai/chat` | user |

Example: register, log in, then create a listing (PowerShell):
```powershell
$base = "http://localhost:3000"
Invoke-RestMethod -Method Post "$base/auth/register" -ContentType "application/json" `
  -Body '{"name":"Asha Rao","email":"asha@example.com","password":"secret123"}'

$login = Invoke-RestMethod -Method Post "$base/auth/login" -ContentType "application/json" `
  -Body '{"email":"asha@example.com","password":"secret123"}'
$headers = @{ Authorization = "Bearer $($login.token)" }

Invoke-RestMethod -Method Post "$base/listings" -Headers $headers -ContentType "application/json" `
  -Body '{"title":"Engineering Mathematics textbook","description":"Second-hand copy","price":450,"condition":"Used","category_id":1}'
```
Creating a listing needs an existing category (`node seed-categories.js`, or `POST /categories` as an admin).

```json
{
  "id": 1, "title": "Engineering Mathematics textbook", "description": "Second-hand copy",
  "price": "450.00", "condition": "Used", "seller_id": 1, "category_id": 1,
  "created_at": "2026-10-12T10:00:00.000Z"
}
```

## Database schema

`schema.sql` defines 7 tables. It is safe to re-run: `CREATE ... IF NOT EXISTS` only, with no `DROP` or `TRUNCATE`.

| Table | Purpose | Key constraints |
|---|---|---|
| `users` | Accounts | `email` UNIQUE; `role` defaults to `student`; bcrypt `password_hash` |
| `categories` | Listing categories | `name` UNIQUE |
| `listings` | Items for sale | FK `seller_id` → users (CASCADE), FK `category_id` → categories (RESTRICT); `status` CHECK in (`available`, `sold`); `price NUMERIC(10,2)` |
| `listing_images` | Image paths per listing | FK → listings (CASCADE) |
| `favorites` | User ↔ listing bookmarks | Composite primary key `(user_id, listing_id)`; both FKs CASCADE |
| `messages` | Buyer → seller messages | FKs CASCADE; CHECK sender ≠ receiver |
| `transactions` | Purchase records | FKs `ON DELETE SET NULL`, so history survives account or listing deletion |

There are also 8 indexes on foreign-key and conversation lookups (`idx_messages_*`, `idx_transactions_*`, `idx_listing_images_listing_id`).

## Security, validation and error handling

**Authentication**
- **Passwords:** hashed with bcrypt (cost 10) and never returned by the API. New passwords must be 6 characters to **72 bytes** in UTF-8; bcrypt ignores anything after 72 bytes, so longer ones are rejected rather than silently cut short.
- **Tokens:** JWTs are signed and verified with **HS256 only**, so tokens using any other algorithm (including `none`) are rejected. They expire after 1 hour.
- **Secret check:** the server refuses to start if `JWT_SECRET` is missing, short or a placeholder.
- **Login failures:** a wrong password and an unknown email produce the same `401` message, so attackers can't tell which emails are registered.

**Authorization**
- **Identity:** the user always comes from the token, never from the request body. A client cannot set `seller_id`, `sender_id` or `role`.
- **Ownership:** only the owner can edit or delete a listing or its images.
- **Admin role:** read from the database on every admin request, so a forged role claim in a token has no effect and a demoted admin loses access immediately.

**Validation and data safety**
- **Validation runs before any database access:** types, required fields, lengths matching the column sizes, price range, IDs within the `INTEGER` range, and no repeated query parameters.
- **SQL:** every query is parameterised. The only dynamic SQL is a fixed allowlist of sort columns and update fields.
- **Race conditions:** handled by the database itself. A duplicate email or category from simultaneous requests hits a UNIQUE constraint and returns `409`; purchase and delete lock the listing row (`SELECT ... FOR UPDATE`).
- **Uploads:** the file's real content is checked, filenames are generated by the server, and rejected files are deleted.

**HTTP hardening**
- helmet security headers, a CORS origin allowlist, a 10 kB JSON body limit, and rate limits:
  - all routes: 1000 requests / 15 minutes
  - `/auth`: 20 requests / 15 minutes
  - `/ai/chat`: 10 requests / minute

**Error handling** (`src/middleware/error.middleware.js`)
- **One format:** every error is JSON, `{ "message": ... }`, plus an `errors` array for validation failures.
- **Database errors caused by bad input** (duplicate key, unknown foreign key, value too long, out of range) become `400` or `409` with a friendly message.
- **Malformed JSON** returns `400`, **bodies over 10 kB** return `413`, and **unknown routes** return a JSON `404`.
- **Unexpected errors** return `500 "Internal server error"`, with no stack traces or SQL. Only these are logged; 4xx errors aren't, because their request bodies may contain passwords.

## Testing

The suite sends real HTTP requests through the Express app (Supertest) to a **real PostgreSQL test database**. The only mocks replace the OpenAI client, plus a simulated database outage in one error-handling test.

### One-time setup
```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres uniswap_test
copy .env.test.example .env.test     # set DB_PASSWORD and a random JWT_SECRET
```
You don't need to create tables: the test setup applies `schema.sql` automatically.

### Commands
```powershell
npm test                      # run all tests
npm test -- --randomize       # run tests in random order (checks they don't depend on each other)
npm run test:coverage         # tests + coverage report + coverage thresholds
npm test -- tests/listings.test.js   # one file
npm run lint                  # ESLint
```
The HTML coverage report is written to `coverage/lcov-report/index.html` (git-ignored).

### Test database safety
Every test empties the tables it uses, so the suite has several safeguards against touching real data:
- **Separate settings:** tests load **only `.env.test`**, never `.env`, so they can't pick up development database settings or the real OpenAI key.
- **The guard refuses to run** unless `NODE_ENV=test`, the database name ends in `_test`, the host is local (`localhost`, `127.0.0.1`, `::1`, or a host listed in `TEST_DB_ALLOWED_HOSTS`), and the database differs from the one in `.env`.
- **It also asks PostgreSQL** which database the connection actually uses (`SELECT current_database()`) and checks that it ends in `_test`.
- **Cleanup:** before each test the 7 tables are emptied (`TRUNCATE ... RESTART IDENTITY CASCADE`) on the same connection that passed the check. Tables are never dropped.
- **No parallel runs:** test files run one at a time, because they share one database.
- **Uploads** go to a temporary folder that is deleted after the run, never `./uploads`.
- **OpenAI is blocked:** every test fails if a real OpenAI call is attempted. The test settings also use a fake key and an unreachable local URL.
- **Rate limits** are skipped only when `NODE_ENV=test` *and* the database name ends in `_test`. A dedicated test checks that they still apply otherwise.

### What is covered
| Area | Examples |
|---|---|
| Auth | Register and login, duplicate email (including 5 simultaneous sign-ups), 72-byte password boundary with ASCII, accented letters and emoji, tokens that are missing, malformed, expired, wrong-secret, HS512 or `alg: none` |
| Users | Profile read and update, privilege-escalation attempts, password change, account deletion with cascade |
| Categories | Public reads; admin-only create (anonymous, student, forged-claim and demoted-admin cases); duplicates |
| Listings | CRUD, pagination, filter, search, sort, sold listings hidden, malformed IDs, field limits, ownership |
| Images | Upload and delete, fake image rejected by content, size and count limits, non-owner upload cleaned up |
| Transactions | Purchase, 4 simultaneous buyers (exactly one succeeds), buying twice, buying your own listing |
| Favorites, messages | Add/remove/duplicates; outsiders can't read other users' conversations |
| Recommendations, similar | Ranking rules, own and sold listings excluded |
| AI chat | Mocked OpenAI: answers, tool call against real data, 503 on failure, input validation |
| Errors and security | JSON 404, malformed JSON, 413, CORS, headers, simulated database outage, no 5xx for 88 hostile inputs |
| Rate limits | Active outside test mode (21st login attempt → 429, 11th AI request → 429) |
| Safety guard | Every rejection rule of the database guard and the JWT secret check |

## Continuous integration

`.github/workflows/ci.yml` runs two independent jobs, in parallel, on every push and pull request.

**Backend: lint and test** (repository root)
1. **Starts a PostgreSQL 18 service** with an empty database `uniswap_ci_test`. A `pg_isready` health check makes the steps wait until it is ready.
2. **Checks out the code** and **sets up Node.js 24** (both actions pinned to exact commit SHAs).
3. **Installs dependencies** with `npm ci`.
4. **Lints** with `npm run lint`.
5. **Runs the tests** with `npm run test:coverage`. The test setup creates the tables from `schema.sql`, the safety guard checks the connection, and the job fails if a test fails or coverage drops below the thresholds in `jest.config.js`.

**Frontend: lint, test and build** (in `frontend/`)
1. **Checks out the code** and **sets up Node.js 24** (same pinned actions; npm cache keyed on `frontend/package-lock.json`).
2. **Installs dependencies** with `npm ci`.
3. **Lints** with `npm run lint` (Oxlint).
4. **Runs the unit tests** with `npm test`.
5. **Builds** with `npm run build`, to check the app compiles. It needs no backend, database or secrets.

**Security:**
- **Permissions:** the workflow token is read-only (`contents: read`), and the checkout step doesn't store it.
- **Pull requests:** the workflow uses `pull_request`, not `pull_request_target`, so pull-request code never runs with repository secrets.
- **No real secrets:** all CI settings are throwaway values in the workflow file, and the OpenAI settings point at a fake key and an unreachable address.

The backend job has a 15-minute timeout and the frontend job a 10-minute one. A newer push cancels an outdated run.

## Verification status

All results below are from **local runs** (Windows, Node.js 24.16, PostgreSQL 18). Backend tests last ran on 23 October 2026, after the frontend was added.

| Check | Result |
|---|---|
| `npm run lint` | Passes, and ignores `frontend/` |
| `npm test` | **230 tests passed, 0 failed, 0 skipped** (14 test files), in both normal and `--randomize` order |
| `npm run test:coverage` | Statements 83.3%, branches 70.7%, functions 81.5%, lines 85.0%. Thresholds: 80 / 65 / 75 / 80. |
| Frontend: `npm run lint`, `npm test`, `npm run build` (in `frontend/`) | Oxlint 0 errors and 0 warnings; **19 unit tests passed**; build succeeds |
| Frontend in a real browser | **52/52 checks passed** in headless Chrome against the API running on the test database: browse, search, sorting, pagination, login, listing images, favorites, messages (including a deliberately delayed-response race), single chat widget, and 0 page errors. The browser script is not part of this repository. |
| GitHub Actions | **Simulated locally only.** The backend job's commands and settings were run in a clean copy of the repo against a new empty database, and the frontend job's commands were run in `frontend/`. The workflow has not yet run on GitHub. |
| Docker | Image built (81 MB, non-root); Compose stack healthy; schema initialised on first start; API smoke test passed; data and uploads kept after `restart` and `down`/`up`; graceful shutdown confirmed. **Verified locally with Docker Desktop on 12 October 2026, before the frontend was added.** The image excludes `frontend/` by its `.dockerignore` allowlist; that hasn't been re-checked with a new build. |

Lowest-coverage areas:
- `embedding.service.js`: semantic search is disabled.
- `recommendation.service.js`: the older V1 algorithm isn't used by any route.
- The AI tool functions other than search.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Startup aborted: JWT_SECRET is ...` | Put a random value of 32+ characters in `JWT_SECRET` (see the `node -e` command above). |
| `password authentication failed for user` | Check `DB_USER` / `DB_PASSWORD` in the settings file you're using (`.env`, `.env.test` or `.env.docker`). |
| `database "uniswap_db" does not exist` | Create it with `createdb` and apply `schema.sql` (see [local setup](#first-time-setup)). |
| `relation "users" does not exist` | The tables are missing: run `psql ... -f schema.sql` against the database. |
| `Refusing to run: DB_NAME must end in "_test"` | `.env.test` is missing or points at the wrong database. Copy `.env.test.example` and use `uniswap_test`. |
| `Refusing to run: DB_HOST ... is not an allowed test host` | Tests only use local databases. For another host (e.g. a Compose service), add it to `TEST_DB_ALLOWED_HOSTS` in `.env.test`. |
| `EADDRINUSE` / `port is already allocated` on 3000 | Another process (or the Docker stack) uses port 3000. Stop it, or change `PORT` / `API_PORT`. |
| `POST /categories` returns 403 | Only admins can create categories. Promote your account (see [Creating an admin account](#creating-an-admin-account)). |
| Creating a listing returns `Category does not exist` | Create categories first (`node seed-categories.js` or `POST /categories` as admin). |
| `POST /ai/chat` returns 503 | No `OPENAI_API_KEY` is configured, or OpenAI is unreachable. The rest of the API is unaffected. |
| 429 `Too many authentication attempts` | The auth limit is 20 requests per 15 minutes per IP; wait or restart the server (limits are kept in memory). |
| Browser shows a CORS error / API returns 403 `Not allowed by CORS` | Add the frontend's origin to `ALLOWED_ORIGINS`. |
| Docker: `required variable POSTGRES_DB is missing a value` | Add `--env-file .env.docker` and create the file from `.env.docker.example`. |
| Docker: `failed to connect to the docker API` | Start Docker Desktop and wait until it's running. |
| Docker: `password authentication failed` after changing `POSTGRES_PASSWORD` | The password is only set when the volume is first created. Change it back, or run `ALTER USER` inside the database. Deleting the volume would erase the data. |
| Docker: code changes not visible | Rebuild: `docker compose --env-file .env.docker up -d --build`. |

## Known limitations and future improvements

**Current limitations**
- **Sellers can't reply to messages.** `POST /messages` always sends to the listing's seller and rejects a seller messaging about their own listing, so conversations are one-way.
- **Image files can be left behind.** Deleting a listing or account removes image rows (cascade) but not the files. `scripts/reap-orphan-images.js` can clean them up; it is unreviewed, so check it before use.
- **Emails are case-sensitive**: `A@x.com` and `a@x.com` count as different accounts.
- **Rate limits are kept in memory**, so they reset on restart and aren't shared between several server instances.
- **No refresh tokens or token revocation.** Tokens are valid until they expire (1 hour).
- **No payments.** A purchase only records the transaction and marks the listing sold.
- **No migration tool.** Schema changes are applied by re-running the idempotent `schema.sql` (see [Docker](#how-the-docker-database-is-initialised)).
- **Semantic search is off.** The pgvector-based search exists in the code but is disabled; see `PGVECTOR_SETUP.md`.
- **Dependency advisories:** `npm audit` reports known issues in `multer`, `proxy-addr` and `ip-address` (patch updates are available) and in dev-only Jest dependencies.

**Possible improvements**
- Fix the messaging receiver logic so sellers can reply.
- Delete image files when listings are deleted, or run the orphan cleanup on a schedule.
- Normalise emails to lowercase with a unique index on `LOWER(email)`.
- Add a migration tool (e.g. node-pg-migrate) instead of re-running `schema.sql`.
- Apply the patch-level dependency updates and add automated dependency checks to CI.
- Review, then either port into `tests/` or remove, the legacy root scripts.
