# SpaceSlip Leaderboard + Auth

## Prerequisites
- Node.js 18+
- Docker (for Redis)

## Environment
Copy `.env.example` to `.env` and set:
- `REDIS_URL` (default `redis://localhost:6379`)
- `JWT_SECRET`
- `RUN_SECRET`
- `PORT` (default `4000`)
- `CLIENT_ORIGIN` (e.g. `http://localhost:5173`)
- Frontend (optional): `VITE_API_BASE_URL` if the API is hosted on a different origin (defaults to relative `/api`)

## Run locally
1. Start Redis
   ```bash
   docker-compose up -d redis
   ```
2. Install deps
   ```bash
   npm install
   ```
3. Start API
   ```bash
   npm run server
   ```
4. Start frontend (Vite)
   ```bash
   npm run dev
   ```

## API Quickstart (examples)
Replace `TOKEN` with the JWT returned from login/register.

Register:
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"pilot1","password":"secret123","confirmPassword":"secret123"}'
```

Login:
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"pilot1","password":"secret123"}'
```

Start run:
```bash
curl -X POST http://localhost:4000/api/run/start \
  -H "Authorization: Bearer TOKEN"
```

Finish run (values returned from `/api/run/start`):
```bash
curl -X POST http://localhost:4000/api/run/finish \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"runId":"<runId>","score":12,"signature":"<signature>"}'
```

Leaderboard:
```bash
curl http://localhost:4000/api/leaderboard/top5
curl http://localhost:4000/api/leaderboard/top50
```
