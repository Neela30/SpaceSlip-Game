import { LEADERBOARD_KEY, userKey } from './keys.js';

const SEED_USERNAMES = new Set(['orion', 'nova', 'lumen', 'comet', 'eclipse', 'testuser123']);
const normalizeUsername = (value = '') => value.toString().trim().toLowerCase();

export const fetchLeaderboard = async (redis, limit = 5, { excludeSeeds = true } = {}) => {
  const windowSize = excludeSeeds ? Math.max(limit, 50) : limit;
  const raw = await redis.zrevrange(
    LEADERBOARD_KEY,
    0,
    Math.max(0, windowSize - 1),
    'WITHSCORES'
  );
  const pairs = [];
  for (let i = 0; i < raw.length; i += 2) {
    pairs.push({ userId: raw[i], score: Number(raw[i + 1] || 0) });
  }

  if (!pairs.length) return [];

  const pipeline = redis.pipeline();
  pairs.forEach((entry) => {
    pipeline.hgetall(userKey(entry.userId));
  });

  const results = await pipeline.exec();

  const hydrated = pairs.map((entry, idx) => {
    const data = results?.[idx]?.[1] || {};
    return { username: data.username || 'Unknown', score: entry.score };
  });

  const filtered = hydrated
    .filter((row) => row.score > 0)
    .filter((row) => (excludeSeeds ? !SEED_USERNAMES.has(normalizeUsername(row.username)) : true));

  return filtered.slice(0, limit).map((row, idx) => ({
    rank: idx + 1,
    username: row.username,
    score: row.score
  }));
};
