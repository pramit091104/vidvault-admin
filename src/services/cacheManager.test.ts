import { cacheManager } from './cacheManager';
import { SubscriptionStatus } from '@/types/subscription';

describe('CacheManager', () => {
  beforeEach(() => {
    // Clear all cache before each test
    cacheManager.clearAll();
  });

  afterAll(() => {
    // Cleanup after tests
    cacheManager.destroy();
  });

  describe('Subscription Caching', () => {
    it('should set and get subscription cache with unified TTL', () => {
      const userId = 'test-user-123';
      const subscriptionData: SubscriptionStatus = {
        isActive: true,
        tier: 'premium',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        uploadCount: 5,
        features: ['basic_upload', 'basic_sharing', 'advanced_analytics'],
        maxUploads: 50,
        maxClients: 50,
        maxFileSize: 500,
        clientsUsed: 2,
        status: 'active'
      };

      // Set subscription cache
      cacheManager.setSubscriptionCache(userId, subscriptionData);

      // Get subscription cache
      const cachedData = cacheManager.getSubscriptionCache(userId);

      expect(cachedData).toEqual(subscriptionData);
      expect(cachedData?.tier).toBe('premium');
      expect(cachedData?.isActive).toBe(true);
    });

    it('should return null for non-existent cache entries', () => {
      const cachedData = cacheManager.getSubscriptionCache('non-existent-user');
      expect(cachedData).toBeNull();
    });

    it('should invalidate user cache correctly', () => {
      const userId = 'test-user-456';
      const subscriptionData: SubscriptionStatus = {
        isActive: true,
        tier: 'free',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        uploadCount: 2,
        features: ['basic_upload', 'basic_sharing'],
        maxUploads: 5,
        maxClients: 5,
        maxFileSize: 100,
        clientsUsed: 1,
        status: 'active'
      };

      // Set cache
      cacheManager.setSubscriptionCache(userId, subscriptionData);
      expect(cacheManager.getSubscriptionCache(userId)).toEqual(subscriptionData);

      // Invalidate cache
      cacheManager.invalidateUserCache(userId);
      expect(cacheManager.getSubscriptionCache(userId)).toBeNull();
    });
  });

  describe('Generic Caching', () => {
    it('should set and get generic cache entries', () => {
      const key = 'test-key';
      const data = { message: 'Hello, World!', timestamp: Date.now() };

      cacheManager.setCache(key, data, undefined, 'test');
      const cachedData = cacheManager.getCache(key);

      expect(cachedData).toEqual(data);
    });

    it('should invalidate cache by pattern', () => {
      // Set multiple cache entries
      cacheManager.setCache('user_123_profile', { name: 'John' }, undefined, 'profile');
      cacheManager.setCache('user_123_settings', { theme: 'dark' }, undefined, 'settings');
      cacheManager.setCache('user_456_profile', { name: 'Jane' }, undefined, 'profile');

      // Verify entries exist
      expect(cacheManager.getCache('user_123_profile')).toEqual({ name: 'John' });
      expect(cacheManager.getCache('user_123_settings')).toEqual({ theme: 'dark' });
      expect(cacheManager.getCache('user_456_profile')).toEqual({ name: 'Jane' });

      // Invalidate by pattern
      cacheManager.invalidatePattern('user_123');

      // Check that user_123 entries are gone but user_456 remains
      expect(cacheManager.getCache('user_123_profile')).toBeNull();
      expect(cacheManager.getCache('user_123_settings')).toBeNull();
      expect(cacheManager.getCache('user_456_profile')).toEqual({ name: 'Jane' });
    });
  });

  describe('Cache Statistics', () => {
    it('should provide accurate cache statistics', () => {
      // Add some cache entries
      cacheManager.setSubscriptionCache('user1', {
        isActive: true,
        tier: 'premium',
        expiryDate: new Date(),
        uploadCount: 0,
        features: [],
        maxUploads: 50,
        maxClients: 50,
        maxFileSize: 500,
        clientsUsed: 0,
        status: 'active'
      });
      
      cacheManager.setCache('test-key', { data: 'test' }, undefined, 'generic');

      const stats = cacheManager.getStats();

      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.validEntries).toBeGreaterThan(0);
      expect(stats.unifiedTtl).toBe(3 * 60 * 1000); // 3 minutes
      expect(stats.typeStats).toBeDefined();
    });
  });

  describe('Cache Consistency', () => {
    it('should ensure cache consistency', () => {
      // Add some test data
      cacheManager.setSubscriptionCache('user1', {
        isActive: true,
        tier: 'premium',
        expiryDate: new Date(),
        uploadCount: 0,
        features: [],
        maxUploads: 50,
        maxClients: 50,
        maxFileSize: 500,
        clientsUsed: 0,
        status: 'active'
      });

      // This should not throw an error
      expect(() => cacheManager.ensureConsistency()).not.toThrow();
    });

    it('should clear all cache entries', () => {
      // Add some test data
      cacheManager.setSubscriptionCache('user1', {
        isActive: true,
        tier: 'premium',
        expiryDate: new Date(),
        uploadCount: 0,
        features: [],
        maxUploads: 50,
        maxClients: 50,
        maxFileSize: 500,
        clientsUsed: 0,
        status: 'active'
      });
      
      cacheManager.setCache('test-key', { data: 'test' });

      // Verify data exists
      expect(cacheManager.getSubscriptionCache('user1')).not.toBeNull();
      expect(cacheManager.getCache('test-key')).not.toBeNull();

      // Clear all
      cacheManager.clearAll();

      // Verify data is gone
      expect(cacheManager.getSubscriptionCache('user1')).toBeNull();
      expect(cacheManager.getCache('test-key')).toBeNull();
    });
  });

  describe('Cache Warming', () => {
    it('should warm cache for multiple users', async () => {
      const userIds = ['user1', 'user2', 'user3'];
      const mockDataFetcher = jest.fn().mockImplementation((userId: string) => 
        Promise.resolve({
          isActive: true,
          tier: 'premium',
          expiryDate: new Date(),
          uploadCount: 0,
          features: [],
          maxUploads: 50,
          maxClients: 50,
          maxFileSize: 500,
          clientsUsed: 0,
          status: 'active'
        } as SubscriptionStatus)
      );

      await cacheManager.warmCache(userIds, mockDataFetcher);

      // Verify that data fetcher was called for each user
      expect(mockDataFetcher).toHaveBeenCalledTimes(3);
      expect(mockDataFetcher).toHaveBeenCalledWith('user1');
      expect(mockDataFetcher).toHaveBeenCalledWith('user2');
      expect(mockDataFetcher).toHaveBeenCalledWith('user3');

      // Verify that cache entries were created
      expect(cacheManager.getSubscriptionCache('user1')).not.toBeNull();
      expect(cacheManager.getSubscriptionCache('user2')).not.toBeNull();
      expect(cacheManager.getSubscriptionCache('user3')).not.toBeNull();
    });

    it('should not fetch data for users with existing valid cache', async () => {
      const userIds = ['user1', 'user2'];
      
      // Pre-populate cache for user1
      cacheManager.setSubscriptionCache('user1', {
        isActive: true,
        tier: 'free',
        expiryDate: new Date(),
        uploadCount: 0,
        features: [],
        maxUploads: 5,
        maxClients: 5,
        maxFileSize: 100,
        clientsUsed: 0,
        status: 'active'
      });

      const mockDataFetcher = jest.fn().mockImplementation((userId: string) => 
        Promise.resolve({
          isActive: true,
          tier: 'premium',
          expiryDate: new Date(),
          uploadCount: 0,
          features: [],
          maxUploads: 50,
          maxClients: 50,
          maxFileSize: 500,
          clientsUsed: 0,
          status: 'active'
        } as SubscriptionStatus)
      );

      await cacheManager.warmCache(userIds, mockDataFetcher);

      // Should only be called for user2 (user1 already has cache)
      expect(mockDataFetcher).toHaveBeenCalledTimes(1);
      expect(mockDataFetcher).toHaveBeenCalledWith('user2');
      expect(mockDataFetcher).not.toHaveBeenCalledWith('user1');

      // Verify user1 still has original data
      const user1Data = cacheManager.getSubscriptionCache('user1');
      expect(user1Data?.tier).toBe('free');
    });
  });
});