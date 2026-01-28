import { notificationManager, NotificationManager } from './notificationManager';

// Mock Firebase auth
jest.mock('@/integrations/firebase/config', () => ({
  auth: {
    currentUser: {
      uid: 'test-user-id',
      getIdToken: jest.fn().mockResolvedValue('mock-token')
    }
  }
}));

// Mock Firebase services
jest.mock('@/integrations/firebase/videoService', () => ({
  getVideoBySlugOrId: jest.fn().mockResolvedValue({
    id: 'test-video-id',
    title: 'Test Video',
    userId: 'creator-user-id',
    publicSlug: 'test-slug'
  })
}));

jest.mock('@/integrations/firebase/userService', () => ({
  getUserById: jest.fn().mockResolvedValue({
    id: 'creator-user-id',
    email: 'creator@example.com',
    displayName: 'Test Creator'
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('NotificationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, // Simulate API not available to test fallback
      json: jest.fn().mockResolvedValue({})
    });
  });

  describe('sendApprovalNotification', () => {
    it('should send approval notification successfully', async () => {
      const approvalData = {
        videoId: 'test-video-id',
        videoTitle: 'Test Video',
        creatorId: 'creator-user-id',
        creatorEmail: 'creator@example.com',
        creatorName: 'Test Creator',
        approvalStatus: 'approved' as const,
        reviewerName: 'Test Reviewer',
        reviewerEmail: 'reviewer@example.com',
        feedback: 'Great work!',
        videoUrl: 'https://example.com/watch/test-video'
      };

      const result = await notificationManager.sendApprovalNotification(approvalData);
      
      expect(result).toBe(true);
    });

    it('should handle different approval statuses', async () => {
      const baseData = {
        videoId: 'test-video-id',
        videoTitle: 'Test Video',
        creatorId: 'creator-user-id',
        creatorEmail: 'creator@example.com',
        creatorName: 'Test Creator',
        videoUrl: 'https://example.com/watch/test-video'
      };

      // Test approved status
      const approvedResult = await notificationManager.sendApprovalNotification({
        ...baseData,
        approvalStatus: 'approved'
      });
      expect(approvedResult).toBe(true);

      // Test revision requested status
      const revisionResult = await notificationManager.sendApprovalNotification({
        ...baseData,
        approvalStatus: 'revision_requested',
        feedback: 'Please make these changes...'
      });
      expect(revisionResult).toBe(true);

      // Test rejected status
      const rejectedResult = await notificationManager.sendApprovalNotification({
        ...baseData,
        approvalStatus: 'rejected',
        feedback: 'This needs significant changes'
      });
      expect(rejectedResult).toBe(true);
    });
  });

  describe('sendRevisionRequest', () => {
    it('should send revision request notification', async () => {
      const result = await notificationManager.sendRevisionRequest(
        'creator-user-id',
        'test-video-id',
        'Please make these changes...',
        'Test Reviewer',
        'reviewer@example.com'
      );

      expect(result).toBe(true);
    });
  });

  describe('sendSubscriptionReminder', () => {
    it('should send subscription reminder notification', async () => {
      const reminderData = {
        userId: 'test-user-id',
        userEmail: 'user@example.com',
        userName: 'Test User',
        subscriptionTier: 'premium',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        daysUntilExpiry: 7,
        renewalUrl: 'https://example.com/pricing'
      };

      const result = await notificationManager.sendSubscriptionReminder(reminderData);
      
      expect(result).toBe(true);
    });

    it('should send subscription reminder by user ID', async () => {
      const result = await notificationManager.sendSubscriptionReminderByUserId(
        'test-user-id',
        7,
        'premium',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      expect(result).toBe(true);
    });
  });

  describe('retryFailedNotifications', () => {
    it('should process failed notifications', async () => {
      // This test verifies the method runs without errors
      await expect(notificationManager.retryFailedNotifications()).resolves.not.toThrow();
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', () => {
      const status = notificationManager.getQueueStatus();
      
      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('pending');
      expect(status).toHaveProperty('failed');
      expect(status).toHaveProperty('retry');
      expect(status).toHaveProperty('sent');
      
      expect(typeof status.total).toBe('number');
      expect(typeof status.pending).toBe('number');
      expect(typeof status.failed).toBe('number');
      expect(typeof status.retry).toBe('number');
      expect(typeof status.sent).toBe('number');
    });
  });

  describe('clearOldNotifications', () => {
    it('should clear old notifications', () => {
      // This test verifies the method runs without errors
      expect(() => notificationManager.clearOldNotifications(7)).not.toThrow();
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications', () => {
      const notifications = notificationManager.getUserNotifications('test-user-id');
      
      expect(Array.isArray(notifications)).toBe(true);
    });
  });
});

describe('NotificationManager Singleton', () => {
  it('should return the same instance', () => {
    const instance1 = NotificationManager.getInstance();
    const instance2 = NotificationManager.getInstance();
    
    expect(instance1).toBe(instance2);
    expect(instance1).toBe(notificationManager);
  });
});