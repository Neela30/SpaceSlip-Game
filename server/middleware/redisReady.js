export const requireRedisReady = (redis) => (req, res, next) => {
  if (!redis || redis.status !== 'ready') {
    return res.status(503).json({ error: 'Storage unavailable (Redis not connected)' });
  }
  next();
};
