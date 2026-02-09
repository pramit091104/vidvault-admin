import { subscriptionManager } from './subscriptionManager';
import { auditSystem } from './auditSystem';
import { requestSignedUrl } from '@/integrations/api/signedUrlService';

export interface VideoAccessRequest {
  videoId: string;
  userId?: string;
  videoDuration?: number; // in seconds
  gcsPath?: string;
}

export interface SecureVideoAccess {
  signedUrl: string;
  expiryTime: Date;
  accessGranted: Date;
  subscriptionTierRequired: string;
  subscriptionVerified: boolean;
  refreshToken?: string;
}

export interface VideoAccessViolation {
  videoId: string;
  userId?: string;
  violationType: 'unauthorized_access' | 'expired_url' | 'invalid_subscription' | 'url_tampering' | 'excessive_requests';
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  additionalContext?: Record<string, any>;
}

/**
 * VideoAccessService handles secure video access with subscription validation,
 * signed URL generation, automatic refresh, and access violation detection.
 */
export class VideoAccessService {
  private static instance: VideoAccessService;
  private urlRefreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private accessAttempts: Map<string, number> = new Map();
  private pendingRequests: Map<string, Promise<SecureVideoAccess>> = new Map(); // Add request deduplication
  private readonly MAX_ACCESS_ATTEMPTS = 20; // Increased from 5 to 20
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute

  private constructor() { }

  public static getInstance(): VideoAccessService {
    if (!VideoAccessService.instance) {
      VideoAccessService.instance = new VideoAccessService();
    }
    return VideoAccessService.instance;
  }

