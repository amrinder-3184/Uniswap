# UniSwap Frontend

React single-page app for **UniSwap**, a campus marketplace where students buy and sell second-hand items such as textbooks, notes, furniture and electronics.

This folder is the frontend part of the UniSwap repository (https://github.com/amrinder-3184/Uniswap). It talks over HTTP to the UniSwap REST API, which lives at the repository root; see the [main README](../README.md). The two are installed and run separately, each with its own `package.json`.

## Features

| Page | Path | Login needed |
|---|---|---|
| Home: welcome, plus personalised recommendations when logged in | `/` | for recommendations |
| Browse and search: keyword search, category filter, sorting, pagination | `/browse` | no |
| Listing detail: images, buy, favorite, similar listings; image upload and delete for the seller | `/listings/:id` | for actions |
| Sell: create a listing | `/create-listing` | yes |
| My Listings: edit price, delete | `/my-listings` | yes |
| Favorites | `/favorites` | yes |
| Messages: conversations with sellers | `/messages` | yes |
| Transactions: purchases and sales | `/transactions` | yes |
| AI assistant: chat widget on every page (needs an OpenAI key on the backend) | – | yes |

Login and registration are in the navbar. Prices are shown in Indian Rupees (₹).

## Technology

- React 19 with Vite 8
- Plain CSS per component (no UI library)
- Native `fetch` for API calls; the JWT from login is kept in `localStorage`
- Oxlint for linting; Node's built-in test runner for unit tests

## Prerequisites

- Node.js 24 and npm
- The UniSwap backend running locally. By default it is expected at `http://localhost:3000`; see the [main README](../README.md) for backend setup (local Node.js + PostgreSQL, or Docker Compose).

## Getting started

Start from the repository root. The first command moves into `frontend/`, and everything after it runs there.

```powershell
# 1. From the repository root, go to the frontend and install its dependencies
#    (exact versions from frontend/package-lock.json)
cd frontend
npm ci

# 2. Optional: configure the backend URL (defaults to http://localhost:3000)
copy .env.example .env

# 3. Start the dev server
npm run dev
```

Open **http://localhost:5173**.

The backend only accepts browser requests from the origins in its `ALLOWED_ORIGINS` setting, and that defaults to `http://localhost:5173`, the Vite dev server. If you use another port, or `npm run preview` (port 4173), add that origin to the backend's `ALLOWED_ORIGINS`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the UniSwap backend API |

Put it in `frontend/.env`, which is git-ignored; `frontend/.env.example` is the template. This file is separate from the backend's `.env` in the repository root.

Vite builds `VITE_*` variables into the JavaScript bundle, so they are public. Never put secrets in them. The frontend needs no secrets; authentication uses the token returned by the backend at login.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server with hot reload (port 5173) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally (port 4173) |
| `npm run lint` | Run Oxlint |
| `npm test` | Run unit tests (`tests/*.test.js`) with Node's built-in test runner |

CI (`.github/workflows/ci.yml` in the repository root) runs `npm ci`, `npm run lint`, `npm test` and `npm run build` in this folder on every push and pull request.

## Project structure

```
frontend/
├── index.html               # HTML entry point
├── vite.config.js
├── public/                  # Static files (favicon, icons)
├── src/
│   ├── main.jsx             # React entry point
│   ├── App.jsx              # Picks the page component from the URL path
│   ├── components/          # One folder per page/widget (component + CSS)
│   └── utils/
│       ├── formatCurrency.js    # INR formatting
│       └── listingHelpers.js    # API response helpers, browse query building
└── tests/                   # Unit tests for src/utils
```

## Deployment notes

`npm run build` produces static files in `frontend/dist/`. The backend does not serve them, so they are deployed separately to any static host.
- **Set `VITE_API_URL` at build time** to the deployed backend URL, and add the frontend's origin to the backend's `ALLOWED_ORIGINS`.
- **Configure the host to serve `index.html` for every path** (an "SPA fallback"). Pages are chosen from the URL path in the browser, so direct links like `/listings/5` or `/browse` would otherwise return 404.

## Known limitations

- **Sellers cannot reply to buyers in Messages.** The backend currently sends every message to the listing's seller; this has to be fixed in the backend.
- **Browse results show no thumbnails**, because `GET /listings` returns no image data. Images appear on the listing detail page.
- **Page changes are full page loads.** Navigation uses plain links and there is no client-side router.
- **The login token is stored in `localStorage`**, which is readable by any script running on the page.
