import { LEADERBOARD_KEY, userKey } from './keys.js';

const SEED_USERNAMES = new Set(['orion', 'nova', 'lumen', 'comet', 'eclipse', 'testuser123']);
export const normalizeUsername = (value = '') => value.toString().trim().toLowerCase();
export const isGuestUserId = (value = '') => typeof value === 'string' && value.startsWith('guest:');

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
    const isGuest = isGuestUserId(entry.userId) || data.isGuest === 'true';
    return {
      username: data.username || 'Unknown',
      score: entry.score,
      isGuest
    };
  });

  const filtered = hydrated
    .filter((row) => row.score > 0)
    .filter((row) => (excludeSeeds ? !SEED_USERNAMES.has(normalizeUsername(row.username)) : true));

  return filtered.slice(0, limit).map((row, idx) => ({
    rank: idx + 1,
    username: row.username,
    score: row.score,
    isGuest: Boolean(row.isGuest)
  }));
};

export const pruneGuestEntries = async (redis, limit = 50) => {
  const overflow = await redis.zrevrange(LEADERBOARD_KEY, limit, -1);
  if (!overflow || overflow.length === 0) return { removed: 0 };

  const guestIds = overflow.filter((userId) => isGuestUserId(userId));
  if (!guestIds.length) return { removed: 0 };

  const pipeline = redis.pipeline();
  guestIds.forEach((userId) => {
    pipeline.zrem(LEADERBOARD_KEY, userId);
    pipeline.del(userKey(userId));
  });
  await pipeline.exec();

  return { removed: guestIds.length };
};
