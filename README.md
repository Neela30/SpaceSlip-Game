# SpaceSlip — Gap Runner with Leaderboards

SpaceSlip is a fast, canvas-driven arcade puzzle where you rotate falling shapes to slip them through a narrowing gap, dodge alien fire, and chase streaks of perfect passes. It ships with a full-stack setup: React + Vite on the client, an Express/Redis API for auth, signed run submissions, and live leaderboards for registered users and guests.

## What’s inside
- **Arcade loop:** Rotate/nudge shapes, thread the moving gap, collect golden star rewards to slow time/widen the gap, and survive alien volleys that chip your score or end the run (`src/useGameLogic.js`, `src/game/*`).
- **Leaderboard modes:** Registered players post signed scores; guests can claim disposable IDs and appear in the top 50 without creating an account (`server/routes/run.js`, `server/routes/guest.js`).
- **Auth & security:** JWT login/register with bcrypt, Redis-backed sessions, rate limiting, and HMAC-signed runs to deter tampering (`server/routes/auth.js`, `server/middleware/auth.js`).
- **API slices:** `/api/run` to start/finish attempts, `/api/leaderboard` for top 5/50, `/api/guest` for guest IDs and guest score posts, and `/api/me` for the current player profile (`server/index.js`).
- **Modern frontend:** React 18 with Vite, canvas rendering for the game field, mobile-friendly tap controls, sound toggle, and local persistence of best scores.

## Tech stack
- **Frontend:** React 18, Vite, Canvas 2D, fetch-based API client (`src/api/client.js`), localStorage for auth/guest cache.
- **Backend:** Node 18+, Express, Redis (ioredis), JWT, bcryptjs, express-rate-limit, HMAC run signing, Docker compose helper for Redis.
- **Build/dev:** Vite for dev server and bundling, Nodemon helper for hot API reloads.

## Getting started (local)
Prereqs: Node.js 18+, npm, and Redis (Docker compose is provided).

1) **Clone & install**
```bash
npm install
```

2) **Configure environment**
Copy `.env.example` to `.env` and set secrets:
- `REDIS_URL` (default `redis://localhost:6379`)
- `JWT_SECRET` (any strong random string)
- `RUN_SECRET` (used to sign run start/finish payloads)
- `PORT` (default `4000`)
- `CLIENT_ORIGIN` (e.g. `http://localhost:5173`)
- `MAX_SCORE` (optional upper bound for submissions)
- Frontend override: set `VITE_API_BASE_URL` if the API is not served under the same origin (defaults to relative `/api`).

3) **Start Redis**
```bash
docker-compose up -d redis
```
Or run your own Redis at the URL in `REDIS_URL`.

4) **Run the API**
```bash
npm run server      # or npm run dev:server for nodemon
# API will listen on PORT (default 4000)
```

5) **Run the client**
```bash
npm run dev
# Vite serves at http://localhost:5173 and proxies /api -> PORT by default
```

## Useful scripts
- `npm run dev` — Vite dev server for the game UI.
- `npm run server` — Start the Express API.
- `npm run dev:server` — API with nodemon reloads.
- `npm run build` — Production build of the frontend to `dist/`.
- `npm run preview` — Preview the built frontend locally.

## API at a glance
- `POST /api/auth/register` — Create account (username + password), returns JWT + profile.
- `POST /api/auth/login` — Login, returns JWT + profile.
- `GET /api/me` — Current user (requires `Authorization: Bearer <token>`).
- `POST /api/run/start` — Start a signed run session (auth required).
- `POST /api/run/finish` — Submit a score with the returned run ID + signature (auth required).
- `GET /api/leaderboard/top5` and `/top50` — Public leaderboards.
- `POST /api/guest/id` — Reserve/allocate a guest ID.
- `POST /api/guest/score` — Submit a guest score (kept only if it lands in top 50).

## Gameplay notes
- Controls: A/Left to rotate left, D/Right/Space to rotate right, Down for fast drop, P to pause, Enter to start. On mobile, tap left/right of the shape to rotate and below to boost drop.
- Hitting the wall ends the run; surviving the gate adds score and speeds things up. Perfect fits trigger a “Solar flare” ribbon and particles.
- Aliens start firing once your score is high enough; getting hit twice ends the run, and each hit can shave points.

## Folder map
- `src/` — React app, canvas renderer, game logic, styles, API client.
- `server/` — Express API, routes, middleware, Redis helpers, and leaderboard pruning.
- `public/` — Static assets served by Vite.
- `docker-compose.yml` — Convenience Redis service for local dev.

## Deploying
1) Build the client: `npm run build` (outputs to `dist/`).
2) Serve the static build (any static host) and deploy the API (Node/Express) with access to Redis and the same env vars. Set `VITE_API_BASE_URL` on the client if the API lives on a different origin.
