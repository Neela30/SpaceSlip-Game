import jwt from 'jsonwebtoken';
import { userKey } from '../utils/keys.js';

export const authMiddleware = (redis, jwtSecret) => {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await redis.hgetall(userKey(userId));
      if (!user || !user.username) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      req.user = {
        userId,
        username: user.username,
        bestScore: Number(user.bestScore || 0)
      };
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
};
