import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { USERNAME_TO_ID_KEY, userKey, LEADERBOARD_KEY } from '../utils/keys.js';
import { requireRedisReady } from '../middleware/redisReady.js';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const PASSWORD_MIN_LENGTH = 5;

const normalizeUsername = (value = '') => value.trim().toLowerCase();

const createToken = (userId, jwtSecret) =>
  jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' });

const validateUsername = (username) => {
  if (typeof username !== 'string') return false;
  const trimmed = username.trim();
  return trimmed.length >= USERNAME_MIN_LENGTH && trimmed.length <= USERNAME_MAX_LENGTH;
};

const validateRegisterPassword = (password) =>
  typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH;

const validateLoginPassword = (password) => typeof password === 'string' && password.length > 0;

const createAuthRouter = ({ redis, config }) => {
  const router = express.Router();
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  });

  router.use(authLimiter);
  router.use(requireRedisReady(redis));

  router.post('/register', async (req, res) => {
    try {
      const { username, password, confirmPassword } = req.body || {};

      if (!validateUsername(username)) {
        return res.status(400).json({ error: 'Username must be 3-20 characters' });
      }
      if (!validateRegisterPassword(password)) {
        return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
      }

      const normalized = normalizeUsername(username);
      const existingId = await redis.hget(USERNAME_TO_ID_KEY, normalized);
      if (existingId) {
        return res.status(409).json({ error: 'Username already taken' });
      }

      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);
      const createdAt = new Date().toISOString();

      await redis
        .multi()
        .hset(userKey(userId), {
          username: username.trim(),
          passwordHash,
          bestScore: 0,
          createdAt
        })
        .hset(USERNAME_TO_ID_KEY, normalized, userId)
        .zadd(LEADERBOARD_KEY, 0, userId)
        .exec();

      const token = createToken(userId, config.jwtSecret);
      return res.json({
        token,
        user: { username: username.trim(), bestScore: 0 }
      });
    } catch (error) {
      console.error('auth/register error', error);
      return res.status(500).json({ error: error?.message || 'Unable to register' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};

      if (!validateUsername(username) || !validateLoginPassword(password)) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }

      const normalized = normalizeUsername(username);
      const userId = await redis.hget(USERNAME_TO_ID_KEY, normalized);
      if (!userId) {
        return res.status(401).json({ error: 'User not found. Please register first.' });
      }

      const user = await redis.hgetall(userKey(userId));
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = createToken(userId, config.jwtSecret);
      const bestScore = Number(user.bestScore || 0);

      return res.json({
        token,
        user: { username: user.username, bestScore }
      });
    } catch (error) {
      console.error('auth/login error', error);
      return res.status(500).json({ error: error?.message || 'Unable to login' });
    }
  });

  return router;
};

export default createAuthRouter;