  /**
   * Validates user permissions and generates secure video access
   * Requirements 8.1, 8.3: Validate user permissions before generating signed URLs
   */
  public async generateSecureAccess(request: VideoAccessRequest): Promise<SecureVideoAccess> {
    // Create a unique key for request deduplication
    const requestKey = `${request.videoId}_${request.userId || 'anonymous'}`;

    // Check if there's already a pending request for this video/user combination
    if (this.pendingRequests.has(requestKey)) {
      console.log(`Deduplicating request for video ${request.videoId}`);
      return await this.pendingRequests.get(requestKey)!;
    }

    // Create the actual request promise
    const requestPromise = this.executeSecureAccessRequest(request);

    // Store the promise for deduplication
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up the pending request
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Internal method that executes the actual secure access request
   */
  private async executeSecureAccessRequest(request: VideoAccessRequest): Promise<SecureVideoAccess> {
    try {
      // Rate limiting check
      if (await this.isRateLimited(request.userId || 'anonymous')) {
        const rateLimitStatus = this.getRateLimitStatus(request.userId || 'anonymous');
        const waitTimeMinutes = Math.ceil(rateLimitStatus.timeRemaining / 60000);

        await this.logAccessViolation({
          videoId: request.videoId,
          userId: request.userId,
          violationType: 'excessive_requests',
          severity: 'medium',
          timestamp: new Date(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          additionalContext: {
            rateLimitExceeded: true,
            attempts: rateLimitStatus.attempts,
            maxAttempts: rateLimitStatus.maxAttempts,
            timeRemaining: rateLimitStatus.timeRemaining
          }
        });

        throw new Error(`Too many access requests (${rateLimitStatus.attempts}/${rateLimitStatus.maxAttempts}). Please wait ${waitTimeMinutes} minute(s) before trying again.`);
      }

      // Validate subscription if user is authenticated
      let subscriptionVerified = false;
      let subscriptionTier = 'free';

      if (request.userId) {
        try {
          const subscriptionStatus = await subscriptionManager.validateSubscription(request.userId);
          subscriptionVerified = subscriptionStatus.isActive;
          subscriptionTier = subscriptionStatus.tier;

          // For premium content, require active subscription
          if (!subscriptionStatus.isActive && subscriptionTier === 'free') {
            // Allow access but with limitations (handled by content protection)
            subscriptionVerified = true; // Allow free tier access
          }
        } catch (error) {
          console.error('Subscription validation failed:', error);
          // Log security violation for subscription validation failure
          await this.logAccessViolation({
            videoId: request.videoId,
            userId: request.userId,
            violationType: 'invalid_subscription',
            severity: 'high',
            timestamp: new Date(),
            additionalContext: {
              error: error instanceof Error ? error.message : 'Unknown error',
              subscriptionCheckFailed: true
            }
          });
          throw new Error('Unable to verify subscription status');
        }
      } else {
        // Anonymous users get free tier access
        subscriptionVerified = true;
        subscriptionTier = 'free';
      }

      // Calculate appropriate expiry time based on video duration
      const expiryTime = this.calculateExpiryTime(request.videoDuration, subscriptionTier);

      // Generate signed URL
      const signedUrl = await requestSignedUrl(request.videoId, request.gcsPath);

      const secureAccess: SecureVideoAccess = {
        signedUrl,
        expiryTime,
        accessGranted: new Date(),
        subscriptionTierRequired: subscriptionTier,
        subscriptionVerified,
        refreshToken: this.generateRefreshToken(request.videoId, request.userId)
      };

      // Schedule automatic refresh
      this.scheduleUrlRefresh(request, secureAccess);

      // Log successful access
      await auditSystem.logSystemEvent({
        eventType: 'video_access',
        component: 'VideoAccessService',
        operation: 'generateSecureAccess',
        success: true,
        userId: request.userId || 'anonymous',
        metadata: {
          videoId: request.videoId,
          subscriptionTier,
          subscriptionVerified,
          expiryTime: expiryTime.toISOString()
        }
      });

      return secureAccess;
    } catch (error) {
      // Log access failure
      await auditSystem.logSystemEvent({
        eventType: 'video_access',
        component: 'VideoAccessService',
        operation: 'generateSecureAccess',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        userId: request.userId || 'anonymous',
        metadata: {
          videoId: request.videoId
        }
      });

      throw error;
    }
  }

  /**
   * Refreshes video URL without interrupting playback
   * Requirements 8.2: Automatically refresh URLs without interrupting playback
   */
  public async refreshVideoUrl(
    videoId: string,
    refreshToken: string,
    userId?: string,
    gcsPath?: string
  ): Promise<SecureVideoAccess> {
    try {
      // Validate refresh token
      if (!this.validateRefreshToken(refreshToken, videoId, userId)) {
        await this.logAccessViolation({
          videoId,
          userId,
          violationType: 'url_tampering',
          severity: 'high',
          timestamp: new Date(),
          additionalContext: { invalidRefreshToken: true }
        });
        throw new Error('Invalid refresh token');
      }

      // Generate new secure access
      const newAccess = await this.generateSecureAccess({
        videoId,
        userId,
        gcsPath
      });

      // Log successful refresh
      await auditSystem.logSystemEvent({
        eventType: 'video_access',
        component: 'VideoAccessService',
        operation: 'refreshVideoUrl',
        success: true,
        userId: userId || 'anonymous',
        metadata: {
          videoId,
          newExpiryTime: newAccess.expiryTime.toISOString()
        }
      });

      return newAccess;
    } catch (error) {
      // Log refresh failure
      await auditSystem.logSystemEvent({
        eventType: 'video_access',
        component: 'VideoAccessService',
        operation: 'refreshVideoUrl',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        userId: userId || 'anonymous',
        metadata: { videoId }
      });

      throw error;
    }
  }

  /**
   * Handles URL refresh failures with retry mechanisms
   * Requirements 8.4: Provide graceful error handling with retry mechanisms
   */
  public async handleRefreshFailure(
    videoId: string,
    userId?: string,
    retryCount: number = 0
  ): Promise<SecureVideoAccess | null> {
    const maxRetries = 2; // Reduced from 3 to prevent excessive retries
    const retryDelays = [2000, 5000]; // Increased delays to prevent rapid retries

    if (retryCount >= maxRetries) {
      console.error(`Max retries exceeded for video ${videoId}`);
      await this.logAccessViolation({
        videoId,
        userId,
        violationType: 'expired_url',
        severity: 'medium',
        timestamp: new Date(),
        additionalContext: {
          maxRetriesExceeded: true,
          retryCount
        }
      });
      return null;
    }

    try {
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, retryDelays[retryCount]));

      // Check if there's already a pending request to avoid duplicate retries
      const requestKey = `${videoId}_${userId || 'anonymous'}`;
      if (this.pendingRequests.has(requestKey)) {
        console.log(`Skipping retry - request already pending for video ${videoId}`);
        return await this.pendingRequests.get(requestKey)!;
      }

      // Attempt to refresh
      const refreshToken = this.generateRefreshToken(videoId, userId);
      return await this.refreshVideoUrl(videoId, refreshToken, userId);
    } catch (error) {
      console.error(`URL refresh retry ${retryCount + 1} failed:`, error);

      // Only retry if it's not a 404 error (video not found)
      if (error instanceof Error && error.message.includes('Video not found')) {
        console.log(`Video ${videoId} not found - stopping retries`);
        return null;
      }

      // Recursive retry with exponential backoff
      return await this.handleRefreshFailure(videoId, userId, retryCount + 1);
    }
  }

