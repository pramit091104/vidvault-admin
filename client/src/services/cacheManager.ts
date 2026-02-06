import { SubscriptionStatus } from '@/types/subscription';

/**
 * Unified Cache Manager for consistent caching across frontend and backend
 * Implements consistent 3-minute TTL, cache warming, and invalidation mechanisms
 * 
 * Requirements addressed: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, CacheEntry>;
  private readonly UNIFIED_TTL = 3 * 60 * 1000; // 3 minutes in milliseconds
  private readonly STALE_TTL = 24 * 60 * 60 * 1000; // 24 hours grace period for stale data
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute cleanup interval
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.cache = new Map();
    this.startCleanupTimer();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Sets subscription cache with consistent 3-minute TTL
   * Requirement 7.2: Use consistent TTL values between frontend and backend systems
   */
  public setSubscriptionCache(userId: string, data: SubscriptionStatus, ttl?: number): void {
    try {
      const effectiveTtl = ttl || this.UNIFIED_TTL;
      const key = this.getSubscriptionKey(userId);
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        ttl: effectiveTtl,
        type: 'subscription'
      };

      this.cache.set(key, entry);

      // Also cache in localStorage for frontend persistence
      if (typeof window !== 'undefined') {
        this.setLocalStorageCache(key, entry);
      }

      console.log(`Subscription cache set for user ${userId} with TTL ${effectiveTtl}ms`);
    } catch (error) {
      console.error('Error setting subscription cache:', error);
    }
  }

  /**
   * Gets subscription data from cache
   * Requirement 7.3: Fetch fresh data from authoritative sources on cache misses
   */
  public getSubscriptionCache(userId: string): SubscriptionStatus | null {
    try {
      const key = this.getSubscriptionKey(userId);

      // Check memory cache first
      let entry = this.cache.get(key);

      // If not in memory, check localStorage (frontend only)
      if (!entry && typeof window !== 'undefined') {
        entry = this.getLocalStorageCache(key);
        if (entry) {
          // Restore to memory cache
          this.cache.set(key, entry);
        }
      }

      if (!entry) {
        return null;
      }

      // Check if cache entry is still valid
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        if (typeof window !== 'undefined') {
          this.removeLocalStorageCache(key);
        }
        return null;
      }

      return entry.data as SubscriptionStatus;
    } catch (error) {
      console.error('Error getting subscription cache:', error);
      return null;
    }
  }

  /**
   * Gets subscription data from cache even if expired (stale-while-revalidate pattern)
   * Returns data if it exists and is within the stale grace period (24 hours)
   */
  public getStaleSubscriptionCache(userId: string): { data: SubscriptionStatus; isStale: boolean } | null {
    try {
      const key = this.getSubscriptionKey(userId);

      // Check memory cache first
      let entry = this.cache.get(key);

      // If not in memory, check localStorage (frontend only)
      if (!entry && typeof window !== 'undefined') {
        entry = this.getLocalStorageCache(key);
        if (entry) {
          // Restore to memory cache
          this.cache.set(key, entry);
        }
      }

      if (!entry) {
        return null;
      }

      const now = Date.now();
      const isExpired = now - entry.timestamp > entry.ttl;
      const isStale = now - entry.timestamp > this.STALE_TTL;

      // If it's too old (beyond stale TTL), remove it and return null
      if (isStale) {
        this.cache.delete(key);
        if (typeof window !== 'undefined') {
          this.removeLocalStorageCache(key);
        }
        return null;
      }

      // Return data with stale flag
      return {
        data: entry.data as SubscriptionStatus,
        isStale: isExpired
      };
    } catch (error) {
      console.error('Error getting stale subscription cache:', error);
      return null;
    }
  }

  /**
   * Invalidates user cache for subscription changes
   * Requirement 7.1: Invalidate related cache entries across frontend and backend
   */
  public invalidateUserCache(userId: string): void {
    try {
      const subscriptionKey = this.getSubscriptionKey(userId);

      // Remove from memory cache
      this.cache.delete(subscriptionKey);

      // Remove from localStorage (frontend only)
      if (typeof window !== 'undefined') {
        this.removeLocalStorageCache(subscriptionKey);
      }

      // Also invalidate related cache entries
      this.invalidateRelatedEntries(userId);

      console.log(`Cache invalidated for user ${userId}`);
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  }

  /**
   * Warms cache for performance optimization
   * Requirement 7.4: Implement cache warming strategies for performance
   */
  public async warmCache(userIds: string[], dataFetcher?: (userId: string) => Promise<SubscriptionStatus>): Promise<void> {
    try {
      console.log(`Warming cache for ${userIds.length} users`);

      const warmingPromises = userIds.map(async (userId) => {
        try {
          // Check if cache already exists and is valid
          const existingData = this.getSubscriptionCache(userId);
          if (existingData) {
            return; // Cache is already warm
          }

          // If dataFetcher is provided, use it to fetch fresh data
          if (dataFetcher) {
            const freshData = await dataFetcher(userId);
            this.setSubscriptionCache(userId, freshData);
          }
        } catch (error) {
          console.error(`Error warming cache for user ${userId}:`, error);
        }
      });

      await Promise.allSettled(warmingPromises);
      console.log('Cache warming completed');
    } catch (error) {
      console.error('Error during cache warming:', error);
    }
  }

  /**
   * Ensures cache consistency across the system
   * Requirement 7.5: Provide mechanisms for manual cache invalidation
   */
  public ensureConsistency(): void {
    try {
      console.log('Ensuring cache consistency...');

      // Remove expired entries
      this.cleanupExpiredEntries();

      // Validate cache integrity
      this.validateCacheIntegrity();

      // Sync with localStorage if in browser environment
      if (typeof window !== 'undefined') {
        this.syncWithLocalStorage();
      }

      console.log('Cache consistency check completed');
    } catch (error) {
      console.error('Error ensuring cache consistency:', error);
    }
  }

  /**
   * Sets generic cache entry with specified TTL
   */
  public setCache(key: string, data: any, ttl?: number, type: string = 'generic'): void {
    try {
      const effectiveTtl = ttl || this.UNIFIED_TTL;
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        ttl: effectiveTtl,
        type
      };

      this.cache.set(key, entry);

      if (typeof window !== 'undefined') {
        this.setLocalStorageCache(key, entry);
      }
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  /**
   * Gets generic cache entry
   */
  public getCache(key: string): any | null {
    try {
      let entry = this.cache.get(key);

      if (!entry && typeof window !== 'undefined') {
        entry = this.getLocalStorageCache(key);
        if (entry) {
          this.cache.set(key, entry);
        }
      }

      if (!entry || this.isExpired(entry)) {
        this.cache.delete(key);
        if (typeof window !== 'undefined') {
          this.removeLocalStorageCache(key);
        }
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  /**
   * Invalidates cache by pattern
   */
  public invalidatePattern(pattern: string): void {
    try {
      const keysToDelete: string[] = [];

      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => {
        this.cache.delete(key);
        if (typeof window !== 'undefined') {
          this.removeLocalStorageCache(key);
        }
      });

      console.log(`Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
    } catch (error) {
      console.error('Error invalidating cache pattern:', error);
    }
  }

  /**
   * Gets cache statistics
   */
  public getStats(): CacheStats {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    const typeStats: Record<string, number> = {};

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredEntries++;
      } else {
        validEntries++;
      }

      typeStats[entry.type] = (typeStats[entry.type] || 0) + 1;
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      typeStats,
      unifiedTtl: this.UNIFIED_TTL,
      lastCleanup: now
    };
  }

  /**
   * Clears all cache entries
   */
  public clearAll(): void {
    try {
      this.cache.clear();

      if (typeof window !== 'undefined') {
        // Clear all cache-related localStorage entries
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('cache_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }

      console.log('All cache entries cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Private helper methods

  private getSubscriptionKey(userId: string): string {
    return `subscription_${userId}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private invalidateRelatedEntries(userId: string): void {
    // Invalidate any cache entries related to this user
    const patterns = [
      `user_${userId}`,
      `client_${userId}`,
      `video_${userId}`,
      `upload_${userId}`
    ];

    patterns.forEach(pattern => {
      this.invalidatePattern(pattern);
    });
  }

  private cleanupExpiredEntries(): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      if (typeof window !== 'undefined') {
        this.removeLocalStorageCache(key);
      }
    });

    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  private validateCacheIntegrity(): void {
    // Check for any inconsistencies in cache data
    let inconsistencies = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Validate entry structure
      if (!entry.data || !entry.timestamp || !entry.ttl || !entry.type) {
        console.warn(`Invalid cache entry structure for key: ${key}`);
        this.cache.delete(key);
        inconsistencies++;
      }

      // Validate timestamp
      if (entry.timestamp > Date.now()) {
        console.warn(`Future timestamp detected for key: ${key}`);
        this.cache.delete(key);
        inconsistencies++;
      }
    }

    if (inconsistencies > 0) {
      console.log(`Fixed ${inconsistencies} cache integrity issues`);
    }
  }

  private syncWithLocalStorage(): void {
    try {
      // Sync memory cache with localStorage
      for (const [key, entry] of this.cache.entries()) {
        if (!this.isExpired(entry)) {
          this.setLocalStorageCache(key, entry);
        }
      }
    } catch (error) {
      console.error('Error syncing with localStorage:', error);
    }
  }

  private setLocalStorageCache(key: string, entry: CacheEntry): void {
    try {
      const cacheKey = `cache_${key}`;
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      // localStorage might be full or unavailable
      console.warn('Could not set localStorage cache:', error);
    }
  }

  private getLocalStorageCache(key: string): CacheEntry | null {
    try {
      const cacheKey = `cache_${key}`;
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const entry: CacheEntry = JSON.parse(cached);

      // Validate entry structure
      if (!entry.data || !entry.timestamp || !entry.ttl || !entry.type) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return entry;
    } catch (error) {
      console.error('Error reading localStorage cache:', error);
      return null;
    }
  }

  private removeLocalStorageCache(key: string): void {
    try {
      const cacheKey = `cache_${key}`;
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error removing localStorage cache:', error);
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Cleanup method to be called when the cache manager is no longer needed
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// Types and interfaces

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  type: string;
}

interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  typeStats: Record<string, number>;
  unifiedTtl: number;
  lastCleanup: number;
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();