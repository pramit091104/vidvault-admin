import NodeCache from 'node-cache';

// Multi-layer caching system
class CacheManager {
  constructor() {
    // Different cache instances for different data types with unified 3-minute TTL
    this.subscriptionCache = new NodeCache({
      stdTTL: 180, // 3 minutes for subscription data (unified TTL)
      checkperiod: 60
    });

    this.signedUrlCache = new NodeCache({
      stdTTL: 180, // 3 minutes for signed URLs (unified TTL)
      checkperiod: 60
    });

    this.clientCountCache = new NodeCache({
      stdTTL: 180, // 3 minutes for client counts (unified TTL)
      checkperiod: 60
    });

    this.videoMetadataCache = new NodeCache({
      stdTTL: 180, // 3 minutes for video metadata (unified TTL)
      checkperiod: 60
    });

    // Redis client (optional)
    this.redisClient = null;
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        const { default: Redis } = await import('ioredis');
        this.redisClient = new Redis(process.env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 0, // Don't retry requests
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 100, 3000);
          }
        });

        // Add error handlers to prevent crash and log spam
        this.redisClient.on('error', (err) => {
          if (err.message.includes('ECONNREFUSED')) {
            console.warn('⚠️ Redis not available (ECONNREFUSED) - caching disabled');
          } else {
            console.warn('⚠️ Redis connection error (caching disabled):', err.message);
          }
          if (this.redisClient.status !== 'ready') {
            this.redisClient = null;
          }
        });

        this.redisClient.on('connect', () => {
          console.log('✅ Redis connected for caching');
        });

        this.redisClient.on('ready', () => {
          console.log('✅ Redis ready for caching');
        });

        // Try to connect
        try {
          await this.redisClient.connect();
        } catch (connectError) {
          console.warn('⚠️ Redis not available, using in-memory caching only');
          this.redisClient = null;
        }
      }
    } catch (error) {
      console.warn('⚠️ Redis initialization failed, using in-memory caching only:', error.message);
      this.redisClient = null;
    }
  }

  // Generic cache operations
  async get(cacheType, key) {
    try {
      const cache = this.getCacheInstance(cacheType);

      // Check memory cache first
      let data = cache.get(key);
      if (data) {
        return data;
      }

      // Check Redis if available
      if (this.redisClient) {
        try {
          const redisKey = `${cacheType}:${key}`;
          const redisData = await this.redisClient.get(redisKey);
          if (redisData) {
            data = JSON.parse(redisData);
            // Update memory cache
            cache.set(key, data);
            return data;
          }
        } catch (redisError) {
          console.warn(`Redis cache read failed for ${cacheType}:`, redisError.message);
        }
      }

      return null;
    } catch (error) {
      console.error(`Cache get error for ${cacheType}:`, error);
      return null;
    }
  }

  async set(cacheType, key, data, ttl) {
    try {
      const cache = this.getCacheInstance(cacheType);

      // Set in memory cache
      if (ttl) {
        cache.set(key, data, ttl);
      } else {
        cache.set(key, data);
      }

      // Set in Redis if available
      if (this.redisClient) {
        try {
          const redisKey = `${cacheType}:${key}`;
          const cacheTtl = ttl || this.getDefaultTTL(cacheType);
          await this.redisClient.setex(redisKey, cacheTtl, JSON.stringify(data));
        } catch (redisError) {
          console.warn(`Redis cache write failed for ${cacheType}:`, redisError.message);
        }
      }
    } catch (error) {
      console.error(`Cache set error for ${cacheType}:`, error);
    }
  }

  async delete(cacheType, key) {
    try {
      const cache = this.getCacheInstance(cacheType);

      // Delete from memory cache
      cache.del(key);

      // Delete from Redis if available
      if (this.redisClient) {
        try {
          const redisKey = `${cacheType}:${key}`;
          await this.redisClient.del(redisKey);
        } catch (redisError) {
          console.warn(`Redis cache delete failed for ${cacheType}:`, redisError.message);
        }
      }
    } catch (error) {
      console.error(`Cache delete error for ${cacheType}:`, error);
    }
  }

  async invalidatePattern(cacheType, pattern) {
    try {
      const cache = this.getCacheInstance(cacheType);

      // Invalidate memory cache
      const keys = cache.keys();
      const matchingKeys = keys.filter(key => key.includes(pattern));
      for (const key of matchingKeys) {
        cache.del(key);
      }

      // Invalidate Redis cache if available
      if (this.redisClient) {
        try {
          const redisPattern = `${cacheType}:*${pattern}*`;
          const redisKeys = await this.redisClient.keys(redisPattern);
          if (redisKeys.length > 0) {
            await this.redisClient.del(...redisKeys);
          }
        } catch (redisError) {
          console.warn(`Redis pattern invalidation failed for ${cacheType}:`, redisError.message);
        }
      }
    } catch (error) {
      console.error(`Cache pattern invalidation error for ${cacheType}:`, error);
    }
  }

  getCacheInstance(cacheType) {
    switch (cacheType) {
      case 'subscription':
        return this.subscriptionCache;
      case 'signedUrl':
        return this.signedUrlCache;
      case 'clientCount':
        return this.clientCountCache;
      case 'videoMetadata':
        return this.videoMetadataCache;
      default:
        throw new Error(`Unknown cache type: ${cacheType}`);
    }
  }

  getDefaultTTL(cacheType) {
    // Use unified 3-minute TTL for consistency across frontend and backend
    return 180; // 3 minutes in seconds (unified TTL)
  }

  // Specific cache methods for common operations with unified TTL
  async getSubscription(userId) {
    return this.get('subscription', userId);
  }

  async setSubscription(userId, subscriptionData, ttl = 180) { // 3 minutes unified TTL
    return this.set('subscription', userId, subscriptionData, ttl);
  }

  async invalidateUserSubscription(userId) {
    return this.delete('subscription', userId);
  }

  async getSignedUrl(videoId) {
    return this.get('signedUrl', videoId);
  }

  async setSignedUrl(videoId, urlData, ttl = 180) { // 3 minutes unified TTL
    return this.set('signedUrl', videoId, urlData, ttl);
  }

  async getClientCount(userId) {
    return this.get('clientCount', userId);
  }

  async setClientCount(userId, count, ttl = 180) { // 3 minutes unified TTL
    return this.set('clientCount', userId, count, ttl);
  }

  async invalidateUserClientCount(userId) {
    return this.delete('clientCount', userId);
  }

  async getVideoMetadata(videoId) {
    return this.get('videoMetadata', videoId);
  }

  async setVideoMetadata(videoId, metadata, ttl = 180) { // 3 minutes unified TTL
    return this.set('videoMetadata', videoId, metadata, ttl);
  }

  // Cache statistics
  getStats() {
    return {
      subscription: this.subscriptionCache.getStats(),
      signedUrl: this.signedUrlCache.getStats(),
      clientCount: this.clientCountCache.getStats(),
      videoMetadata: this.videoMetadataCache.getStats()
    };
  }

  // Clear all caches
  async clearAll() {
    this.subscriptionCache.flushAll();
    this.signedUrlCache.flushAll();
    this.clientCountCache.flushAll();
    this.videoMetadataCache.flushAll();

    if (this.redisClient) {
      try {
        const patterns = ['subscription:*', 'signedUrl:*', 'clientCount:*', 'videoMetadata:*'];
        for (const pattern of patterns) {
          const keys = await this.redisClient.keys(pattern);
          if (keys.length > 0) {
            await this.redisClient.del(...keys);
          }
        }
      } catch (redisError) {
        console.warn('Redis cache clear failed:', redisError.message);
      }
    }
  }
}

// Create singleton instance
export const cacheManager = new CacheManager();

export default cacheManager;