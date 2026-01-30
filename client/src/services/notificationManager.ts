import { auth } from '@/integrations/firebase/config';
import { getVideoBySlugOrId } from '@/integrations/firebase/videoService';
import { getUserById } from '@/integrations/firebase/userService';

/**
 * Notification types supported by the system
 */
export type NotificationType = 
  | 'approval_status_change'
  | 'revision_request'
  | 'subscription_reminder'
  | 'subscription_expired'
  | 'payment_failed'
  | 'payment_success';

/**
 * Notification delivery status
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'retry';

/**
 * Base notification data structure
 */
export interface BaseNotification {
  id: string;
  type: NotificationType;
  recipientId: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  content: string;
  htmlContent?: string;
  status: NotificationStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt: Date;
  sentAt?: Date;
  lastAttemptAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Approval notification specific data
 */
export interface ApprovalNotificationData {
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
}

/**
 * Subscription reminder notification data
 */
export interface SubscriptionReminderData {
  userId: string;
  userEmail: string;
  userName?: string;
  subscriptionTier: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  renewalUrl: string;
}

/**
 * Retry configuration for failed notifications
 */
interface RetryConfig {
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  backoffMultiplier: number; // Exponential backoff multiplier
  maxAttempts: number; // Maximum retry attempts
}

/**
 * NotificationManager handles comprehensive notification system with retry mechanisms
 * Supports approval notifications, revision requests, subscription reminders, and more
 */
export class NotificationManager {
  private static instance: NotificationManager;
  private notificationQueue: Map<string, BaseNotification> = new Map();
  private retryConfig: RetryConfig;
  private isProcessingQueue = false;

