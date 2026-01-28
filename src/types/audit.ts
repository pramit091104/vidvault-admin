// Audit system types for comprehensive logging and tamper-proof storage

/**
 * Base audit entry interface
 */
export interface BaseAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userType: 'authenticated' | 'anonymous' | 'system';
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  checksum: string; // For tamper-proof verification
}

/**
 * Approval action audit entry
 */
export interface ApprovalAuditEntry extends BaseAuditEntry {
  type: 'approval_action';
  videoId: string;
  videoTitle?: string;
  action: 'approve' | 'reject' | 'request_revision';
  previousStatus?: string;
  newStatus: string;
  feedback?: string;
  reviewerName?: string;
  reviewerEmail?: string;
  clientVerified: boolean;
  rateLimitStatus?: {
    remainingActions: number;
    resetTime: Date;
  };
}

/**
 * Payment transaction audit entry
 */
export interface PaymentAuditEntry extends BaseAuditEntry {
  type: 'payment_transaction';
  transactionId: string;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'partial';
  subscriptionId?: string;
  subscriptionTier?: string;
  webhookReceived: boolean;
  retryCount: number;
  failureReason?: string;
  integrityCheckPassed: boolean;
  metadata?: Record<string, any>;
}

/**
 * Subscription change audit entry
 */
export interface SubscriptionAuditEntry extends BaseAuditEntry {
  type: 'subscription_change';
  subscriptionId?: string;
  changeType: 'create' | 'upgrade' | 'downgrade' | 'cancel' | 'expire' | 'renew' | 'auto_downgrade' | 'integrity_update';
  beforeState: {
    tier: string;
    status: string;
    expiryDate?: Date;
    uploadCount: number;
    maxUploads: number;
    clientsUsed: number;
    maxClients: number;
  };
  afterState: {
    tier: string;
    status: string;
    expiryDate?: Date;
    uploadCount: number;
    maxUploads: number;
    clientsUsed: number;
    maxClients: number;
  };
  preservedData: boolean;
  paymentId?: string;
  reason?: string;
}

/**
 * Security violation audit entry
 */
export interface SecurityViolationEntry extends BaseAuditEntry {
  type: 'security_violation';
  violationType: 'unauthorized_access' | 'rate_limit_exceeded' | 'invalid_signature' | 'permission_denied' | 'suspicious_activity' | 'data_integrity_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  resourceId?: string;
  resourceType?: 'video' | 'subscription' | 'payment' | 'user' | 'system';
  attemptedAction?: string;
  deniedReason: string;
  additionalContext?: Record<string, any>;
  requiresInvestigation: boolean;
}

/**
 * System event audit entry
 */
export interface SystemEventEntry extends BaseAuditEntry {
  type: 'system_event';
  eventType: 'cache_invalidation' | 'batch_process' | 'notification_sent' | 'webhook_processed' | 'data_migration' | 'backup_created' | 'system_event';
  component: string;
  operation: string;
  success: boolean;
  duration?: number; // in milliseconds
  recordsAffected?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Union type for all audit entries
 */
export type AuditEntry = 
  | ApprovalAuditEntry 
  | PaymentAuditEntry 
  | SubscriptionAuditEntry 
  | SecurityViolationEntry 
  | SystemEventEntry;

/**
 * Audit query filters
 */
export interface AuditQueryFilters {
  userId?: string;
  type?: AuditEntry['type'];
  startDate?: Date;
  endDate?: Date;
  resourceId?: string;
  severity?: SecurityViolationEntry['severity'];
  limit?: number;
  offset?: number;
}

/**
 * Audit integrity verification result
 */
export interface IntegrityVerificationResult {
  isValid: boolean;
  entryId: string;
  expectedChecksum: string;
  actualChecksum: string;
  tampered: boolean;
  verificationTimestamp: Date;
}

/**
 * Audit storage configuration
 */
export interface AuditStorageConfig {
  enableTamperProofing: boolean;
  checksumAlgorithm: 'sha256' | 'sha512';
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  retentionPeriodDays: number;
  backupEnabled: boolean;
  replicationEnabled: boolean;
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  totalEntries: number;
  entriesByType: Record<string, number>;
  entriesByUser: Record<string, number>;
  securityViolations: {
    total: number;
    bySeverity: Record<string, number>;
    recent: number; // Last 24 hours
  };
  integrityStatus: {
    verified: number;
    failed: number;
    pending: number;
  };
  storageMetrics: {
    totalSizeBytes: number;
    oldestEntry: Date;
    newestEntry: Date;
  };
}

/**
 * Audit export format
 */
export interface AuditExportOptions {
  format: 'json' | 'csv' | 'xml';
  filters: AuditQueryFilters;
  includeMetadata: boolean;
  includeChecksums: boolean;
  compression: boolean;
}

/**
 * Batch audit operation result
 */
export interface BatchAuditResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}