/**
 * ============================================================
 * CACHE SERVICE - Advanced Worker Finder v3.0.0
 * In-memory caching with TTL using node-cache
 * ============================================================
 */

const NodeCache = require('node-cache');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    // Main cache: 5 min TTL, check every 2 min
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

    // Short TTL cache for frequently changing data (60s)
    this.shortCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

    // Long TTL cache for static data (30 min)
    this.longCache = new NodeCache({ stdTTL: 1800, checkperiod: 300 });

    this.stats = { hits: 0, misses: 0, sets: 0 };

    this.cache.on('expired', (key) => {
      logger.debug(`Cache key expired: ${key}`);
    });
  }

  // ─── Core Get/Set ─────────────────────────────────────────
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }

  set(key, value, ttl = null) {
    this.stats.sets++;
    if (ttl) return this.cache.set(key, value, ttl);
    return this.cache.set(key, value);
  }

  del(key) {
    return this.cache.del(key);
  }

  // ─── Short / Long TTL ────────────────────────────────────
  getShort(key) {
    return this.shortCache.get(key) !== undefined ? this.shortCache.get(key) : null;
  }

  setShort(key, value, ttl = 60) {
    return this.shortCache.set(key, value, ttl);
  }

  getLong(key) {
    return this.longCache.get(key) !== undefined ? this.longCache.get(key) : null;
  }

  setLong(key, value, ttl = 1800) {
    return this.longCache.set(key, value, ttl);
  }

  // ─── Pattern Delete ───────────────────────────────────────
  delPattern(pattern) {
    const allKeys = [
      ...this.cache.keys(),
      ...this.shortCache.keys(),
      ...this.longCache.keys()
    ];
    let deleted = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));
    allKeys.forEach(key => {
      if (regex.test(key)) {
        this.cache.del(key);
        this.shortCache.del(key);
        this.longCache.del(key);
        deleted++;
      }
    });
    return deleted;
  }

  // ─── Cache-Aside Helper ───────────────────────────────────
  async getOrSet(key, fetchFn, ttl = 300) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const value = await fetchFn();
    if (value !== null && value !== undefined) {
      this.set(key, value, ttl);
    }
    return value;
  }

  // ─── Cache Keys (Namespaced) ─────────────────────────────
  keys = {
    workers: (page, filters) => `workers:list:${page}:${JSON.stringify(filters)}`,
    worker: (id) => `worker:${id}`,
    workerStats: (id) => `worker:stats:${id}`,
    categories: () => `categories:all`,
    jobs: (page, filters) => `jobs:list:${page}:${JSON.stringify(filters)}`,
    job: (id) => `job:${id}`,
    seeker: (id) => `seeker:${id}`,
    seekerStats: (id) => `seeker:stats:${id}`,
    reviews: (userId, page) => `reviews:${userId}:${page}`,
    aiPricing: (category, city) => `ai:pricing:${category}:${city}`,
    searchIntent: (query) => `ai:intent:${query}`,
    adminStats: () => `admin:dashboard:stats`
  };

  // ─── Invalidation Helpers ─────────────────────────────────
  invalidateWorker(workerId) {
    this.del(this.keys.worker(workerId));
    this.del(this.keys.workerStats(workerId));
    this.delPattern(`workers:list:*`);
    logger.debug(`Cache invalidated for worker ${workerId}`);
  }

  invalidateJob(jobId) {
    this.del(this.keys.job(jobId));
    this.delPattern(`jobs:list:*`);
  }

  invalidateCategories() {
    this.del(this.keys.categories());
  }

  // ─── Stats ────────────────────────────────────────────────
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hit_rate: total > 0 ? Math.round((this.stats.hits / total) * 100) + '%' : '0%',
      keys_in_cache: this.cache.keys().length + this.shortCache.keys().length + this.longCache.keys().length
    };
  }

  flushAll() {
    this.cache.flushAll();
    this.shortCache.flushAll();
    this.longCache.flushAll();
    logger.info('All caches flushed');
  }
}

module.exports = new CacheService();
