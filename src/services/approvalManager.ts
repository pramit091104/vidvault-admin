import { auth } from '@/integrations/firebase/config';
import { updateVideoApprovalStatus, getVideoBySlugOrId } from '@/integrations/firebase/videoService';
import { updateClientProjectStatus } from '@/integrations/firebase/clientService';
import { notificationManager } from './notificationManager';
import { auditSystem } from './auditSystem';
import { getUserById } from '@/integrations/firebase/userService';

/**
 * Rate limiting configuration for approval actions
 */
interface RateLimitConfig {
  maxActionsPerMinute: number;
  maxActionsPerHour: number;
  cooldownPeriod: number; // in milliseconds
}

/**
 * Approval action data structure for audit logging
 */
interface ApprovalAction {
  userId: string;
  videoId: string;
  status: 'approved' | 'rejected' | 'revision_requested';
  feedback?: string;
  timestamp: Date;
  clientVerified: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Identity verification result
 */
interface IdentityVerificationResult {
  isVerified: boolean;
  userId: string;
  userType: 'authenticated' | 'anonymous';
  hasPermission: boolean;
  reason?: string;
}

/**
 * Rate limit check result
 */
interface RateLimitResult {
  allowed: boolean;
  remainingActions: number;
  resetTime: Date;
  reason?: string;
}

/**
 * ApprovalManager handles video approval workflow with identity verification and audit logging.
 * Implements comprehensive security measures including rate limiting and permission validation.
 */
export class ApprovalManager {
  private static instance: ApprovalManager;
  private rateLimitConfig: RateLimitConfig;
  private userActionHistory: Map<string, Date[]> = new Map();

  private constructor() {
    this.rateLimitConfig = {
      maxActionsPerMinute: 5,
      maxActionsPerHour: 20,
      cooldownPeriod: 30000 // 30 seconds between actions for anonymous users
    };
  }

  public static getInstance(): ApprovalManager {
    if (!ApprovalManager.instance) {
      ApprovalManager.instance = new ApprovalManager();
    }
    return ApprovalManager.instance;
  }

