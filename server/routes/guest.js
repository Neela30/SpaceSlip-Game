import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireRedisReady } from '../middleware/redisReady.js';
import { LEADERBOARD_KEY, userKey } from '../utils/keys.js';
import { fetchLeaderboard, normalizeUsername, pruneGuestEntries } from '../utils/leaderboard.js';

const GUEST_ID_PATTERN = /^guest[0-9]{3,8}$/i;
const GUEST_ID_ATTEMPTS = 30;

const sanitizeGuestId = (value = '') => {
  const trimmed = value.toString().trim();
  if (!GUEST_ID_PATTERN.test(trimmed)) return null;
  return trimmed.toLowerCase();
};

const buildGuestUserId = (guestId) => `guest:${normalizeUsername(guestId)}`;

const randomGuestId = () => {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `guest${String(num).padStart(6, '0')}`;
};

const allocateGuestId = async (redis, preferred) => {
  const currentTop = await fetchLeaderboard(redis, 50, { excludeSeeds: true });
  const blocked = new Set(currentTop.map((row) => normalizeUsername(row.username)).filter(Boolean));

  const normalizedPreferred = preferred ? normalizeUsername(preferred) : null;
  if (normalizedPreferred && !blocked.has(normalizedPreferred)) {
    return normalizedPreferred;
  }

  for (let i = 0; i < GUEST_ID_ATTEMPTS; i++) {
    const candidate = normalizeUsername(randomGuestId());
    if (!blocked.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to allocate guest id');
};

const createGuestRouter = ({ redis, config }) => {
  const router = express.Router();
  const guestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  });

  router.use(guestLimiter);
  router.use(requireRedisReady(redis));

  router.post('/id', async (req, res) => {
    try {
      const { currentId } = req.body || {};
      const preferred = sanitizeGuestId(currentId);
      const guestId = await allocateGuestId(redis, preferred);
      return res.json({ guestId });
    } catch (error) {
      console.error('guest/id error', error);
      return res.status(500).json({ error: 'Unable to allocate guest id' });
    }
  });

  router.post('/score', async (req, res) => {
    try {
      const { guestId: rawGuestId, score } = req.body || {};
      const guestId = sanitizeGuestId(rawGuestId);

      if (!guestId) {
        return res.status(400).json({ error: 'Invalid guest id' });
      }

      const parsedScore = Number(score);
      const maxScore = Number.isFinite(config.maxScore) ? config.maxScore : 1000000;
      if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > maxScore) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      const userId = buildGuestUserId(guestId);
      const existing = await redis.hgetall(userKey(userId));
      const bestScore = Math.max(Number(existing.bestScore || 0), parsedScore);

      await redis
        .multi()
        .hset(userKey(userId), {
          username: guestId,
          bestScore,
          isGuest: 'true'
        })
        .zadd(LEADERBOARD_KEY, bestScore, userId)
        .exec();

      const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
      const inTop50 = rank != null && rank < 50;

      if (!inTop50) {
        await redis
          .multi()
          .zrem(LEADERBOARD_KEY, userId)
          .del(userKey(userId))
          .exec();
      }

      await pruneGuestEntries(redis, 50);

      const leaderboardTop5 = await fetchLeaderboard(redis, 5, { excludeSeeds: true });
      const leaderboardTop50 = inTop50
        ? await fetchLeaderboard(redis, 50, { excludeSeeds: true })
        : undefined;

      return res.json({
        guestId,
        bestScore,
        inTop50,
        leaderboardTop5,
        leaderboardTop50
      });
    } catch (error) {
      console.error('guest/score error', error);
      return res.status(500).json({ error: 'Unable to submit guest score' });
    }
  });

  return router;
};

export default createGuestRouter;