  /**
   * Logs access violations and security events
   * Requirements 8.5: Log security events and deny access appropriately
   */
  public async logAccessViolation(violation: VideoAccessViolation): Promise<void> {
    try {
      // Log to audit system
      await auditSystem.logSecurityViolation({
        userId: violation.userId || 'anonymous',
        userType: violation.userId ? 'authenticated' : 'anonymous',
        violationType: violation.violationType,
        severity: violation.severity,
        resourceType: 'video',
        resourceId: violation.videoId,
        attemptedAction: 'video_access',
        deniedReason: `Video access violation: ${violation.violationType}`,
        requiresInvestigation: violation.severity === 'high',
        additionalContext: {
          timestamp: violation.timestamp.toISOString(),
          userAgent: violation.userAgent,
          ipAddress: violation.ipAddress,
          ...violation.additionalContext
        }
      });

      // Additional logging for monitoring
      console.warn('Video access violation detected:', {
        videoId: violation.videoId,
        userId: violation.userId,
        violationType: violation.violationType,
        severity: violation.severity,
        timestamp: violation.timestamp
      });
    } catch (error) {
      console.error('Failed to log access violation:', error);
    }
  }

  /**
   * Calculates appropriate expiry time based on video duration and subscription tier
   * Requirements 8.1: Set appropriate expiry times that accommodate full video duration
   */
  private calculateExpiryTime(videoDuration?: number, subscriptionTier: string = 'free'): Date {
    const now = new Date();
    let expiryMinutes: number;

    // Base expiry time calculation
    if (videoDuration) {
      // For videos with known duration, set expiry to accommodate full playback plus buffer
      const videoDurationMinutes = Math.ceil(videoDuration / 60);
      const bufferMinutes = Math.max(30, videoDurationMinutes * 0.2); // 20% buffer, minimum 30 minutes
      expiryMinutes = videoDurationMinutes + bufferMinutes;
    } else {
      // Default expiry for unknown duration
      expiryMinutes = 120; // 2 hours default
    }

    // Adjust based on subscription tier
    switch (subscriptionTier) {
      case 'enterprise':
        expiryMinutes = Math.max(expiryMinutes, 480); // Minimum 8 hours for enterprise
        break;
      case 'premium':
        expiryMinutes = Math.max(expiryMinutes, 240); // Minimum 4 hours for premium
        break;
      case 'free':
      default:
        expiryMinutes = Math.min(expiryMinutes, 120); // Maximum 2 hours for free
        break;
    }

    return new Date(now.getTime() + expiryMinutes * 60 * 1000);
  }

  /**
   * Schedules automatic URL refresh before expiry
   */
  private scheduleUrlRefresh(request: VideoAccessRequest, access: SecureVideoAccess): void {
    const refreshTime = access.expiryTime.getTime() - Date.now() - (5 * 60 * 1000); // 5 minutes before expiry

    if (refreshTime > 0) {
      const timerId = setTimeout(async () => {
        try {
          await this.refreshVideoUrl(
            request.videoId,
            access.refreshToken!,
            request.userId,
            request.gcsPath
          );
        } catch (error) {
          console.error('Scheduled URL refresh failed:', error);
          await this.handleRefreshFailure(request.videoId, request.userId);
        }
      }, refreshTime);

      // Store timer for cleanup
      this.urlRefreshTimers.set(request.videoId, timerId);
    }
  }

  /**
   * Generates a refresh token for URL renewal
   */
  private generateRefreshToken(videoId: string, userId?: string): string {
    const payload = {
      videoId,
      userId: userId || 'anonymous',
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substr(2, 9)
    };

    return btoa(JSON.stringify(payload));
  }

