import express from 'express';
import { fetchLeaderboard } from '../utils/leaderboard.js';
import { requireRedisReady } from '../middleware/redisReady.js';

const createLeaderboardRouter = ({ redis }) => {
  const router = express.Router();

  router.use(requireRedisReady(redis));

  router.get('/top5', async (req, res) => {
    try {
      const rows = await fetchLeaderboard(redis, 5, { excludeSeeds: true });
      return res.json({ entries: rows });
    } catch (error) {
      console.error('leaderboard/top5 error', error);
      return res.status(500).json({ error: 'Unable to load leaderboard' });
    }
  });

  router.get('/top50', async (req, res) => {
    try {
      const rows = await fetchLeaderboard(redis, 50, { excludeSeeds: true });
      return res.json({ entries: rows });
    } catch (error) {
      console.error('leaderboard/top50 error', error);
      return res.status(500).json({ error: 'Unable to load leaderboard' });
    }
  });

  return router;
};

export default createLeaderboardRouter;
