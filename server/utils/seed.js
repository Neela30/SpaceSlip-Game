import { LEADERBOARD_KEY, USERNAME_TO_ID_KEY, userKey } from './keys.js';

const BLOCKED_USERNAMES = ['Orion', 'Nova', 'Lumen', 'Comet', 'Eclipse', 'testuser123'];

export const seedLeaderboard = async (redis) => {
  const removed = [];
  const multi = redis.multi();

  for (const name of BLOCKED_USERNAMES) {
    const normalized = name.toLowerCase();
    const userId = await redis.hget(USERNAME_TO_ID_KEY, normalized);
    if (!userId) continue;
    removed.push(name);
    multi.hdel(USERNAME_TO_ID_KEY, normalized);
    multi.del(userKey(userId));
    multi.zrem(LEADERBOARD_KEY, userId);
  }

  if (!removed.length) {
    console.log('[seed] No sample or blocked leaderboard entries to remove');
    return;
  }

  await multi.exec();
  console.log(`[seed] Removed ${removed.length} blocked leaderboard entries: ${removed.join(', ')}`);
};
