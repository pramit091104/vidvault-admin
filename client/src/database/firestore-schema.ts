// Firestore schema definitions for audit and tracking collections

import { Timestamp } from 'firebase/firestore';

/**
 * Firestore collection schemas for the audit system
 */

// Audit entries collection schema
export interface FirestoreAuditEntry {
  id: string;
  timestamp: Timestamp;
  userId?: string;
  userType: 'authenticated' | 'anonymous' | 'system';
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  checksum: string;
  type: 'approval_action' | 'payment_transaction' | 'subscription_change' | 'security_violation' | 'system_event';
  
  // Approval action fields
  videoId?: string;
  videoTitle?: string;
  action?: 'approve' | 'reject' | 'request_revision';
  previousStatus?: string;
  newStatus?: string;
  feedback?: string;
  reviewerName?: string;
  reviewerEmail?: string;
  clientVerified?: boolean;
  rateLimitRemaining?: number;
  rateLimitResetTime?: Timestamp;
  
  // Payment transaction fields
  transactionId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'partial';
  subscriptionId?: string;
  subscriptionTier?: string;
  webhookReceived?: boolean;
  retryCount?: number;
  failureReason?: string;
  integrityCheckPassed?: boolean;
  
  // Subscription change fields
  changeType?: 'create' | 'upgrade' | 'downgrade' | 'cancel' | 'expire' | 'renew' | 'auto_downgrade' | 'integrity_update';
  beforeState?: {
    tier: string;
    status: string;
    expiryDate?: Timestamp;
    uploadCount: number;
    maxUploads: number;
    clientsUsed: number;
    maxClients: number;
  };
  afterState?: {
    tier: string;
    status: string;
    expiryDate?: Timestamp;
    uploadCount: number;
    maxUploads: number;
    clientsUsed: number;
    maxClients: number;
  };
  preservedData?: boolean;
  paymentId?: string;
  changeReason?: string;
  
  // Security violation fields
  violationType?: 'unauthorized_access' | 'rate_limit_exceeded' | 'invalid_signature' | 'permission_denied' | 'suspicious_activity' | 'data_integrity_failure';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  resourceId?: string;
  resourceType?: 'video' | 'subscription' | 'payment' | 'user' | 'system';
  attemptedAction?: string;
  deniedReason?: string;
  requiresInvestigation?: boolean;
  
  // System event fields
  eventType?: 'cache_invalidation' | 'batch_process' | 'notification_sent' | 'webhook_processed' | 'data_migration' | 'backup_created' | 'system_event';
  component?: string;
  operation?: string;
  success?: boolean;
  duration?: number;
  recordsAffected?: number;
  errorMessage?: string;
  
  // Generic metadata
  metadata?: Record<string, any>;
}

// Enhanced subscriptions collection schema
export interface FirestoreSubscription {
  id: string;
  userId: string;
  tier: 'free' | 'premium' | 'enterprise';
  status: 'active' | 'expired' | 'cancelled';
  startDate: Timestamp;
  expiryDate?: Timestamp;
  uploadCount: number;
  maxUploads: number;
  maxClients: number;
  clientsUsed: number;
  maxFileSize: number;
  features: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Audit fields
  createdBy?: string;
  updatedBy?: string;
  version: number;
}

// Enhanced payment transactions collection schema
export interface FirestorePaymentTransaction {
  id: string;
  userId: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'partial';
  subscriptionId?: string;
  webhookReceived: boolean;
  retryCount: number;
  failureReason?: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  
  // Audit fields
  createdBy?: string;
  updatedBy?: string;
  version: number;
}

