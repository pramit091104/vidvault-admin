// Service interfaces for all managers

import { SubscriptionStatus, Subscription, SubscriptionUpgradeOptions, ValidationResult } from './subscription';
import { PaymentTransaction, PaymentResult, RazorpayWebhook, PaymentStatus, RetryConfig } from './payment';
import { AuditEntry, AuditQueryFilters, IntegrityVerificationResult, AuditStatistics } from './audit';
import { VideoAccess, VideoMetadata, ApprovalAction, VideoUrlOptions, VideoAccessViolation, VideoUrlRefreshResult, VideoAccessValidation } from './video';

/**
 * Subscription Manager interface
 */
export interface ISubscriptionManager {
  // Core validation methods
  validateSubscription(userId: string): Promise<SubscriptionStatus>;
  checkExpiry(subscriptionId: string): Promise<boolean>;
  
  // Subscription lifecycle methods
  upgradeSubscription(userId: string, options: SubscriptionUpgradeOptions): Promise<ValidationResult>;
  downgradeExpiredSubscriptions(): Promise<number>;
  renewSubscription(subscriptionId: string, paymentId: string): Promise<ValidationResult>;
  
  // Data integrity methods
  validateBusinessRules(subscription: Subscription): ValidationResult;
  ensureReferentialIntegrity(subscriptionId: string): Promise<ValidationResult>;
  
  // Utility methods
  getSubscriptionById(subscriptionId: string): Promise<Subscription | null>;
  getSubscriptionByUserId(userId: string): Promise<Subscription | null>;
  createSubscription(userId: string, tier: string): Promise<Subscription>;
}

/**
 * Payment Manager interface
 */
export interface IPaymentManager {
  // Webhook processing
  processWebhook(payload: RazorpayWebhook): Promise<PaymentResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  
  // Payment verification and retry
  verifyPayment(paymentId: string): Promise<PaymentStatus>;
  retryFailedPayment(paymentId: string): Promise<PaymentResult>;
  handlePartialPayment(paymentId: string, amount: number): Promise<PaymentResult>;
  
  // Transaction management
  createPaymentTransaction(userId: string, amount: number, subscriptionId: string): Promise<PaymentTransaction>;
  updateTransactionStatus(transactionId: string, status: string, metadata?: Record<string, any>): Promise<void>;
  
  // Configuration
  getRetryConfig(): RetryConfig;
  setRetryConfig(config: RetryConfig): void;
}

/**
 * Approval Manager interface
 */
export interface IApprovalManager {
  // Permission verification
  verifyApprovalPermission(userId: string, videoId: string): Promise<boolean>;
  verifyClientVideoRelationship(userId: string, videoId: string): Promise<boolean>;
  
  // Approval processing
  processApproval(userId: string, videoId: string, action: ApprovalAction): Promise<ValidationResult>;
  submitRevisionRequest(userId: string, videoId: string, feedback: string): Promise<ValidationResult>;
  
  // Rate limiting
  rateLimitCheck(userId: string): Promise<{ allowed: boolean; remainingActions: number; resetTime: Date }>;
  updateRateLimit(userId: string, action: string): Promise<void>;
  
  // Audit logging
  logApprovalAction(action: ApprovalAction): Promise<void>;
  getApprovalHistory(videoId: string): Promise<ApprovalAction[]>;
}

/**
 * Notification Manager interface
 */
export interface INotificationManager {
  // Approval notifications
  sendApprovalNotification(creatorId: string, videoId: string, status: string, feedback?: string): Promise<boolean>;
  sendRevisionRequest(creatorId: string, videoId: string, feedback: string): Promise<boolean>;
  
  // Subscription notifications
  sendSubscriptionReminder(userId: string, daysUntilExpiry: number): Promise<boolean>;
  sendSubscriptionExpiredNotification(userId: string): Promise<boolean>;
  sendPaymentConfirmation(userId: string, paymentId: string, amount: number): Promise<boolean>;
  
  // Notification management
  retryFailedNotifications(): Promise<number>;
  getNotificationStatus(notificationId: string): Promise<{ sent: boolean; attempts: number; lastAttempt: Date }>;
  
  // Configuration
  setNotificationTemplate(type: string, template: string): void;
  getNotificationTemplate(type: string): string | null;
}

/**
 * Cache Manager interface
 */
export interface ICacheManager {
  // Subscription caching
  setSubscriptionCache(userId: string, data: SubscriptionStatus, ttl?: number): Promise<void>;
  getSubscriptionCache(userId: string): Promise<SubscriptionStatus | null>;
  invalidateUserCache(userId: string): Promise<void>;
  
  // General caching
  set(key: string, value: any, ttl?: number): Promise<void>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  
  // Cache management
  warmCache(keys: string[]): Promise<void>;
  ensureConsistency(): Promise<ValidationResult>;
  clearAll(): Promise<void>;
  
  // Statistics
  getCacheStats(): Promise<{ hits: number; misses: number; size: number }>;
}

/**
 * Audit System interface
 */
export interface IAuditSystem {
  // Audit logging
  logApprovalAction(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'checksum'>): Promise<string>;
  logPaymentTransaction(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'checksum'>): Promise<string>;
  logSubscriptionChange(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'checksum'>): Promise<string>;
  logSecurityViolation(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'checksum'>): Promise<string>;
  logSystemEvent(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'checksum'>): Promise<string>;
  
  // Audit querying
  queryAuditLogs(filters: AuditQueryFilters): Promise<AuditEntry[]>;
  getAuditEntry(entryId: string): Promise<AuditEntry | null>;
  
  // Integrity verification
  verifyIntegrity(entryId: string): Promise<IntegrityVerificationResult>;
  verifyAllIntegrity(): Promise<IntegrityVerificationResult[]>;
  
  // Statistics and reporting
  getAuditStatistics(): Promise<AuditStatistics>;
  exportAuditLogs(filters: AuditQueryFilters, format: 'json' | 'csv'): Promise<string>;
  
  // Maintenance
  cleanupOldEntries(retentionDays: number): Promise<number>;
  backupAuditLogs(): Promise<boolean>;
}

/**
 * Video Access Service interface
 */
export interface IVideoAccessService {
  // Access validation
  validateVideoAccess(userId: string, videoId: string): Promise<VideoAccessValidation>;
  checkSubscriptionRequirement(userId: string, videoId: string): Promise<boolean>;
  
  // URL management
  generateSignedUrl(userId: string, videoId: string, options: VideoUrlOptions): Promise<string>;
  refreshVideoUrl(userId: string, videoId: string): Promise<VideoUrlRefreshResult>;
  revokeVideoAccess(userId: string, videoId: string): Promise<void>;
  
  // Access tracking
  logVideoAccess(access: VideoAccess): Promise<void>;
  logAccessViolation(violation: VideoAccessViolation): Promise<void>;
  
  // Video metadata
  getVideoMetadata(videoId: string): Promise<VideoMetadata | null>;
  updateVideoStatus(videoId: string, status: string, userId: string): Promise<void>;
}

/**
 * Integration service interface for wiring all managers together
 */
export interface IIntegrationService {
  // Manager instances
  subscriptionManager: ISubscriptionManager;
  paymentManager: IPaymentManager;
  approvalManager: IApprovalManager;
  notificationManager: INotificationManager;
  cacheManager: ICacheManager;
  auditSystem: IAuditSystem;
  videoAccessService: IVideoAccessService;
  
  // Initialization
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  // Health checks
  healthCheck(): Promise<{ healthy: boolean; services: Record<string, boolean> }>;
  
  // Error handling
  handleError(error: Error, context: string): Promise<void>;
}