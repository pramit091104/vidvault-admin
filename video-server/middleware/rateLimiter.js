import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';

// In-memory cache for rate limiting (fallback when Redis is not available)
const cache = new NodeCache({ stdTTL: 900 }); // 15 minutes TTL

// Redis client (optional, will fallback to in-memory if not available)
let redisClient = null;

// Try to initialize Redis if available
(async () => {
  try {
    if (process.env.REDIS_URL) {
      const { default: Redis } = await import('ioredis');
      const client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 0,
        enableReadyCheck: false,
        retryStrategy: () => null,
        lazyConnect: true
      });

      client.on('error', (err) => {
        console.warn('⚠️ Redis connection error (rate limiting uses in-memory):', err.message);
        redisClient = null;
      });

      client.on('connect', () => {
        console.log('✅ Redis connected for rate limiting');
      });

      try {
        await client.connect();
        redisClient = client;
      } catch (connectError) {
        console.warn('⚠️ Redis not available, using in-memory rate limiting');
      }
    }
  } catch (error) {
    console.warn('⚠️ Redis initialization failed, using in-memory rate limiting:', error.message);
  }
})();

// Custom store for rate limiting
class CustomRateLimitStore {
  constructor(prefix = 'rl') {
    this.hits = new Map();
    this.prefix = prefix;
  }

  async increment(key) {
    const prefixedKey = `${this.prefix}:${key}`;
    const now = Date.now();
    const windowStart = now - (15 * 60 * 1000); // 15 minutes window

    if (redisClient) {
      try {
        const multi = redisClient.multi();
        multi.zadd(prefixedKey, now, now);
        multi.zremrangebyscore(prefixedKey, 0, windowStart);
        multi.zcard(prefixedKey);
        multi.expire(prefixedKey, 900); // 15 minutes

        const results = await multi.exec();
        const count = results[2][1];

        return {
          totalHits: count,
          timeToExpire: new Date(now + (15 * 60 * 1000))
        };
      } catch (error) {
        console.warn('Redis error, falling back to memory:', error.message);
      }
    }

    // Fallback to in-memory
    let hits = this.hits.get(prefixedKey) || [];
    hits = hits.filter(timestamp => timestamp > windowStart);
    hits.push(now);
    this.hits.set(prefixedKey, hits);

    return {
      totalHits: hits.length,
      timeToExpire: new Date(now + (15 * 60 * 1000))
    };
  }

  async decrement(key) {
    // Not implemented for this use case
  }

  async resetKey(key) {
    const prefixedKey = `${this.prefix}:${key}`;
    if (redisClient) {
      try {
        await redisClient.del(prefixedKey);
        return;
      } catch (error) {
        console.warn('Redis error during reset:', error.message);
      }
    }

    this.hits.delete(prefixedKey);
  }
}

// Rate limiting configurations
export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later.',
    standardHeaders = true,
    legacyHeaders = false,
    prefix = 'common',
    ...otherOptions
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders,
    legacyHeaders,
    store: new CustomRateLimitStore(prefix),
    keyGenerator: (req) => {
      // Use IP + User-Agent for better identification
      return `${req.ip}:${req.get('User-Agent') || 'unknown'}`;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    },
    ...otherOptions
  });
};

// Specific rate limiters for different endpoints
export const generalLimiter = createRateLimiter({
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please slow down.',
  prefix: 'general',
  skip: (req) => {
    // Skip health checks
    if (req.path === '/health' || req.path === '/api/health') return true;

    // Skip paths that have their own specific limiters to avoid collision and double-counting
    const specificPaths = [
      '/api/upload',
      '/api/gcs',
      '/api/payment',
      '/api/razorpay',
      '/api/notifications/comment',
      '/api/subscription'
    ];

    return specificPaths.some(path => req.originalUrl.startsWith(path));
  }
});

export const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Upload limit exceeded. Please wait before uploading more files.',
  prefix: 'upload'
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  prefix: 'auth'
});

export const commentLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 comments per minute
  message: 'Too many comments, please slow down.',
  prefix: 'comment'
});

export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 API calls per 15 minutes
  message: 'API rate limit exceeded, please try again later.',
  prefix: 'api'
});

// Strict limiter for expensive operations
export const strictLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Rate limit exceeded for this operation.',
  prefix: 'strict'
});