import { integrationService, IntegrationResult, SystemHealth } from './integrationService';
import { subscriptionManager } from './subscriptionManager';
import { approvalManager } from './approvalManager';
import { notificationManager } from './notificationManager';
import { cacheManager } from './cacheManager';
import { videoAccessService } from './videoAccessService';
import { SubscriptionStatus } from '@/types/subscription';
import { SecureVideoAccess } from './videoAccessService';

/**
 * ApplicationService provides a unified interface for the frontend to interact
 * with all backend services through the integration layer.
 * 
 * This service acts as the main entry point for all business operations,
 * providing a clean API that abstracts the complexity of service coordination.
 */
export class ApplicationService {
  private static instance: ApplicationService;

  private constructor() {}

  public static getInstance(): ApplicationService {
    if (!ApplicationService.instance) {
      ApplicationService.instance = new ApplicationService();
    }
    return ApplicationService.instance;
  }

  // ==================== SUBSCRIPTION OPERATIONS ====================

  /**
   * Validates user subscription with caching and error handling
   */
  public async validateUserSubscription(userId: string): Promise<IntegrationResult<SubscriptionStatus>> {
    return await integrationService.processSubscriptionOperation('validate', userId);
  }

  /**
   * Upgrades user subscription with data preservation
   */
  public async upgradeUserSubscription(
    userId: string, 
    newTier: 'premium' | 'enterprise',
    preserveData: boolean = true
  ): Promise<IntegrationResult<SubscriptionStatus>> {
    return await integrationService.processSubscriptionOperation('upgrade', userId, {
      newTier,
      preserveData
    });
  }

