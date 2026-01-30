import { SubscriptionManager } from './subscriptionManager';
import { PaymentManager } from './paymentManager';

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

describe('Subscription and Payment System Integration', () => {
  let subscriptionManager: SubscriptionManager;
  let paymentManager: PaymentManager;

  beforeAll(() => {
    // Set up environment for PaymentManager
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-secret';
  });

  beforeEach(() => {
    subscriptionManager = SubscriptionManager.getInstance();
    paymentManager = PaymentManager.getInstance();
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  describe('Core Functionality Validation', () => {
    it('should have SubscriptionManager with required methods', () => {
      expect(subscriptionManager).toBeDefined();
      expect(typeof subscriptionManager.validateSubscription).toBe('function');
      expect(typeof subscriptionManager.checkExpiry).toBe('function');
      expect(typeof subscriptionManager.upgradeSubscription).toBe('function');
      expect(typeof subscriptionManager.downgradeExpiredSubscriptions).toBe('function');
      expect(typeof subscriptionManager.validateSubscriptionIntegrity).toBe('function');
      expect(typeof subscriptionManager.updateSubscriptionWithIntegrity).toBe('function');
      expect(typeof subscriptionManager.validateBeforeOperation).toBe('function');
    });

    it('should have PaymentManager with required methods', () => {
      expect(paymentManager).toBeDefined();
      expect(typeof paymentManager.processWebhook).toBe('function');
      expect(typeof paymentManager.verifyPayment).toBe('function');
      expect(typeof paymentManager.handlePartialPayment).toBe('function');
      expect(typeof paymentManager.retryFailedPayment).toBe('function');
    });

    it('should maintain singleton pattern for both managers', () => {
      const subscriptionManager2 = SubscriptionManager.getInstance();
      const paymentManager2 = PaymentManager.getInstance();
      
      expect(subscriptionManager).toBe(subscriptionManager2);
      expect(paymentManager).toBe(paymentManager2);
    });
  });

  describe('SubscriptionManager Core Logic', () => {
    it('should correctly identify expired subscriptions', () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      
      expect(subscriptionManager.checkExpiry(expiredDate)).toBe(true);
      expect(subscriptionManager.checkExpiry(futureDate)).toBe(false);
      expect(subscriptionManager.checkExpiry(undefined)).toBe(false);
    });

    it('should validate subscription data integrity', async () => {
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

    it('should detect invalid subscription data', async () => {
      const invalidData = {
        tier: 'invalid_tier',
        videoUploadsUsed: -5,
        clientsUsed: 60, // Exceeds premium limit
        maxVideoUploads: 50,
        maxClients: 50,
        maxFileSize: 500,
        status: 'active'
      };

      const result = await subscriptionManager.validateSubscriptionIntegrity('user123', invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Invalid subscription tier');
      expect(result.errors).toContain('Video upload count cannot be negative');
      expect(result.errors).toContain('Clients used (60) exceeds maximum allowed (50)');
    });
  });

  describe('PaymentManager Core Logic', () => {
    it('should handle partial payment analysis correctly', async () => {
      const result1 = await paymentManager.handlePartialPayment('pay_test1', 50000, 99900);
      expect(result1.success).toBe(true);
      expect(result1.subscriptionUpdated).toBe(false); // Should be held
      expect(result1.partialAmount).toBe(50000);

      const result2 = await paymentManager.handlePartialPayment('pay_test2', 99900, 99900);
      expect(result2.success).toBe(true);
      expect(result2.subscriptionUpdated).toBe(true); // Full payment
    });

    it('should handle payment verification for non-existent payments', async () => {
      const result = await paymentManager.verifyPayment('pay_nonexistent');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Payment not found');
    });

    it('should handle retry for non-existent transactions', async () => {
      const result = await paymentManager.retryFailedPayment('pay_nonexistent');
      expect(result.success).toBe(false);
      expect(result.errorDetails).toContain('Transaction not found');
    });
  });

  describe('System Integration Points', () => {
    it('should have proper error handling across both systems', async () => {
      // Test SubscriptionManager error handling
      const subscriptionResult = await subscriptionManager.validateBeforeOperation('', 'create', {});
      expect(subscriptionResult.isValid).toBe(false);
      expect(subscriptionResult.errors).toContain('User ID is required for all subscription operations');

      // Test PaymentManager error handling
      const paymentResult = await paymentManager.retryFailedPayment('');
      expect(paymentResult.success).toBe(false);
    });

    it('should maintain data consistency requirements', async () => {
      // Test that subscription validation enforces business rules
      const inconsistentData = {
        tier: 'free',
        videoUploadsUsed: 100, // Exceeds free tier limit
        clientsUsed: 50, // Exceeds free tier limit
        maxVideoUploads: 5,
        maxClients: 5,
        maxFileSize: 100,
        status: 'active'
      };

      const result = await subscriptionManager.validateSubscriptionIntegrity('user123', inconsistentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video uploads used (100) exceeds maximum allowed (5)');
      expect(result.errors).toContain('Clients used (50) exceeds maximum allowed (5)');
    });
  });

  describe('Business Logic Validation', () => {
    it('should enforce tier-based limits correctly', async () => {
      const tiers = ['free', 'premium', 'enterprise'];
      const expectedLimits = {
        free: { uploads: 5, clients: 5, fileSize: 100 },
        premium: { uploads: 50, clients: 50, fileSize: 500 },
        enterprise: { uploads: 200, clients: 100, fileSize: 2000 }
      };

      for (const tier of tiers) {
        const limits = expectedLimits[tier as keyof typeof expectedLimits];
        const validData = {
          tier,
          videoUploadsUsed: limits.uploads - 1,
          clientsUsed: limits.clients - 1,
          maxVideoUploads: limits.uploads,
          maxClients: limits.clients,
          maxFileSize: limits.fileSize,
          status: 'active',
          // Add expiry date for paid tiers
          ...(tier !== 'free' && {
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            subscriptionDate: new Date()
          })
        };

        const result = await subscriptionManager.validateSubscriptionIntegrity('user123', validData);
        if (!result.isValid) {
          console.log(`Validation failed for tier ${tier}:`, result.errors);
        }
        expect(result.isValid).toBe(true);
      }
    });

    it('should detect when usage exceeds tier limits', async () => {
      const exceedingData = {
        tier: 'free',
        videoUploadsUsed: 10, // Exceeds free limit of 5
        clientsUsed: 10, // Exceeds free limit of 5
        maxVideoUploads: 5,
        maxClients: 5,
        maxFileSize: 100,
        status: 'active'
      };

      const result = await subscriptionManager.validateSubscriptionIntegrity('user123', exceedingData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video uploads used (10) exceeds maximum allowed (5)');
      expect(result.errors).toContain('Clients used (10) exceeds maximum allowed (5)');
    });
  });

  describe('System Readiness Check', () => {
    it('should confirm both systems are properly initialized', () => {
      expect(subscriptionManager).toBeInstanceOf(SubscriptionManager);
      expect(paymentManager).toBeInstanceOf(PaymentManager);
    });

    it('should have all required dependencies available', () => {
      // Check that the systems can access their dependencies
      expect(() => subscriptionManager.checkExpiry(new Date())).not.toThrow();
      expect(() => paymentManager.handlePartialPayment('test', 100, 200)).not.toThrow();
    });
  });
});