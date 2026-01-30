import { auditSystem } from './auditSystem';
import { AuditEntry } from '@/types/audit';

describe('AuditSystem', () => {
  beforeEach(() => {
    // Clear any existing audit entries for clean tests
    jest.clearAllMocks();
  });

  describe('logApprovalAction', () => {
    it('should log approval action with complete context', async () => {
      const approvalData = {
        userId: 'user123',
        userType: 'authenticated' as const,
        videoId: 'video456',
        videoTitle: 'Test Video',
        action: 'approve' as const,
        newStatus: 'approved',
        feedback: 'Looks great!',
        reviewerName: 'John Doe',
        clientVerified: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      };

      const auditId = await auditSystem.logApprovalAction(approvalData);

      expect(auditId).toBeDefined();
      expect(auditId).toMatch(/^approval_\d+_[a-z0-9]+$/);

      // Verify the entry was stored
      const entry = auditSystem.getAuditEntry(auditId);
      expect(entry).toBeDefined();
      expect(entry?.type).toBe('approval_action');
      expect(entry?.userId).toBe('user123');
      expect(entry?.checksum).toBeDefined();
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalData = {
        userId: 'user123',
        userType: 'anonymous' as const,
        videoId: 'video456',
        action: 'reject' as const,
        newStatus: 'rejected',
        clientVerified: false
      };

      const auditId = await auditSystem.logApprovalAction(minimalData);

      expect(auditId).toBeDefined();
      
      const entry = auditSystem.getAuditEntry(auditId);
      expect(entry).toBeDefined();
      expect(entry?.type).toBe('approval_action');
    });
  });

  describe('logPaymentTransaction', () => {
    it('should log payment transaction with integrity verification', async () => {
      const paymentData = {
        userId: 'user123',
        transactionId: 'txn_456',
        razorpayPaymentId: 'pay_789',
        amount: 99900,
        currency: 'INR',
        paymentStatus: 'completed' as const,
        webhookReceived: true,
        retryCount: 0,
        integrityCheckPassed: true
      };

      const auditId = await auditSystem.logPaymentTransaction(paymentData);

      expect(auditId).toBeDefined();
      expect(auditId).toMatch(/^payment_\d+_[a-z0-9]+$/);

      const entry = auditSystem.getAuditEntry(auditId);
      expect(entry).toBeDefined();
      expect(entry?.type).toBe('payment_transaction');
      expect(entry?.checksum).toBeDefined();
    });
  });

  describe('logSubscriptionChange', () => {
    it('should log subscription changes with before/after states', async () => {
      const subscriptionData = {
        userId: 'user123',
        subscriptionId: 'sub_456',
        changeType: 'upgrade' as const,
        beforeState: {
          tier: 'free',
          status: 'active',
          uploadCount: 3,
          maxUploads: 5,
          clientsUsed: 2,
          maxClients: 5
        },
        afterState: {
          tier: 'premium',
          status: 'active',
          uploadCount: 3,
          maxUploads: 50,
          clientsUsed: 2,
          maxClients: 50
        },
        preservedData: true,
        paymentId: 'pay_789'
      };

      const auditId = await auditSystem.logSubscriptionChange(subscriptionData);

      expect(auditId).toBeDefined();
      expect(auditId).toMatch(/^subscription_\d+_[a-z0-9]+$/);

      const entry = auditSystem.getAuditEntry(auditId);
      expect(entry).toBeDefined();
      expect(entry?.type).toBe('subscription_change');
    });
  });

  describe('logSecurityViolation', () => {
    it('should log security violations with appropriate severity', async () => {
      const violationData = {
        userId: 'user123',
        userType: 'authenticated' as const,
        violationType: 'unauthorized_access' as const,
        severity: 'high' as const,
        resourceId: 'video456',
        resourceType: 'video' as const,
        attemptedAction: 'approve',
        deniedReason: 'User ID mismatch',
        requiresInvestigation: true
      };

      const auditId = await auditSystem.logSecurityViolation(violationData);

      expect(auditId).toBeDefined();
      expect(auditId).toMatch(/^security_\d+_[a-z0-9]+$/);

      const entry = auditSystem.getAuditEntry(auditId);
      expect(entry).toBeDefined();
      expect(entry?.type).toBe('security_violation');
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify audit entry integrity correctly', async () => {
      // Create an audit entry
      const auditId = await auditSystem.logApprovalAction({
        userId: 'user123',
        userType: 'authenticated',
        videoId: 'video456',
        action: 'approve',
        newStatus: 'approved',
        clientVerified: true
      });

      // Verify its integrity
      const verification = await auditSystem.verifyIntegrity(auditId);

      expect(verification.isValid).toBe(true);
      expect(verification.tampered).toBe(false);
      expect(verification.expectedChecksum).toBeDefined();
      expect(verification.actualChecksum).toBeDefined();
      expect(verification.expectedChecksum).toBe(verification.actualChecksum);
    });

    it('should detect non-existent entries', async () => {
      const verification = await auditSystem.verifyIntegrity('non_existent_id');

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
    });
  });

  describe('queryAuditEntries', () => {
    beforeEach(async () => {
      // Create some test entries
      await auditSystem.logApprovalAction({
        userId: 'user1',
        userType: 'authenticated',
        videoId: 'video1',
        action: 'approve',
        newStatus: 'approved',
        clientVerified: true
      });

      await auditSystem.logPaymentTransaction({
        userId: 'user2',
        transactionId: 'txn_1',
        razorpayPaymentId: 'pay_1',
        amount: 99900,
        currency: 'INR',
        paymentStatus: 'completed',
        webhookReceived: true,
        retryCount: 0,
        integrityCheckPassed: true
      });
    });

    it('should query entries by user ID', async () => {
      const entries = await auditSystem.queryAuditEntries({ userId: 'user1' });

      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every(entry => entry.userId === 'user1')).toBe(true);
    });

    it('should query entries by type', async () => {
      const entries = await auditSystem.queryAuditEntries({ type: 'approval_action' });

      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every(entry => entry.type === 'approval_action')).toBe(true);
    });

    it('should apply limit correctly', async () => {
      const entries = await auditSystem.queryAuditEntries({ limit: 1 });

      expect(entries.length).toBe(1);
    });
  });

  describe('getAuditStatistics', () => {
    it('should return comprehensive audit statistics', async () => {
      // Create some test entries
      await auditSystem.logApprovalAction({
        userId: 'user1',
        userType: 'authenticated',
        videoId: 'video1',
        action: 'approve',
        newStatus: 'approved',
        clientVerified: true
      });

      await auditSystem.logSecurityViolation({
        userId: 'user2',
        userType: 'anonymous',
        violationType: 'rate_limit_exceeded',
        severity: 'medium',
        deniedReason: 'Too many requests',
        requiresInvestigation: false
      });

      const stats = await auditSystem.getAuditStatistics();

      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.entriesByType).toBeDefined();
      expect(stats.entriesByUser).toBeDefined();
      expect(stats.securityViolations).toBeDefined();
      expect(stats.integrityStatus).toBeDefined();
      expect(stats.storageMetrics).toBeDefined();
    });
  });

  describe('performBatchIntegrityCheck', () => {
    it('should perform batch integrity verification', async () => {
      // Create some test entries
      await auditSystem.logApprovalAction({
        userId: 'user1',
        userType: 'authenticated',
        videoId: 'video1',
        action: 'approve',
        newStatus: 'approved',
        clientVerified: true
      });

      const result = await auditSystem.performBatchIntegrityCheck();

      expect(result.success).toBe(true);
      expect(result.processedCount).toBeGreaterThan(0);
      expect(result.failedCount).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });
});