  /**
   * Gets subscription status with cache optimization
   */
  public async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
    try {
      // Try cache first
      const cached = cacheManager.getSubscriptionCache(userId);
      if (cached) {
        return cached;
      }

      // Fallback to validation
      const result = await this.validateUserSubscription(userId);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return null;
    }
  }

  /**
   * Checks if user has access to premium features
   */
  public async hasPremiumAccess(userId: string): Promise<boolean> {
    try {
      const subscription = await this.getSubscriptionStatus(userId);
      return subscription?.isActive && subscription.tier !== 'free';
    } catch (error) {
      console.error('Error checking premium access:', error);
      return false;
    }
  }

  // ==================== PAYMENT OPERATIONS ====================

  /**
   * Processes payment webhook
   */
  public async processPaymentWebhook(
    payload: string,
    signature: string,
    timestamp?: string
  ): Promise<IntegrationResult> {
    return await integrationService.processPaymentOperation('webhook', {
      payload,
      signature,
      timestamp
    });
  }

  /**
   * Verifies payment status
   */
  public async verifyPayment(paymentId: string): Promise<IntegrationResult> {
    return await integrationService.processPaymentOperation('verify', {
      paymentId
    });
  }

  /**
   * Retries failed payment
   */
  public async retryFailedPayment(paymentId: string): Promise<IntegrationResult> {
    return await integrationService.processPaymentOperation('retry', {
      paymentId
    });
  }

  // ==================== APPROVAL OPERATIONS ====================

  /**
   * Processes video approval with full workflow
   */
  public async approveVideo(
    userId: string,
    videoId: string,
    options: {
      feedback?: string;
      clientName?: string;
      videoCreatorId?: string;
    } = {}
  ): Promise<IntegrationResult> {
    return await integrationService.processApprovalOperation(
      userId,
      videoId,
      'approve',
      options
    );
  }

  /**
   * Processes video rejection with feedback
   */
  public async rejectVideo(
    userId: string,
    videoId: string,
    options: {
      feedback?: string;
      clientName?: string;
      videoCreatorId?: string;
    } = {}
  ): Promise<IntegrationResult> {
    return await integrationService.processApprovalOperation(
      userId,
      videoId,
      'reject',
      options
    );
  }

  /**
   * Requests video revision with detailed feedback
   */
  public async requestVideoRevision(
    userId: string,
    videoId: string,
    options: {
      feedback?: string;
      clientName?: string;
      videoCreatorId?: string;
    } = {}
  ): Promise<IntegrationResult> {
    return await integrationService.processApprovalOperation(
      userId,
      videoId,
      'request_revision',
      options
    );
  }

  /**
   * Checks if user can perform approval actions
   */
  public async canUserApprove(userId: string, videoId: string): Promise<boolean> {
    try {
      const verification = await approvalManager.verifyApprovalPermission(userId, videoId);
      return verification.isVerified && verification.hasPermission;
    } catch (error) {
      console.error('Error checking approval permission:', error);
      return false;
    }
  }

  /**
   * Gets user's rate limit status for approvals
   */
  public async getApprovalRateLimit(userId: string): Promise<{
    allowed: boolean;
    remainingActions: number;
    resetTime: Date;
    reason?: string;
  }> {
    try {
      return await approvalManager.getRateLimitStatus(userId);
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return {
        allowed: false,
        remainingActions: 0,
        resetTime: new Date(Date.now() + 60000),
        reason: 'Error checking rate limit'
      };
    }
  }

  // ==================== VIDEO ACCESS OPERATIONS ====================

  /**
   * Gets secure video access with subscription validation
   */
  public async getSecureVideoAccess(
    videoId: string,
    userId?: string,
    options: {
      videoDuration?: number;
      gcsPath?: string;
    } = {}
  ): Promise<IntegrationResult<SecureVideoAccess>> {
    return await integrationService.processVideoAccess(videoId, userId, options);
  }

  /**
   * Refreshes video URL for continued playback
   */
  public async refreshVideoUrl(
    videoId: string,
    refreshToken: string,
    userId?: string,
    gcsPath?: string
  ): Promise<SecureVideoAccess | null> {
    try {
      return await videoAccessService.refreshVideoUrl(videoId, refreshToken, userId, gcsPath);
    } catch (error) {
      console.error('Error refreshing video URL:', error);
      
      // Try to handle refresh failure with retry
      return await videoAccessService.handleRefreshFailure(videoId, userId);
    }
  }

  /**
   * Validates video access permissions
   */
  public async validateVideoAccess(videoId: string, userId?: string): Promise<boolean> {
    try {
      return await videoAccessService.validateAccess(videoId, userId);
    } catch (error) {
      console.error('Error validating video access:', error);
      return false;
    }
  }

  // ==================== NOTIFICATION OPERATIONS ====================

  /**
   * Sends approval notification
   */
  public async sendApprovalNotification(data: {
    videoId: string;
    videoTitle: string;
    creatorId: string;
    creatorEmail: string;
    creatorName?: string;
    approvalStatus: 'approved' | 'rejected' | 'revision_requested';
    reviewerName?: string;
    reviewerEmail?: string;
    feedback?: string;
    videoUrl: string;
  }): Promise<boolean> {
    try {
      return await notificationManager.sendApprovalNotification(data);
    } catch (error) {
      console.error('Error sending approval notification:', error);
      return false;
    }
  }

  /**
   * Sends subscription reminder
   */
  public async sendSubscriptionReminder(
    userId: string,
    daysUntilExpiry: number,
    subscriptionTier: string = 'premium',
    expiryDate: Date
  ): Promise<boolean> {
    try {
      return await notificationManager.sendSubscriptionReminderByUserId(
        userId,
        daysUntilExpiry,
        subscriptionTier,
        expiryDate
      );
    } catch (error) {
      console.error('Error sending subscription reminder:', error);
      return false;
    }
  }

  /**
   * Gets notification queue status
   */
  public getNotificationQueueStatus(): {
    total: number;
    pending: number;
    failed: number;
    retry: number;
    sent: number;
  } {
    return notificationManager.getQueueStatus();
  }

  // ==================== CACHE OPERATIONS ====================

  /**
   * Invalidates user cache
   */
  public invalidateUserCache(userId: string): void {
    cacheManager.invalidateUserCache(userId);
  }

  /**
   * Ensures cache consistency
   */
  public ensureCacheConsistency(): void {
    cacheManager.ensureConsistency();
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    typeStats: Record<string, number>;
    unifiedTtl: number;
    lastCleanup: number;
  } {
    return cacheManager.getStats();
  }

  /**
   * Warms cache for specific users
   */
  public async warmUserCaches(userIds: string[]): Promise<void> {
    try {
      await cacheManager.warmCache(userIds, async (userId) => {
        const result = await this.validateUserSubscription(userId);
        return result.success ? result.data : null;
      });
    } catch (error) {
      console.error('Error warming user caches:', error);
    }
  }

  // ==================== SYSTEM OPERATIONS ====================

  /**
   * Gets system health status
   */
  public getSystemHealth(): SystemHealth {
    return integrationService.getSystemHealth();
  }

  /**
   * Performs comprehensive health check
   */
  public async performHealthCheck(): Promise<SystemHealth> {
    return await integrationService.performHealthCheck();
  }

  /**
   * Gets service errors for monitoring
   */
  public getServiceErrors(serviceName?: string): any[] {
    return integrationService.getServiceErrors(serviceName);
  }

  /**
   * Clears service errors (admin function)
   */
  public clearServiceErrors(serviceName?: string): void {
    integrationService.clearServiceErrors(serviceName);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Checks if user needs subscription upgrade
   */
  public async needsSubscriptionUpgrade(userId: string, requiredTier: 'premium' | 'enterprise'): Promise<boolean> {
    try {
      const subscription = await this.getSubscriptionStatus(userId);
      if (!subscription) return true;

      const tierHierarchy = { free: 0, premium: 1, enterprise: 2 };
      const currentLevel = tierHierarchy[subscription.tier] || 0;
      const requiredLevel = tierHierarchy[requiredTier] || 0;

      return currentLevel < requiredLevel || !subscription.isActive;
    } catch (error) {
      console.error('Error checking subscription upgrade need:', error);
      return true; // Err on the side of caution
    }
  }

  /**
   * Gets user's current usage statistics
   */
  public async getUserUsageStats(userId: string): Promise<{
    uploadCount: number;
    maxUploads: number;
    clientsUsed: number;
    maxClients: number;
    tier: string;
    isActive: boolean;
  } | null> {
    try {
      const subscription = await this.getSubscriptionStatus(userId);
      if (!subscription) return null;

      return {
        uploadCount: subscription.uploadCount,
        maxUploads: subscription.maxUploads || 0,
        clientsUsed: subscription.clientsUsed || 0,
        maxClients: subscription.maxClients || 0,
        tier: subscription.tier,
        isActive: subscription.isActive
      };
    } catch (error) {
      console.error('Error getting user usage stats:', error);
      return null;
    }
  }

  /**
   * Checks if user can upload more videos
   */
  public async canUserUpload(userId: string): Promise<{
    canUpload: boolean;
    reason?: string;
    upgradeRequired?: boolean;
  }> {
    try {
      const subscription = await this.getSubscriptionStatus(userId);
      if (!subscription) {
        return {
          canUpload: false,
          reason: 'Unable to verify subscription status',
          upgradeRequired: true
        };
      }

      if (!subscription.isActive) {
        return {
          canUpload: false,
          reason: 'Subscription is not active',
          upgradeRequired: true
        };
      }

      if (subscription.uploadCount >= (subscription.maxUploads || 0)) {
        return {
          canUpload: false,
          reason: `Upload limit reached (${subscription.uploadCount}/${subscription.maxUploads})`,
          upgradeRequired: subscription.tier === 'free'
        };
      }

      return { canUpload: true };
    } catch (error) {
      console.error('Error checking upload permission:', error);
      return {
        canUpload: false,
        reason: 'Error checking upload permission',
        upgradeRequired: false
      };
    }
  }

  /**
   * Gets upgrade recommendations for user
   */
  public async getUpgradeRecommendations(userId: string): Promise<{
    shouldUpgrade: boolean;
    currentTier: string;
    recommendedTier: 'premium' | 'enterprise';
    reasons: string[];
    benefits: string[];
  } | null> {
    try {
      const subscription = await this.getSubscriptionStatus(userId);
      if (!subscription) return null;

      const reasons: string[] = [];
      const benefits: string[] = [];
      let shouldUpgrade = false;
      let recommendedTier: 'premium' | 'enterprise' = 'premium';

      // Check usage patterns
      const uploadUsage = subscription.uploadCount / (subscription.maxUploads || 1);
      const clientUsage = (subscription.clientsUsed || 0) / (subscription.maxClients || 1);

      if (subscription.tier === 'free') {
        if (uploadUsage > 0.8) {
          reasons.push('Approaching upload limit');
          shouldUpgrade = true;
        }
        if (clientUsage > 0.8) {
          reasons.push('Approaching client limit');
          shouldUpgrade = true;
        }
        benefits.push('Unlimited uploads', 'Advanced analytics', 'Priority support');
      }

      if (subscription.tier === 'premium') {
        if (uploadUsage > 0.9 || clientUsage > 0.9) {
          reasons.push('High usage detected');
          recommendedTier = 'enterprise';
          shouldUpgrade = true;
          benefits.push('Higher limits', 'Custom branding', 'API access');
        }
      }

      if (!subscription.isActive) {
        reasons.push('Subscription expired');
        shouldUpgrade = true;
      }

      return {
        shouldUpgrade,
        currentTier: subscription.tier,
        recommendedTier,
        reasons,
        benefits
      };
    } catch (error) {
      console.error('Error getting upgrade recommendations:', error);
      return null;
    }
  }
}

// Export singleton instance
export const applicationService = ApplicationService.getInstance();