// Video access logs collection schema
export interface FirestoreVideoAccessLog {
  id: string;
  videoId: string;
  userId?: string;
  signedUrlHash: string;
  expiryTime: Timestamp;
  accessGranted: Timestamp;
  subscriptionTierRequired: 'free' | 'premium' | 'enterprise';
  subscriptionVerified: boolean;
  accessType: 'view' | 'download' | 'stream';
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

// Video access violations collection schema
export interface FirestoreVideoAccessViolation {
  id: string;
  videoId: string;
  userId?: string;
  violationType: 'unauthorized_access' | 'expired_url' | 'invalid_subscription' | 'rate_limit_exceeded' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Timestamp;
  ipAddress?: string;
  userAgent?: string;
  additionalContext?: Record<string, any>;
}

// Approval actions collection schema
export interface FirestoreApprovalAction {
  id: string;
  videoId: string;
  userId?: string;
  userType: 'authenticated' | 'anonymous';
  action: 'approve' | 'reject' | 'request_revision';
  status: 'approved' | 'rejected' | 'revision_requested';
  feedback?: string;
  timestamp: Timestamp;
  clientVerified: boolean;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  
  // Rate limiting fields
  rateLimitKey?: string;
  rateLimitCount?: number;
  rateLimitWindowStart?: Timestamp;
}

// Notification queue collection schema
export interface FirestoreNotificationQueue {
  id: string;
  userId: string;
  type: 'approval_status' | 'revision_request' | 'subscription_reminder' | 'subscription_expired' | 'payment_confirmation';
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  recipientEmail: string;
  subject: string;
  body: string;
  templateData?: Record<string, any>;
  attempts: number;
  maxAttempts: number;
  nextAttempt?: Timestamp;
  createdAt: Timestamp;
  sentAt?: Timestamp;
  errorMessage?: string;
}

// Cache invalidations collection schema
export interface FirestoreCacheInvalidation {
  id: string;
  cacheKey: string;
  invalidationType: 'user_subscription' | 'video_access' | 'payment_status' | 'manual' | 'system';
  triggeredBy?: string;
  reason?: string;
  timestamp: Timestamp;
}

/**
 * Firestore collection names
 */
export const FIRESTORE_COLLECTIONS = {
  AUDIT_ENTRIES: 'auditEntries',
  SUBSCRIPTIONS: 'subscriptions',
  PAYMENT_TRANSACTIONS: 'paymentTransactions',
  VIDEO_ACCESS_LOGS: 'videoAccessLogs',
  VIDEO_ACCESS_VIOLATIONS: 'videoAccessViolations',
  APPROVAL_ACTIONS: 'approvalActions',
  NOTIFICATION_QUEUE: 'notificationQueue',
  CACHE_INVALIDATIONS: 'cacheInvalidations',
} as const;

/**
 * Firestore indexes configuration
 */
export const FIRESTORE_INDEXES = [
  // Audit entries indexes
  {
    collectionGroup: 'auditEntries',
    fields: [
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: 'type', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'auditEntries',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'auditEntries',
    fields: [
      { fieldPath: 'severity', order: 'ASCENDING' },
      { fieldPath: 'requiresInvestigation', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' }
    ]
  },
  
  // Subscriptions indexes
  {
    collectionGroup: 'subscriptions',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'subscriptions',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'expiryDate', order: 'ASCENDING' }
    ]
  },
  
  // Payment transactions indexes
  {
    collectionGroup: 'paymentTransactions',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'paymentTransactions',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  
  // Video access logs indexes
  {
    collectionGroup: 'videoAccessLogs',
    fields: [
      { fieldPath: 'videoId', order: 'ASCENDING' },
      { fieldPath: 'accessGranted', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'videoAccessLogs',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'accessGranted', order: 'DESCENDING' }
    ]
  },
  
  // Notification queue indexes
  {
    collectionGroup: 'notificationQueue',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'nextAttempt', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'notificationQueue',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  }
];

/**
 * Firestore security rules helpers
 */
export const FIRESTORE_SECURITY_RULES = {
  // Helper functions for security rules
  isAuthenticated: 'request.auth != null',
  isOwner: 'request.auth.uid == resource.data.userId',
  isAdmin: 'request.auth.token.admin == true',
  
  // Collection-specific rules
  auditEntries: {
    read: 'request.auth.token.admin == true',
    write: false, // Audit entries should only be written by server-side code
  },
  
  subscriptions: {
    read: 'request.auth.uid == resource.data.userId || request.auth.token.admin == true',
    write: 'request.auth.token.admin == true', // Only admin or server can modify subscriptions
  },
  
  paymentTransactions: {
    read: 'request.auth.uid == resource.data.userId || request.auth.token.admin == true',
    write: 'request.auth.token.admin == true', // Only admin or server can modify payments
  },
  
  videoAccessLogs: {
    read: 'request.auth.token.admin == true',
    write: false, // Only server-side code should write access logs
  },
  
  approvalActions: {
    read: 'request.auth.uid == resource.data.userId || request.auth.token.admin == true',
    write: 'request.auth != null', // Authenticated users can create approval actions
  },
  
  notificationQueue: {
    read: 'request.auth.token.admin == true',
    write: false, // Only server-side code should manage notifications
  }
};