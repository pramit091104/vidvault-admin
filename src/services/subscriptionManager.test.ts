import { SubscriptionManager } from './subscriptionManager';

// Mock all external dependencies
jest.mock('@/services/backendApiService', () => ({
  getSubscriptionStatus: jest.fn(),
  updateSubscription: jest.fn(),
}));

jest.mock('@/lib/subscriptionCache', () => ({
  getCachedSubscription: jest.fn(),
  setCachedSubscription: jest.fn(),
  clearCachedSubscription: jest.fn(),
}));

jest.mock('@/integrations/firebase/config', () => ({
  auth: {
    currentUser: { uid: 'test-user' }
  }
}));

describe('SubscriptionManager', () => {
  let subscriptionManager: SubscriptionManager;

  beforeEach(() => {
    subscriptionManager = SubscriptionManager.getInstance();
    jest.clearAllMocks();
  });

  describe('checkExpiry', () => {
    it('should return true for expired dates', () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      expect(subscriptionManager.checkExpiry(expiredDate)).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      expect(subscriptionManager.checkExpiry(futureDate)).toBe(false);
    });

    it('should return false for undefined dates', () => {
      expect(subscriptionManager.checkExpiry(undefined)).toBe(false);
    });

    it('should handle string dates correctly', () => {
      const expiredDateString = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(subscriptionManager.checkExpiry(expiredDateString)).toBe(true);
    });
  });

  describe('validateSubscriptionIntegrity', () => {
    it('should validate correct subscription data', async () => {
      const validData = {
        tier: 'premium',
        videoUploadsUsed: 10,
        clientsUsed: 5,
        maxVideoUploads: 50,
        maxClients: 50,
        maxFileSize: 500,
        status: 'active',
        subscriptionDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      const result = await subscriptionManager.validateSubscriptionIntegrity('user123', validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid tier', async () => {
      const invalidData = {
        tier: 'invalid_tier',
        videoUploadsUsed: 10,
        clientsUsed: 5,
        maxVideoUploads: 50,
        maxClients: 50,
        maxFileSize: 500,
        status: 'active'
      };

      const result = await subscriptionManager.validateSubscriptionIntegrity('user123', invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid subscription tier');
    });

    it('should detect negative usage counts', async () => {
      const invalidData = {
        tier: 'premium',
        videoUploadsUsed: -5,
        clientsUsed: -2,
        maxVideoUploads: 50,
        maxClients: 50,
        maxFileSize: 500,
        status: 'active'
      };

      const result = await subscriptionManager.validateSubscriptionIntegrity('user123', invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video upload count cannot be negative');
      expect(result.errors).toContain('Client count cannot be negative');
    });

    it('should detect usage exceeding limits', async () => {
      const invalidData = {
        tier: 'premium',
        videoUploadsUsed: 60, // Exceeds premium limit of 50
        clientsUsed: 55, // Exceeds premium limit of 50
        maxVideoUploads: 50,
        maxClients: 50,
        maxFileSize: 500,
        status: 'active'
      };

      const result = await subscriptionManager.validateSubscriptionIntegrity('user123', invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video uploads used (60) exceeds maximum allowed (50)');
      expect(result.errors).toContain('Clients used (55) exceeds maximum allowed (50)');
    });
  });

  describe('validateBeforeOperation', () => {
    it('should require user ID for all operations', async () => {
      const result = await subscriptionManager.validateBeforeOperation('', 'create', {});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User ID is required for all subscription operations');
    });

    it('should require data for create operations', async () => {
      const result = await subscriptionManager.validateBeforeOperation('user123', 'create');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Subscription data is required for creation');
    });

    it('should require data for update operations', async () => {
      const result = await subscriptionManager.validateBeforeOperation('user123', 'update');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Update data is required for subscription updates');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SubscriptionManager.getInstance();
      const instance2 = SubscriptionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});