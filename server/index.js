import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import path from 'path';
import { fileURLToPath } from 'url';

import createAuthRouter from './routes/auth.js';
import createRunRouter from './routes/run.js';
import createLeaderboardRouter from './routes/leaderboard.js';
import createGuestRouter from './routes/guest.js';
import { authMiddleware } from './middleware/auth.js';
import { seedLeaderboard } from './utils/seed.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET = process.env.JWT_SECRET;
const RUN_SECRET = process.env.RUN_SECRET;

if (!JWT_SECRET || !RUN_SECRET) {
  console.error('Missing required environment variables: JWT_SECRET and RUN_SECRET');
  process.exit(1);
}

const redis = new Redis(REDIS_URL);
redis.on('error', (err) => console.error('[redis] error', err));
redis.on('connect', () => console.log('[redis] connected'));
redis.once('ready', () => {
  seedLeaderboard(redis).catch((err) => console.error('[seed] error', err));
});

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true
  })
);

app.use(express.json({ limit: '1mb' }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

const config = {
  jwtSecret: JWT_SECRET,
  runSecret: RUN_SECRET,
  maxScore: Number(process.env.MAX_SCORE || 1000000)
};

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/me', authMiddleware(redis, config.jwtSecret), async (req, res) => {
  return res.json({
    username: req.user.username,
    bestScore: req.user.bestScore
  });
});

app.use('/api/auth', createAuthRouter({ redis, config }));
app.use('/api/run', createRunRouter({ redis, config }));
app.use('/api/leaderboard', createLeaderboardRouter({ redis }));
app.use('/api/guest', createGuestRouter({ redis, config }));

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