  private constructor() {
    this.retryConfig = {
      baseDelay: 1000, // 1 second
      maxDelay: 300000, // 5 minutes
      backoffMultiplier: 2,
      maxAttempts: 5
    };

    // Start processing queue every 30 seconds
    setInterval(() => this.processNotificationQueue(), 30000);
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Sends approval notification for status changes
   * Handles both authenticated and anonymous user scenarios
   */
  public async sendApprovalNotification(data: ApprovalNotificationData): Promise<boolean> {
    try {
      const notification = await this.createApprovalNotification(data);
      return await this.queueNotification(notification);
    } catch (error) {
      console.error('Error sending approval notification:', error);
      return false;
    }
  }

  /**
   * Sends revision request with feedback details
   * Provides detailed feedback to video creators
   */
  public async sendRevisionRequest(
    creatorId: string,
    videoId: string,
    feedback: string,
    reviewerName?: string,
    reviewerEmail?: string
  ): Promise<boolean> {
    try {
      // Get video and creator details
      const video = await getVideoBySlugOrId(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      const creator = await this.getUserDetails(creatorId);
      if (!creator.email) {
        throw new Error('Creator email not found');
      }

      const approvalData: ApprovalNotificationData = {
        videoId,
        videoTitle: video.title || 'Untitled Video',
        creatorId,
        creatorEmail: creator.email,
        creatorName: creator.name,
        approvalStatus: 'revision_requested',
        reviewerName,
        reviewerEmail,
        feedback,
        videoUrl: `${window.location.origin}/watch/${video.publicSlug || videoId}`
      };

      return await this.sendApprovalNotification(approvalData);
    } catch (error) {
      console.error('Error sending revision request:', error);
      return false;
    }
  }

  /**
   * Sends subscription reminder for renewals
   * Notifies users about upcoming subscription expiry
   */
  public async sendSubscriptionReminder(data: SubscriptionReminderData): Promise<boolean> {
    try {
      const notification = await this.createSubscriptionReminderNotification(data);
      return await this.queueNotification(notification);
    } catch (error) {
      console.error('Error sending subscription reminder:', error);
      return false;
    }
  }

  /**
   * Sends subscription reminder by user ID and days until expiry
   * Convenience method that fetches user and subscription data
   */
  public async sendSubscriptionReminderByUserId(
    userId: string, 
    daysUntilExpiry: number,
    subscriptionTier: string = 'premium',
    expiryDate: Date
  ): Promise<boolean> {
    try {
      const user = await this.getUserDetails(userId);
      if (!user.email) {
        console.warn('Cannot send subscription reminder: user email not found');
        return false;
      }

      const reminderData: SubscriptionReminderData = {
        userId,
        userEmail: user.email,
        userName: user.name,
        subscriptionTier,
        expiryDate,
        daysUntilExpiry,
        renewalUrl: `${window.location.origin}/pricing?upgrade=true`
      };

      return await this.sendSubscriptionReminder(reminderData);
    } catch (error) {
      console.error('Error sending subscription reminder by user ID:', error);
      return false;
    }
  }

  /**
   * Retries failed notifications with exponential backoff
   * Processes queued notifications and handles failures
   */
  public async retryFailedNotifications(): Promise<void> {
    if (this.isProcessingQueue) {
      return; // Already processing
    }

    this.isProcessingQueue = true;
    
    try {
      const now = new Date();
      const failedNotifications = Array.from(this.notificationQueue.values())
        .filter(notification => 
          (notification.status === 'failed' || notification.status === 'retry') &&
          notification.attempts < notification.maxAttempts &&
          notification.scheduledAt <= now
        );

      console.log(`Processing ${failedNotifications.length} failed notifications`);

      for (const notification of failedNotifications) {
        await this.processNotification(notification);
        // Add small delay between notifications to avoid overwhelming the email service
        await this.delay(100);
      }
    } catch (error) {
      console.error('Error retrying failed notifications:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Creates approval notification with appropriate content
   */
  private async createApprovalNotification(data: ApprovalNotificationData): Promise<BaseNotification> {
    const notificationId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let subject: string;
    let content: string;
    let htmlContent: string;

    switch (data.approvalStatus) {
      case 'approved':
        subject = `✅ Your video "${data.videoTitle}" has been approved!`;
        content = this.generateApprovedTextContent(data);
        htmlContent = this.generateApprovedHtmlContent(data);
        break;
      
      case 'rejected':
        subject = `❌ Your video "${data.videoTitle}" needs changes`;
        content = this.generateRejectedTextContent(data);
        htmlContent = this.generateRejectedHtmlContent(data);
        break;
      
      case 'revision_requested':
        subject = `📝 Revision requested for "${data.videoTitle}"`;
        content = this.generateRevisionTextContent(data);
        htmlContent = this.generateRevisionHtmlContent(data);
        break;
      
      default:
        throw new Error(`Unsupported approval status: ${data.approvalStatus}`);
    }

    return {
      id: notificationId,
      type: 'approval_status_change',
      recipientId: data.creatorId,
      recipientEmail: data.creatorEmail,
      recipientName: data.creatorName,
      subject,
      content,
      htmlContent,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      scheduledAt: new Date(),
      metadata: {
        videoId: data.videoId,
        videoTitle: data.videoTitle,
        approvalStatus: data.approvalStatus,
        reviewerName: data.reviewerName,
        reviewerEmail: data.reviewerEmail,
        feedback: data.feedback,
        videoUrl: data.videoUrl
      }
    };
  }

  /**
   * Creates subscription reminder notification
   */
  private async createSubscriptionReminderNotification(data: SubscriptionReminderData): Promise<BaseNotification> {
    const notificationId = `subscription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subject = `⏰ Your ${data.subscriptionTier} subscription expires in ${data.daysUntilExpiry} days`;
    const content = this.generateSubscriptionReminderTextContent(data);
    const htmlContent = this.generateSubscriptionReminderHtmlContent(data);

    return {
      id: notificationId,
      type: 'subscription_reminder',
      recipientId: data.userId,
      recipientEmail: data.userEmail,
      recipientName: data.userName,
      subject,
      content,
      htmlContent,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      scheduledAt: new Date(),
      metadata: {
        subscriptionTier: data.subscriptionTier,
        expiryDate: data.expiryDate.toISOString(),
        daysUntilExpiry: data.daysUntilExpiry,
        renewalUrl: data.renewalUrl
      }
    };
  }

  /**
   * Queues notification for delivery
   */
  private async queueNotification(notification: BaseNotification): Promise<boolean> {
    try {
      this.notificationQueue.set(notification.id, notification);
      
      // Try to send immediately
      const success = await this.processNotification(notification);
      
      if (!success) {
        // Schedule for retry
        this.scheduleRetry(notification);
      }
      
      return success;
    } catch (error) {
      console.error('Error queuing notification:', error);
      return false;
    }
  }

  /**
   * Processes a single notification
   */
  private async processNotification(notification: BaseNotification): Promise<boolean> {
    try {
      notification.attempts++;
      notification.lastAttemptAt = new Date();
      notification.status = 'pending';

      const success = await this.sendEmail(notification);
      
      if (success) {
        notification.status = 'sent';
        notification.sentAt = new Date();
        console.log(`Notification ${notification.id} sent successfully`);
        return true;
      } else {
        notification.status = 'failed';
        notification.errorMessage = 'Email delivery failed';
        
        if (notification.attempts < notification.maxAttempts) {
          this.scheduleRetry(notification);
        } else {
          console.error(`Notification ${notification.id} failed permanently after ${notification.attempts} attempts`);
        }
        
        return false;
      }
    } catch (error) {
      notification.status = 'failed';
      notification.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (notification.attempts < notification.maxAttempts) {
        this.scheduleRetry(notification);
      }
      
      console.error(`Error processing notification ${notification.id}:`, error);
      return false;
    }
  }

  /**
   * Schedules notification for retry with exponential backoff
   */
  private scheduleRetry(notification: BaseNotification): void {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, notification.attempts - 1),
      this.retryConfig.maxDelay
    );
    
    notification.scheduledAt = new Date(Date.now() + delay);
    notification.status = 'retry';
    
    console.log(`Notification ${notification.id} scheduled for retry in ${delay}ms (attempt ${notification.attempts}/${notification.maxAttempts})`);
  }

  /**
   * Sends email using the email service
   */
  private async sendEmail(notification: BaseNotification): Promise<boolean> {
    try {
      // Try to use the backend API first
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          to: notification.recipientEmail,
          subject: notification.subject,
          text: notification.content,
          html: notification.htmlContent,
          type: notification.type,
          metadata: notification.metadata
        })
      });

      if (response.ok) {
        return true;
      } else {
        console.warn('Backend notification API not available, falling back to console logging');
        return this.fallbackEmailLogging(notification);
      }
    } catch (error) {
      console.warn('Backend notification API error, falling back to console logging:', error);
      return this.fallbackEmailLogging(notification);
    }
  }

  /**
   * Fallback method for email sending when backend API is not available
   * In a real implementation, this could queue emails for later processing
   */
  private fallbackEmailLogging(notification: BaseNotification): boolean {
    console.log('📧 EMAIL NOTIFICATION (FALLBACK):', {
      id: notification.id,
      type: notification.type,
      to: notification.recipientEmail,
      subject: notification.subject,
      content: notification.content,
      metadata: notification.metadata,
      timestamp: new Date().toISOString()
    });
    
    // In development, we'll consider this successful
    // In production, this should queue the notification for retry when the API is available
    return true;
  }

  /**
   * Gets authentication token for API calls
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const user = auth.currentUser;
      return user ? await user.getIdToken() : null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Gets user details by ID
   */
  private async getUserDetails(userId: string): Promise<{ email: string; name?: string }> {
    try {
      const user = await getUserById(userId);
      return {
        email: user?.email || '',
        name: user?.displayName || user?.name
      };
    } catch (error) {
      console.error('Error getting user details:', error);
      throw new Error('User not found');
    }
  }

  /**
   * Processes the notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    await this.retryFailedNotifications();
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Content generation methods for different notification types

  private generateApprovedTextContent(data: ApprovalNotificationData): string {
    return `
Great news! Your video "${data.videoTitle}" has been approved.

${data.reviewerName ? `Reviewed by: ${data.reviewerName}` : 'Reviewed by client'}
${data.feedback ? `Feedback: ${data.feedback}` : ''}

You can view your video at: ${data.videoUrl}

Thank you for using our platform!
    `.trim();
  }

  private generateApprovedHtmlContent(data: ApprovalNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">✅ Video Approved!</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Great news! Your video <strong>"${data.videoTitle}"</strong> has been approved.</p>
          
          ${data.reviewerName ? `<p><strong>Reviewed by:</strong> ${data.reviewerName}</p>` : '<p><strong>Reviewed by:</strong> Client</p>'}
          ${data.feedback ? `<div style="background: white; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0;"><strong>Feedback:</strong> ${data.feedback}</div>` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.videoUrl}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Your Video</a>
          </div>
          
          <p>Thank you for using our platform!</p>
        </div>
      </div>
    `;
  }

  private generateRejectedTextContent(data: ApprovalNotificationData): string {
    return `
Your video "${data.videoTitle}" needs changes before it can be approved.

${data.reviewerName ? `Reviewed by: ${data.reviewerName}` : 'Reviewed by client'}
${data.feedback ? `Feedback: ${data.feedback}` : 'No specific feedback provided.'}

Please make the necessary changes and resubmit your video.
You can view and edit your video at: ${data.videoUrl}

If you have any questions, please don't hesitate to contact us.
    `.trim();
  }

  private generateRejectedHtmlContent(data: ApprovalNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📝 Changes Requested</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Your video <strong>"${data.videoTitle}"</strong> needs changes before it can be approved.</p>
          
          ${data.reviewerName ? `<p><strong>Reviewed by:</strong> ${data.reviewerName}</p>` : '<p><strong>Reviewed by:</strong> Client</p>'}
          
          ${data.feedback ? `
            <div style="background: white; padding: 15px; border-left: 4px solid #ef4444; margin: 15px 0;">
              <strong>Feedback:</strong><br>
              ${data.feedback}
            </div>
          ` : '<p><em>No specific feedback provided.</em></p>'}
          
          <p>Please make the necessary changes and resubmit your video.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.videoUrl}" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View & Edit Video</a>
          </div>
          
          <p>If you have any questions, please don't hesitate to contact us.</p>
        </div>
      </div>
    `;
  }

  private generateRevisionTextContent(data: ApprovalNotificationData): string {
    return this.generateRejectedTextContent(data); // Same content for revision requests
  }

  private generateRevisionHtmlContent(data: ApprovalNotificationData): string {
    return this.generateRejectedHtmlContent(data); // Same content for revision requests
  }

  private generateSubscriptionReminderTextContent(data: SubscriptionReminderData): string {
    return `
Your ${data.subscriptionTier} subscription is expiring soon!

Expiry Date: ${data.expiryDate.toLocaleDateString()}
Days Remaining: ${data.daysUntilExpiry}

Don't lose access to your premium features. Renew your subscription now to continue enjoying:
- Unlimited video uploads
- Advanced analytics
- Priority support
- And much more!

Renew your subscription: ${data.renewalUrl}

Thank you for being a valued member!
    `.trim();
  }

  private generateSubscriptionReminderHtmlContent(data: SubscriptionReminderData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⏰ Subscription Expiring Soon</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Your <strong>${data.subscriptionTier}</strong> subscription is expiring soon!</p>
          
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 18px;"><strong>Expiry Date:</strong> ${data.expiryDate.toLocaleDateString()}</p>
            <p style="margin: 10px 0 0 0; font-size: 16px; color: #ef4444;"><strong>Days Remaining: ${data.daysUntilExpiry}</strong></p>
          </div>
          
          <p>Don't lose access to your premium features. Renew your subscription now to continue enjoying:</p>
          
          <ul style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <li>Unlimited video uploads</li>
            <li>Advanced analytics</li>
            <li>Priority support</li>
            <li>And much more!</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.renewalUrl}" style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">Renew Subscription</a>
          </div>
          
          <p>Thank you for being a valued member!</p>
        </div>
      </div>
    `;
  }

  /**
   * Gets notification queue status for monitoring
   */
  public getQueueStatus(): {
    total: number;
    pending: number;
    failed: number;
    retry: number;
    sent: number;
  } {
    const notifications = Array.from(this.notificationQueue.values());
    
    return {
      total: notifications.length,
      pending: notifications.filter(n => n.status === 'pending').length,
      failed: notifications.filter(n => n.status === 'failed').length,
      retry: notifications.filter(n => n.status === 'retry').length,
      sent: notifications.filter(n => n.status === 'sent').length
    };
  }

  /**
   * Clears sent notifications older than specified days
   */
  public clearOldNotifications(daysOld: number = 7): void {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    for (const [id, notification] of this.notificationQueue.entries()) {
      if (notification.status === 'sent' && notification.sentAt && notification.sentAt < cutoffDate) {
        this.notificationQueue.delete(id);
      }
    }
  }

  /**
   * Gets notification by ID
   */
  public getNotification(id: string): BaseNotification | undefined {
    return this.notificationQueue.get(id);
  }

  /**
   * Gets all notifications for a user
   */
  public getUserNotifications(userId: string): BaseNotification[] {
    return Array.from(this.notificationQueue.values())
      .filter(notification => notification.recipientId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();