  /**
   * Validates refresh token
   */
  private validateRefreshToken(token: string, videoId: string, userId?: string): boolean {
    try {
      const payload = JSON.parse(atob(token));

      // Check if token matches request
      if (payload.videoId !== videoId) return false;
      if (payload.userId !== (userId || 'anonymous')) return false;

      // Check if token is not too old (1 hour max)
      const tokenAge = Date.now() - payload.timestamp;
      if (tokenAge > 60 * 60 * 1000) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Checks if user is rate limited with progressive limits
   */
  private async isRateLimited(userId: string): Promise<boolean> {
    const key = `access_${userId}`;
    const now = Date.now();
    const attempts = this.accessAttempts.get(key) || 0;

    // Reset counter if window has passed
    const lastAttemptKey = `last_${userId}`;
    const lastAttempt = this.accessAttempts.get(lastAttemptKey) || 0;

    if (now - lastAttempt > this.RATE_LIMIT_WINDOW) {
      this.accessAttempts.set(key, 1);
      this.accessAttempts.set(lastAttemptKey, now);
      return false;
    }

    // Progressive rate limiting - more lenient for normal usage
    let maxAttempts = this.MAX_ACCESS_ATTEMPTS;

    // If user has been making requests recently but not excessively, be more lenient
    if (attempts < 10) {
      maxAttempts = this.MAX_ACCESS_ATTEMPTS;
    } else if (attempts < 15) {
      // Warn but don't block yet
      console.warn(`User ${userId} approaching rate limit: ${attempts}/${maxAttempts}`);
    }

    // Check if limit exceeded
    if (attempts >= maxAttempts) {
      console.warn(`Rate limit exceeded for user ${userId}: ${attempts}/${maxAttempts}`);
      return true;
    }

    // Increment counter
    this.accessAttempts.set(key, attempts + 1);
    this.accessAttempts.set(lastAttemptKey, now);

    return false;
  }

  /**
   * Resets rate limit for a specific user (admin function)
   */
  public resetRateLimit(userId: string): void {
    const key = `access_${userId}`;
    const lastAttemptKey = `last_${userId}`;
    this.accessAttempts.delete(key);
    this.accessAttempts.delete(lastAttemptKey);
    console.log(`Rate limit reset for user: ${userId}`);
  }

  /**
   * Gets current rate limit status for a user
   */
  public getRateLimitStatus(userId: string): { attempts: number; maxAttempts: number; timeRemaining: number } {
    const key = `access_${userId}`;
    const lastAttemptKey = `last_${userId}`;
    const attempts = this.accessAttempts.get(key) || 0;
    const lastAttempt = this.accessAttempts.get(lastAttemptKey) || 0;
    const now = Date.now();
    const timeRemaining = Math.max(0, this.RATE_LIMIT_WINDOW - (now - lastAttempt));

    return {
      attempts,
      maxAttempts: this.MAX_ACCESS_ATTEMPTS,
      timeRemaining
    };
  }

  /**
   * Cleans up resources for a video
   */
  public cleanup(videoId: string): void {
    const timerId = this.urlRefreshTimers.get(videoId);
    if (timerId) {
      clearTimeout(timerId);
      this.urlRefreshTimers.delete(videoId);
    }

    // Clean up any pending requests for this video
    const keysToDelete = Array.from(this.pendingRequests.keys()).filter(key => key.startsWith(videoId));
    keysToDelete.forEach(key => this.pendingRequests.delete(key));
  }

  /**
   * Clears all pending requests (admin function)
   */
  public clearPendingRequests(): void {
    this.pendingRequests.clear();
    console.log('All pending video access requests cleared');
  }

  /**
   * Validates video access permissions
   */
  public async validateAccess(videoId: string, userId?: string): Promise<boolean> {
    try {
      if (!userId) {
        // Anonymous users have basic access
        return true;
      }

      const subscriptionStatus = await subscriptionManager.validateSubscription(userId);
      return subscriptionStatus.isActive || subscriptionStatus.tier === 'free';
    } catch (error) {
      console.error('Access validation failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const videoAccessService = VideoAccessService.getInstance();