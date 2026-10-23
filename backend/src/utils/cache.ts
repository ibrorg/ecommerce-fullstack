/**
 * Optional Redis Cache Layer
 * ==========================
 *
 * Provides a cache-aside pattern that gracefully degrades when Redis is
 * unavailable. If REDIS_URL is not set, all cache operations are no-ops
 * (return null / do nothing). This lets the app run without Redis in
 * development while using it in production.
 *
 * Usage:
 *   import { cacheGet, cacheSet, cacheDel } from '../utils/cache';
 *   const cached = await cacheGet('product:123');
 *   if (cached) return JSON.parse(cached);
 *   const data = await fetchFromDB();
 *   await cacheSet('product:123', JSON.stringify(data), 300); // 5 min TTL
 */

let redisClient: any = null;
let redisAvailable = false;

// Lazily initialize Redis only if REDIS_URL is set
async function getRedisClient() {
  if (redisClient !== null) return redisClient;
  if (!process.env.REDIS_URL) return null;

  try {
    // dynamic require — redis is an optional dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('redis');
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err: Error) => {
      console.warn('Redis error (cache disabled):', err.message);
      redisAvailable = false;
    });
    redisClient.on('connect', () => {
      redisAvailable = true;
    });
    await redisClient.connect();
    redisAvailable = true;
    return redisClient;
  } catch (err) {
    console.warn('Redis not available (cache disabled):', (err as Error).message);
    redisAvailable = false;
    return null;
  }
}

/**
 * Get a value from the cache. Returns null if Redis is not available
 * or the key doesn't exist.
 */
export async function cacheGet(key: string): Promise<string | null> {
  if (!process.env.REDIS_URL) return null;
  try {
    const client = await getRedisClient();
    if (!client || !redisAvailable) return null;
    return await client.get(key);
  } catch {
    return null;
  }
}

/**
 * Set a value in the cache with a TTL (in seconds).
 * No-op if Redis is not available.
 */
export async function cacheSet(key: string, value: string, ttlSeconds: number = 300): Promise<void> {
  if (!process.env.REDIS_URL) return;
  try {
    const client = await getRedisClient();
    if (!client || !redisAvailable) return;
    await client.set(key, value, { EX: ttlSeconds });
  } catch {
    // silently fail — cache is best-effort
  }
}

/**
 * Delete a key from the cache. No-op if Redis is not available.
 */
export async function cacheDel(key: string): Promise<void> {
  if (!process.env.REDIS_URL) return;
  try {
    const client = await getRedisClient();
    if (!client || !redisAvailable) return;
    await client.del(key);
  } catch {
    // silently fail
  }
}

/**
 * Delete all keys matching a pattern (e.g., 'product:*').
 * No-op if Redis is not available.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!process.env.REDIS_URL) return;
  try {
    const client = await getRedisClient();
    if (!client || !redisAvailable) return;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch {
    // silently fail
  }
}

/**
 * Check if Redis is connected and available.
 */
export function isCacheAvailable(): boolean {
  return redisAvailable;
}
