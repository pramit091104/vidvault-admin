import NodeCache from 'node-cache';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session storage with persistence
class PersistentSessionManager {
  constructor() {
    // In-memory cache with 24-hour TTL
    this.cache = new NodeCache({
      stdTTL: 24 * 60 * 60, // 24 hours
      checkperiod: 60 * 10 // Check for expired keys every 10 minutes
    });

    // File-based persistence directory
    this.persistDir = path.join(__dirname, '..', 'temp', 'sessions');
    this.initializePersistence();

    // Redis client (optional)
    this.redisClient = null;
    this.initializeRedis();
  }

  async initializePersistence() {
    try {
      await fs.mkdir(this.persistDir, { recursive: true });
      console.log('✅ Session persistence directory initialized');
    } catch (error) {
      console.warn('⚠️ Could not initialize session persistence:', error.message);
    }
  }

  async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        const { default: Redis } = await import('ioredis');
        this.redisClient = new Redis(process.env.REDIS_URL, {
          lazyConnect: true, // Don't connect immediately
          maxRetriesPerRequest: 0,
          retryStrategy: (times) => {
            if (times > 3) return null; // Stop retrying after 3 attempts
            return Math.min(times * 100, 3000);
          }
        });

        // SAFETY: Always attach error listener
        this.redisClient.on('error', (err) => {
          if (err.message.includes('ECONNREFUSED')) {
            console.warn('⚠️ Redis not available (ECONNREFUSED) - sessions using file storage');
          } else {
            console.warn('⚠️ Redis session error:', err.message);
          }
          if (this.redisClient.status !== 'ready') {
            this.redisClient = null;
          }
        });

        this.redisClient.on('connect', () => {
          console.log('✅ Redis connected for session management');
        });

        // Attempt connection gracefully
        try {
          await this.redisClient.connect();
        } catch (connectError) {
          console.warn('⚠️ Redis connection failed, using file-based session storage');
          this.redisClient = null;
        }
      }
    } catch (error) {
      console.warn('⚠️ Redis initialization failed, using file-based session storage:', error.message);
      this.redisClient = null;
    }
  }

  async set(sessionId, data) {
    try {
      const sessionData = {
        ...data,
        lastUpdated: new Date().toISOString()
      };

      // Store in memory cache
      this.cache.set(sessionId, sessionData);

      // Try Redis first
      if (this.redisClient) {
        try {
          await this.redisClient.setex(
            `session:${sessionId}`,
            24 * 60 * 60, // 24 hours
            JSON.stringify(sessionData)
          );
          return;
        } catch (redisError) {
          console.warn('Redis session write failed, falling back to file:', redisError.message);
        }
      }

      // Fallback to file persistence
      const filePath = path.join(this.persistDir, `${sessionId}.json`);
      await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));

    } catch (error) {
      console.error('Session storage error:', error);
      throw new Error('Failed to store session data');
    }
  }

  async get(sessionId) {
    try {
      // Check memory cache first
      let sessionData = this.cache.get(sessionId);
      if (sessionData) {
        return sessionData;
      }

      // Try Redis
      if (this.redisClient) {
        try {
          const redisData = await this.redisClient.get(`session:${sessionId}`);
          if (redisData) {
            sessionData = JSON.parse(redisData);
            // Update memory cache
            this.cache.set(sessionId, sessionData);
            return sessionData;
          }
        } catch (redisError) {
          console.warn('Redis session read failed, trying file:', redisError.message);
        }
      }

      // Fallback to file persistence
      const filePath = path.join(this.persistDir, `${sessionId}.json`);
      try {
        const fileData = await fs.readFile(filePath, 'utf8');
        sessionData = JSON.parse(fileData);

        // Check if session is expired
        if (sessionData.expiresAt && new Date(sessionData.expiresAt) < new Date()) {
          await this.delete(sessionId);
          return null;
        }

        // Update memory cache
        this.cache.set(sessionId, sessionData);
        return sessionData;
      } catch (fileError) {
        // Session not found
        return null;
      }

    } catch (error) {
      console.error('Session retrieval error:', error);
      return null;
    }
  }

  async delete(sessionId) {
    try {
      // Remove from memory cache
      this.cache.del(sessionId);

      // Remove from Redis
      if (this.redisClient) {
        try {
          await this.redisClient.del(`session:${sessionId}`);
        } catch (redisError) {
          console.warn('Redis session delete failed:', redisError.message);
        }
      }

      // Remove from file system
      const filePath = path.join(this.persistDir, `${sessionId}.json`);
      try {
        await fs.unlink(filePath);
      } catch (fileError) {
        // File might not exist, that's okay
      }

      // Clean up associated temp directory
      const tempDir = path.join(__dirname, '..', 'temp', sessionId);
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        // Directory might not exist, that's okay
      }

    } catch (error) {
      console.error('Session deletion error:', error);
    }
  }

  async cleanup() {
    try {
      // Clean up expired sessions from file system
      const files = await fs.readdir(this.persistDir);
      const now = new Date();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.persistDir, file);
          const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

          if (data.expiresAt && new Date(data.expiresAt) < now) {
            const sessionId = file.replace('.json', '');
            await this.delete(sessionId);
          }
        } catch (error) {
          // If we can't read the file, delete it
          try {
            await fs.unlink(path.join(this.persistDir, file));
          } catch { }
        }
      }

      console.log('✅ Session cleanup completed');
    } catch (error) {
      console.warn('Session cleanup error:', error.message);
    }
  }

  // Get all active sessions (for monitoring)
  async getAllSessions() {
    const sessions = [];

    try {
      // Get from memory cache
      const cacheKeys = this.cache.keys();
      for (const key of cacheKeys) {
        const data = this.cache.get(key);
        if (data) {
          sessions.push({ sessionId: key, ...data });
        }
      }

      // If Redis is available, get additional sessions
      if (this.redisClient) {
        try {
          const redisKeys = await this.redisClient.keys('session:*');
          for (const key of redisKeys) {
            const sessionId = key.replace('session:', '');
            if (!cacheKeys.includes(sessionId)) {
              const data = await this.redisClient.get(key);
              if (data) {
                sessions.push({ sessionId, ...JSON.parse(data) });
              }
            }
          }
        } catch (redisError) {
          console.warn('Redis session listing failed:', redisError.message);
        }
      }

    } catch (error) {
      console.error('Error getting all sessions:', error);
    }

    return sessions;
  }
}

// Create singleton instance
export const sessionManager = new PersistentSessionManager();

// Start cleanup interval (every hour)
setInterval(() => {
  sessionManager.cleanup();
}, 60 * 60 * 1000);

export default sessionManager;