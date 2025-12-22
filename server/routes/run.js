import crypto from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth.js';
import { LEADERBOARD_KEY, runKey, userKey } from '../utils/keys.js';
import { fetchLeaderboard } from '../utils/leaderboard.js';
import { requireRedisReady } from '../middleware/redisReady.js';

const RUN_TTL_SECONDS = 60 * 5;
const MIN_RUN_DURATION_MS = 1000;

const signRun = ({ runId, userId, expiresAt, nonce, secret }) => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${runId}:${userId}:${expiresAt}:${nonce}`);
  return hmac.digest('hex');
};

const createRunRouter = ({ redis, config }) => {
  const router = express.Router();

  const runLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false
  });

  router.use(runLimiter);
  router.use(requireRedisReady(redis));
  router.use(authMiddleware(redis, config.jwtSecret));

  router.post('/start', async (req, res) => {
    try {
      const runId = crypto.randomUUID();
      const nonce = crypto.randomBytes(16).toString('hex');
      const startedAt = Date.now();
      const expiresAt = startedAt + RUN_TTL_SECONDS * 1000;

      const signature = signRun({
        runId,
        userId: req.user.userId,
        expiresAt,
        nonce,
        secret: config.runSecret
      });

      const key = runKey(runId);
      await redis
        .multi()
        .hset(key, {
          userId: req.user.userId,
          startedAt,
          expiresAt,
          nonce
        })
        .expire(key, RUN_TTL_SECONDS)
        .exec();

      return res.json({ runId, expiresAt, signature });
    } catch (error) {
      console.error('run/start error', error);
      return res.status(500).json({ error: 'Unable to start run' });
    }
  });

  router.post('/finish', async (req, res) => {
    try {
      const { runId, score, signature } = req.body || {};
      if (!runId || typeof signature !== 'string') {
        return res.status(400).json({ error: 'Missing run information' });
      }

      const parsedScore = Number(score);
      const maxScore = Number.isFinite(config.maxScore) ? config.maxScore : 1000000;

      if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > maxScore) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      const key = runKey(runId);
      const runData = await redis.hgetall(key);
      if (!runData || !runData.userId) {
        return res.status(400).json({ error: 'Run not found or expired' });
      }

      if (runData.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Run does not belong to user' });
      }

      const expiresAt = Number(runData.expiresAt || 0);
      const nonce = runData.nonce;
      const expectedSignature = signRun({
        runId,
        userId: req.user.userId,
        expiresAt,
        nonce,
        secret: config.runSecret
      });

      if (expectedSignature !== signature) {
        return res.status(400).json({ error: 'Invalid signature' });
      }

      if (!nonce || Number.isNaN(expiresAt) || Date.now() > expiresAt) {
        return res.status(400).json({ error: 'Run expired' });
      }

      const startedAt = Number(runData.startedAt || 0);
      if (startedAt && Date.now() - startedAt < MIN_RUN_DURATION_MS) {
        return res.status(400).json({ error: 'Run duration too short' });
      }

      // prevent replay
      await redis.del(key);

      const userData = await redis.hgetall(userKey(req.user.userId));
      const currentBest = Number(userData.bestScore || 0);
      const newBest = Math.max(currentBest, parsedScore);

      await redis
        .multi()
        .hset(userKey(req.user.userId), { bestScore: newBest })
        .zadd(LEADERBOARD_KEY, newBest, req.user.userId)
        .exec();

      const leaderboardTop5 = await fetchLeaderboard(redis, 5, { excludeSeeds: true });

      return res.json({
        bestScore: newBest,
        leaderboardTop5
      });
    } catch (error) {
      console.error('run/finish error', error);
      return res.status(500).json({ error: error?.message || 'Unable to finish run' });
    }
  });

  return router;
};

export default createRunRouter;