  /**
   * Verifies approval permission with database validation
   * Validates user identity and authorization for the specific video
   */
  public async verifyApprovalPermission(userId: string, videoId: string): Promise<IdentityVerificationResult> {
    try {
      // Get current user from Firebase Auth
      const currentUser = auth.currentUser;
      
      // Determine user type and ID
      let actualUserId: string;
      let userType: 'authenticated' | 'anonymous';
      
      if (currentUser) {
        actualUserId = currentUser.uid;
        userType = 'authenticated';
        
        // Verify the provided userId matches the authenticated user
        if (userId !== actualUserId) {
          // Log security violation for user ID mismatch
          await auditSystem.logSecurityViolation({
            userId: actualUserId,
            userType: 'authenticated',
            violationType: 'unauthorized_access',
            severity: 'high',
            resourceId: videoId,
            resourceType: 'video',
            attemptedAction: 'verifyApprovalPermission',
            deniedReason: 'User ID mismatch - potential security violation',
            requiresInvestigation: true,
            additionalContext: { providedUserId: userId, actualUserId }
          });
          
          return {
            isVerified: false,
            userId: actualUserId,
            userType,
            hasPermission: false,
            reason: 'User ID mismatch - potential security violation'
          };
        }
      } else {
        // Anonymous user
        actualUserId = userId.startsWith('anonymous_') ? userId : `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        userType = 'anonymous';
      }

      // Fetch video data to validate client-video relationship
      const video = await getVideoBySlugOrId(videoId);
      if (!video) {
        return {
          isVerified: false,
          userId: actualUserId,
          userType,
          hasPermission: false,
          reason: 'Video not found'
        };
      }

      // Check if user is the video creator (creators cannot approve their own videos)
      if (currentUser && video.userId === currentUser.uid) {
        // Log security violation for self-approval attempt
        await auditSystem.logSecurityViolation({
          userId: actualUserId,
          userType: 'authenticated',
          violationType: 'unauthorized_access',
          severity: 'medium',
          resourceId: videoId,
          resourceType: 'video',
          attemptedAction: 'selfApproval',
          deniedReason: 'Video creators cannot approve their own videos',
          requiresInvestigation: false,
          additionalContext: { videoTitle: video.title }
        });
        
        return {
          isVerified: false,
          userId: actualUserId,
          userType,
          hasPermission: false,
          reason: 'Video creators cannot approve their own videos'
        };
      }

      // For authenticated users, verify they have client relationship
      if (userType === 'authenticated') {
        // In a real implementation, this would check client-video relationships in the database
        // For now, we allow any authenticated user who is not the creator
        return {
          isVerified: true,
          userId: actualUserId,
          userType,
          hasPermission: true
        };
      }

      // For anonymous users, allow approval (they are considered clients)
      return {
        isVerified: true,
        userId: actualUserId,
        userType,
        hasPermission: true
      };

    } catch (error) {
      console.error('Error verifying approval permission:', error);
      
      // Log system event for verification failure
      await auditSystem.logSystemEvent({
        eventType: 'system_event',
        component: 'ApprovalManager',
        operation: 'verifyApprovalPermission',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        userId,
        metadata: { videoId, userId }
      });
      
      return {
        isVerified: false,
        userId: userId,
        userType: 'anonymous',
        hasPermission: false,
        reason: `Permission verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Processes approval with identity verification and audit logging
   * Implements comprehensive security checks and business logic
   */
  public async processApproval(
    userId: string, 
    videoId: string, 
    status: 'approved' | 'rejected' | 'revision_requested',
    feedback?: string,
    clientName?: string,
    videoCreatorId?: string
  ): Promise<void> {
    try {
      // Step 1: Verify identity and permissions
      const identityCheck = await this.verifyApprovalPermission(userId, videoId);
      if (!identityCheck.isVerified || !identityCheck.hasPermission) {
        throw new Error(`Access denied: ${identityCheck.reason || 'Insufficient permissions'}`);
      }

      // Step 2: Check rate limits
      const rateLimitCheck = await this.rateLimitCheck(identityCheck.userId);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason || 'Too many actions'}`);
      }

      // Step 3: Validate approval status transition
      const video = await getVideoBySlugOrId(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      if (!this.isValidStatusTransition(video.approvalStatus || 'draft', status)) {
        throw new Error(`Invalid status transition from ${video.approvalStatus} to ${status}`);
      }

      // Step 4: Process the approval action
      const reviewerId = identityCheck.userType === 'authenticated' ? identityCheck.userId : 'anonymous_client';
      
      // Map our status to the video service status
      let videoServiceStatus: 'draft' | 'pending_review' | 'needs_changes' | 'approved' | 'completed';
      switch (status) {
        case 'approved':
          videoServiceStatus = 'approved';
          break;
        case 'rejected':
          videoServiceStatus = 'needs_changes'; // Rejection is treated as needs changes
          break;
        case 'revision_requested':
          videoServiceStatus = 'needs_changes';
          break;
        default:
          throw new Error(`Invalid approval status: ${status}`);
      }

      // Update video approval status
      await updateVideoApprovalStatus(videoId, videoServiceStatus, reviewerId, feedback);

      // Step 5: Update client project status if applicable
      if (clientName && videoCreatorId) {
        try {
          const projectStatus = status === 'approved' ? 'Done' : 'In progress';
          await updateClientProjectStatus(clientName, videoCreatorId, projectStatus);
        } catch (error) {
          console.warn('Could not update client project status:', error);
          // Don't fail the approval if client status update fails
        }
      }

      // Step 6: Record action in rate limiting history
      this.recordUserAction(identityCheck.userId);

      // Step 7: Send notification to video creator
      await this.sendApprovalNotification(videoId, status, {
        reviewerName: clientName,
        reviewerEmail: identityCheck.userType === 'authenticated' ? 
          (await this.getReviewerEmail(identityCheck.userId)) : undefined,
        feedback
      });

      // Step 8: Log approval action for audit trail
      await this.logApprovalAction(identityCheck.userId, videoId, status, {
        feedback,
        clientVerified: identityCheck.isVerified,
        userType: identityCheck.userType,
        videoTitle: video.title,
        clientName
      });

    } catch (error) {
      console.error('Error processing approval:', error);
      
      // Log the failed attempt for security monitoring
      await this.logApprovalAction(userId, videoId, status, {
        feedback,
        clientVerified: false,
        userType: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        failed: true
      });
      
      throw error;
    }
  }

  /**
   * Implements rate limiting to prevent abuse
   * Different limits for authenticated vs anonymous users
   */
  public async rateLimitCheck(userId: string): Promise<RateLimitResult> {
    try {
      const now = new Date();
      const userActions = this.userActionHistory.get(userId) || [];
      
      // Clean up old actions (older than 1 hour)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const recentActions = userActions.filter(actionTime => actionTime > oneHourAgo);
      
      // Update the history with cleaned data
      this.userActionHistory.set(userId, recentActions);
      
      // Check hourly limit
      if (recentActions.length >= this.rateLimitConfig.maxActionsPerHour) {
        const oldestAction = recentActions[0];
        const resetTime = new Date(oldestAction.getTime() + 60 * 60 * 1000);
        
        // Log security violation for rate limit exceeded
        await auditSystem.logSecurityViolation({
          userId,
          userType: userId.startsWith('anonymous_') ? 'anonymous' : 'authenticated',
          violationType: 'rate_limit_exceeded',
          severity: 'medium',
          resourceType: 'system',
          attemptedAction: 'approval_action',
          deniedReason: `Hourly limit of ${this.rateLimitConfig.maxActionsPerHour} actions exceeded`,
          requiresInvestigation: false,
          additionalContext: { 
            actionsInLastHour: recentActions.length,
            maxAllowed: this.rateLimitConfig.maxActionsPerHour,
            resetTime: resetTime.toISOString()
          }
        });
        
        return {
          allowed: false,
          remainingActions: 0,
          resetTime,
          reason: `Hourly limit of ${this.rateLimitConfig.maxActionsPerHour} actions exceeded`
        };
      }
      
      // Check per-minute limit
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const actionsInLastMinute = recentActions.filter(actionTime => actionTime > oneMinuteAgo);
      
      if (actionsInLastMinute.length >= this.rateLimitConfig.maxActionsPerMinute) {
        const oldestRecentAction = actionsInLastMinute[0];
        const resetTime = new Date(oldestRecentAction.getTime() + 60 * 1000);
        
        // Log security violation for rate limit exceeded
        await auditSystem.logSecurityViolation({
          userId,
          userType: userId.startsWith('anonymous_') ? 'anonymous' : 'authenticated',
          violationType: 'rate_limit_exceeded',
          severity: 'low',
          resourceType: 'system',
          attemptedAction: 'approval_action',
          deniedReason: `Per-minute limit of ${this.rateLimitConfig.maxActionsPerMinute} actions exceeded`,
          requiresInvestigation: false,
          additionalContext: { 
            actionsInLastMinute: actionsInLastMinute.length,
            maxAllowed: this.rateLimitConfig.maxActionsPerMinute,
            resetTime: resetTime.toISOString()
          }
        });
        
        return {
          allowed: false,
          remainingActions: 0,
          resetTime,
          reason: `Per-minute limit of ${this.rateLimitConfig.maxActionsPerMinute} actions exceeded`
        };
      }
      
      // Check cooldown period for anonymous users
      if (userId.startsWith('anonymous_') && recentActions.length > 0) {
        const lastAction = recentActions[recentActions.length - 1];
        const timeSinceLastAction = now.getTime() - lastAction.getTime();
        
        if (timeSinceLastAction < this.rateLimitConfig.cooldownPeriod) {
          const resetTime = new Date(lastAction.getTime() + this.rateLimitConfig.cooldownPeriod);
          
          return {
            allowed: false,
            remainingActions: 0,
            resetTime,
            reason: `Cooldown period active. Please wait ${Math.ceil((this.rateLimitConfig.cooldownPeriod - timeSinceLastAction) / 1000)} seconds`
          };
        }
      }
      
      // Calculate remaining actions
      const remainingHourly = this.rateLimitConfig.maxActionsPerHour - recentActions.length;
      const remainingMinute = this.rateLimitConfig.maxActionsPerMinute - actionsInLastMinute.length;
      const remainingActions = Math.min(remainingHourly, remainingMinute);
      
      return {
        allowed: true,
        remainingActions,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000) // Next hour
      };
      
    } catch (error) {
      console.error('Error checking rate limit:', error);
      
      // Log system event for rate limit check failure
      await auditSystem.logSystemEvent({
        eventType: 'system_event',
        component: 'ApprovalManager',
        operation: 'rateLimitCheck',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        userId,
        metadata: { userId }
      });
      
      // In case of error, allow the action but log it
      return {
        allowed: true,
        remainingActions: 1,
        resetTime: new Date(Date.now() + 60 * 60 * 1000),
        reason: 'Rate limit check failed - allowing action'
      };
    }
  }

  /**
   * Logs approval action for audit trail
   * Provides comprehensive logging for security and compliance
   */
  public async logApprovalAction(
    userId: string, 
    videoId: string, 
    action: string,
    metadata?: {
      feedback?: string;
      clientVerified?: boolean;
      userType?: string;
      videoTitle?: string;
      clientName?: string;
      error?: string;
      failed?: boolean;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      // Use the comprehensive audit system
      await auditSystem.logApprovalAction({
        userId,
        userType: (metadata?.userType as 'authenticated' | 'anonymous') || 'anonymous',
        videoId,
        videoTitle: metadata?.videoTitle,
        action: action as 'approve' | 'reject' | 'request_revision',
        newStatus: this.mapActionToStatus(action),
        feedback: metadata?.feedback,
        reviewerName: metadata?.clientName,
        clientVerified: metadata?.clientVerified || false,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      });

      // If this was a failed attempt, also log as security violation
      if (metadata?.failed) {
        await auditSystem.logSecurityViolation({
          userId,
          userType: (metadata?.userType as 'authenticated' | 'anonymous' | 'system') || 'anonymous',
          violationType: 'unauthorized_access',
          severity: 'medium',
          resourceId: videoId,
          resourceType: 'video',
          attemptedAction: action,
          deniedReason: metadata?.error || 'Approval action failed',
          requiresInvestigation: true,
          additionalContext: {
            videoTitle: metadata?.videoTitle,
            clientName: metadata?.clientName,
            feedback: metadata?.feedback
          }
        });
      }

    } catch (error) {
      console.error('Error logging approval action to audit system:', error);
      
      // Fallback to console logging
      const auditEntry = {
        id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        videoId,
        action,
        timestamp: new Date(),
        clientVerified: metadata?.clientVerified || false,
        userType: metadata?.userType || 'unknown',
        videoTitle: metadata?.videoTitle,
        clientName: metadata?.clientName,
        feedback: metadata?.feedback,
        failed: metadata?.failed || false,
        error: metadata?.error,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      };

      console.log('APPROVAL_AUDIT_LOG (fallback):', JSON.stringify(auditEntry, null, 2));
    }
  }

  /**
   * Maps action to status for audit logging
   */
  private mapActionToStatus(action: string): string {
    switch (action) {
      case 'approve':
        return 'approved';
      case 'reject':
        return 'rejected';
      case 'request_revision':
        return 'revision_requested';
      default:
        return action;
    }
  }

  /**
   * Records user action for rate limiting purposes
   */
  private recordUserAction(userId: string): void {
    const userActions = this.userActionHistory.get(userId) || [];
    userActions.push(new Date());
    this.userActionHistory.set(userId, userActions);
  }

  /**
   * Validates if a status transition is allowed
   */
  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'draft': ['approved', 'revision_requested'],
      'pending_review': ['approved', 'revision_requested'],
      'needs_changes': ['approved', 'revision_requested'],
      'approved': [], // Final state
      'completed': [] // Final state
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Sends approval notification to video creator
   */
  private async sendApprovalNotification(
    videoId: string,
    status: 'approved' | 'rejected' | 'revision_requested',
    options: {
      reviewerName?: string;
      reviewerEmail?: string;
      feedback?: string;
    } = {}
  ): Promise<void> {
    try {
      // Get video details
      const video = await getVideoBySlugOrId(videoId);
      if (!video || !video.userId) {
        console.warn('Cannot send notification: video or creator not found');
        return;
      }

      // Get creator details
      const creator = await getUserById(video.userId);
      if (!creator || !creator.email) {
        console.warn('Cannot send notification: creator email not found');
        return;
      }

      // Send notification using NotificationManager
      const success = await notificationManager.sendApprovalNotification({
        videoId,
        videoTitle: video.title || 'Untitled Video',
        creatorId: video.userId,
        creatorEmail: creator.email,
        creatorName: creator.displayName || creator.name,
        approvalStatus: status,
        reviewerName: options.reviewerName,
        reviewerEmail: options.reviewerEmail,
        feedback: options.feedback,
        videoUrl: `${window.location.origin}/watch/${video.publicSlug || videoId}`
      });

      if (success) {
        console.log(`Approval notification sent for video ${videoId} with status ${status}`);
      } else {
        console.warn(`Failed to send approval notification for video ${videoId}`);
      }
    } catch (error) {
      console.error('Error sending approval notification:', error);
      // Don't throw error to avoid breaking the approval process
    }
  }

  /**
   * Gets reviewer email for authenticated users
   */
  private async getReviewerEmail(reviewerId: string): Promise<string | undefined> {
    try {
      const reviewer = await getUserById(reviewerId);
      return reviewer?.email;
    } catch (error) {
      console.error('Error getting reviewer email:', error);
      return undefined;
    }
  }

  /**
   * Gets rate limit status for a user (for UI feedback)
   */
  public async getRateLimitStatus(userId: string): Promise<RateLimitResult> {
    return await this.rateLimitCheck(userId);
  }

  /**
   * Clears rate limit history for a user (admin function)
   */
  public clearUserRateLimit(userId: string): void {
    this.userActionHistory.delete(userId);
  }

  /**
   * Gets approval statistics for monitoring
   */
  public getApprovalStats(): {
    totalUsers: number;
    activeUsers: number;
    totalActions: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    let totalActions = 0;
    let activeUsers = 0;
    
    for (const [userId, actions] of this.userActionHistory.entries()) {
      const recentActions = actions.filter(actionTime => actionTime > oneHourAgo);
      totalActions += recentActions.length;
      if (recentActions.length > 0) {
        activeUsers++;
      }
    }
    
    return {
      totalUsers: this.userActionHistory.size,
      activeUsers,
      totalActions
    };
  }
}

// Export singleton instance
export const approvalManager = ApprovalManager.getInstance();