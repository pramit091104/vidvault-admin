// Browser-compatible crypto utilities
const createBrowserHmac = async (algorithm: string, key: string, data: string): Promise<string> => {
  try {
    // Use Web Crypto API for browser compatibility
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(data);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: algorithm === 'sha256' ? 'SHA-256' : 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.warn('Web Crypto API not available, using fallback hash');
    // Fallback to a simple hash for development/testing
    return btoa(key + data).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }
};

import {
  AuditEntry,
  ApprovalAuditEntry,
  PaymentAuditEntry,
  SubscriptionAuditEntry,
  SecurityViolationEntry,
  SystemEventEntry,
  AuditQueryFilters,
  IntegrityVerificationResult,
  AuditStorageConfig,
  AuditStatistics,
  BatchAuditResult
} from '@/types/audit';

/**
 * AuditSystem provides comprehensive logging for all approval actions, payment transactions,
 * subscription changes, and security violations with tamper-proof storage and integrity verification.
 * 
 * Key Features:
 * - Comprehensive logging with complete context
 * - Tamper-proof storage with integrity verification
 * - Security violation tracking
 * - Audit trail for compliance
 * - Performance monitoring
 */
export class AuditSystem {
  private static instance: AuditSystem;
  private auditStorage: Map<string, AuditEntry> = new Map();
  private config: AuditStorageConfig;
  private secretKey: string;

  private constructor() {
    this.config = {
      enableTamperProofing: true,
      checksumAlgorithm: 'sha256',
      encryptionEnabled: false, // Can be enabled for sensitive environments
      compressionEnabled: false,
      retentionPeriodDays: 2555, // ~7 years for compliance
      backupEnabled: true,
      replicationEnabled: false
    };

    // In production, this should come from secure environment variables
    // Use a safe environment variable getter that works in both browser and Node.js
    const getSecretKey = (): string => {
      // Try Vite environment first (browser)
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUDIT_SECRET_KEY) {
        return import.meta.env.VITE_AUDIT_SECRET_KEY;
      }
      
      // Try Node.js environment (server/build)
      if (typeof process !== 'undefined' && process.env?.AUDIT_SECRET_KEY) {
        return process.env.AUDIT_SECRET_KEY;
      }
      
      return 'default-audit-key-change-in-production';
    };
    
    this.secretKey = getSecretKey();
    
    if (this.secretKey === 'default-audit-key-change-in-production') {
      console.warn('⚠️ Using default audit secret key. Change AUDIT_SECRET_KEY in production!');
    }

    // Start periodic integrity verification
    this.startIntegrityVerification();
  }

  public static getInstance(): AuditSystem {
    if (!AuditSystem.instance) {
      AuditSystem.instance = new AuditSystem();
    }
    return AuditSystem.instance;
  }

  /**
   * Logs approval actions with complete context
   * Captures user identity, video details, action type, and security context
   */
  public async logApprovalAction(data: {
    userId: string;
    userType: 'authenticated' | 'anonymous';
    videoId: string;
    videoTitle?: string;
    action: 'approve' | 'reject' | 'request_revision';
    previousStatus?: string;
    newStatus: string;
    feedback?: string;
    reviewerName?: string;
    reviewerEmail?: string;
    clientVerified: boolean;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    rateLimitStatus?: {
      remainingActions: number;
      resetTime: Date;
    };
  }): Promise<string> {
    try {
      const auditEntry: ApprovalAuditEntry = {
        id: this.generateAuditId('approval'),
        type: 'approval_action',
        timestamp: new Date(),
        userId: data.userId,
        userType: data.userType,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        checksum: '', // Will be calculated below
        videoId: data.videoId,
        videoTitle: data.videoTitle,
        action: data.action,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        feedback: data.feedback,
        reviewerName: data.reviewerName,
        reviewerEmail: data.reviewerEmail,
        clientVerified: data.clientVerified,
        rateLimitStatus: data.rateLimitStatus
      };

      // Calculate tamper-proof checksum
      auditEntry.checksum = await this.calculateChecksum(auditEntry);

      // Store the audit entry
      await this.storeAuditEntry(auditEntry);

      console.log(`✅ Approval action logged: ${auditEntry.id}`);
      return auditEntry.id;
    } catch (error) {
      console.error('Error logging approval action:', error);
      
      // Log the failure as a system event
      await this.logSystemEvent({
        eventType: 'system_event',
        component: 'AuditSystem',
        operation: 'logApprovalAction',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { originalData: data }
      });
      
      throw new Error(`Failed to log approval action: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Logs payment transactions for payment audit trail
   * Captures complete payment context including Razorpay details and integrity checks
   */
  public async logPaymentTransaction(data: {
    userId: string;
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
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    try {
      const auditEntry: PaymentAuditEntry = {
        id: this.generateAuditId('payment'),
        type: 'payment_transaction',
        timestamp: new Date(),
        userId: data.userId,
        userType: 'authenticated', // Payment transactions are always from authenticated users
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        checksum: '', // Will be calculated below
        transactionId: data.transactionId,
        razorpayPaymentId: data.razorpayPaymentId,
        razorpayOrderId: data.razorpayOrderId,
        amount: data.amount,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentStatus,
        subscriptionId: data.subscriptionId,
        subscriptionTier: data.subscriptionTier,
        webhookReceived: data.webhookReceived,
        retryCount: data.retryCount,
        failureReason: data.failureReason,
        integrityCheckPassed: data.integrityCheckPassed,
        metadata: data.metadata
      };

      // Calculate tamper-proof checksum
      auditEntry.checksum = await this.calculateChecksum(auditEntry);

      // Store the audit entry
      await this.storeAuditEntry(auditEntry);

      console.log(`✅ Payment transaction logged: ${auditEntry.id}`);
      return auditEntry.id;
    } catch (error) {
      console.error('Error logging payment transaction:', error);
      
      // Log the failure as a system event
      await this.logSystemEvent({
        eventType: 'system_event',
        component: 'AuditSystem',
        operation: 'logPaymentTransaction',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { originalData: data }
      });
      
      throw new Error(`Failed to log payment transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Logs subscription changes with before/after states
   * Captures complete subscription state transitions for compliance
   */
  public async logSubscriptionChange(data: {
    userId: string;
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
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<string> {
    try {
      const auditEntry: SubscriptionAuditEntry = {
        id: this.generateAuditId('subscription'),
        type: 'subscription_change',
        timestamp: new Date(),
        userId: data.userId,
        userType: 'authenticated', // Subscription changes are typically from authenticated users
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        checksum: '', // Will be calculated below
        subscriptionId: data.subscriptionId,
        changeType: data.changeType,
        beforeState: data.beforeState,
        afterState: data.afterState,
        preservedData: data.preservedData,
        paymentId: data.paymentId,
        reason: data.reason
      };

      // Calculate tamper-proof checksum
      auditEntry.checksum = await this.calculateChecksum(auditEntry);

      // Store the audit entry
      await this.storeAuditEntry(auditEntry);

      console.log(`✅ Subscription change logged: ${auditEntry.id}`);
      return auditEntry.id;
    } catch (error) {
      console.error('Error logging subscription change:', error);
      
      // Log the failure as a system event
      await this.logSystemEvent({
        eventType: 'system_event',
        component: 'AuditSystem',
        operation: 'logSubscriptionChange',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { originalData: data }
      });
      
      throw new Error(`Failed to log subscription change: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Logs security violations for security incidents
   * Captures security-related events for investigation and monitoring
   */
  public async logSecurityViolation(data: {
    userId: string;
    userType: 'authenticated' | 'anonymous' | 'system';
    violationType: 'unauthorized_access' | 'rate_limit_exceeded' | 'invalid_signature' | 'permission_denied' | 'suspicious_activity' | 'data_integrity_failure';
    severity: 'low' | 'medium' | 'high' | 'critical';
    resourceId?: string;
    resourceType?: 'video' | 'subscription' | 'payment' | 'user' | 'system';
    attemptedAction?: string;
    deniedReason: string;
    additionalContext?: Record<string, any>;
    requiresInvestigation: boolean;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<string> {
    try {
      const auditEntry: SecurityViolationEntry = {
        id: this.generateAuditId('security'),
        type: 'security_violation',
        timestamp: new Date(),
        userId: data.userId,
        userType: data.userType,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        checksum: '', // Will be calculated below
        violationType: data.violationType,
        severity: data.severity,
        resourceId: data.resourceId,
        resourceType: data.resourceType,
        attemptedAction: data.attemptedAction,
        deniedReason: data.deniedReason,
        additionalContext: data.additionalContext,
        requiresInvestigation: data.requiresInvestigation
      };

      // Calculate tamper-proof checksum
      auditEntry.checksum = await this.calculateChecksum(auditEntry);

      // Store the audit entry
      await this.storeAuditEntry(auditEntry);

      // Log to console with appropriate severity
      const logLevel = data.severity === 'critical' || data.severity === 'high' ? 'error' : 'warn';
      console[logLevel](`🚨 Security violation logged: ${auditEntry.id} [${data.severity.toUpperCase()}]`);
      
      // For critical violations, also log to system events
      if (data.severity === 'critical') {
        await this.logSystemEvent({
          eventType: 'system_event',
          component: 'SecurityMonitor',
          operation: 'criticalViolationDetected',
          success: true,
          metadata: { violationId: auditEntry.id, severity: data.severity }
        });
      }

      return auditEntry.id;
    } catch (error) {
      console.error('Error logging security violation:', error);
      
      // This is critical - if we can't log security violations, we have a serious problem
      console.error('🚨 CRITICAL: Failed to log security violation - audit system compromised!');
      
      throw new Error(`Failed to log security violation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Logs system events for operational monitoring
   */
  public async logSystemEvent(data: {
    eventType: 'cache_invalidation' | 'batch_process' | 'notification_sent' | 'webhook_processed' | 'data_migration' | 'backup_created' | 'system_event';
    component: string;
    operation: string;
    success: boolean;
    duration?: number;
    recordsAffected?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<string> {
    try {
      const auditEntry: SystemEventEntry = {
        id: this.generateAuditId('system'),
        type: 'system_event',
        timestamp: new Date(),
        userId: data.userId || 'system',
        userType: 'system',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        checksum: '', // Will be calculated below
        eventType: data.eventType,
        component: data.component,
        operation: data.operation,
        success: data.success,
        duration: data.duration,
        recordsAffected: data.recordsAffected,
        errorMessage: data.errorMessage,
        metadata: data.metadata
      };

      // Calculate tamper-proof checksum
      auditEntry.checksum = await this.calculateChecksum(auditEntry);

      // Store the audit entry
      await this.storeAuditEntry(auditEntry);

      return auditEntry.id;
    } catch (error) {
      // For system events, we can't recursively log failures, so just console.error
      console.error('Error logging system event:', error);
      throw new Error(`Failed to log system event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verifies the integrity of an audit entry
   * Checks if the entry has been tampered with since creation
   */
  public async verifyIntegrity(entryId: string): Promise<IntegrityVerificationResult> {
    try {
      const entry = this.auditStorage.get(entryId);
      if (!entry) {
        return {
          isValid: false,
          entryId,
          expectedChecksum: '',
          actualChecksum: '',
          tampered: true,
          verificationTimestamp: new Date()
        };
      }

      const expectedChecksum = entry.checksum;
      const entryWithoutChecksum = { ...entry, checksum: '' };
      const actualChecksum = await this.calculateChecksum(entryWithoutChecksum);

      const isValid = expectedChecksum === actualChecksum;

      return {
        isValid,
        entryId,
        expectedChecksum,
        actualChecksum,
        tampered: !isValid,
        verificationTimestamp: new Date()
      };
    } catch (error) {
      console.error('Error verifying audit entry integrity:', error);
      return {
        isValid: false,
        entryId,
        expectedChecksum: '',
        actualChecksum: '',
        tampered: true,
        verificationTimestamp: new Date()
      };
    }
  }

  /**
   * Queries audit entries with filtering support
   */
  public async queryAuditEntries(filters: AuditQueryFilters = {}): Promise<AuditEntry[]> {
    try {
      let entries = Array.from(this.auditStorage.values());

      // Apply filters
      if (filters.userId) {
        entries = entries.filter(entry => entry.userId === filters.userId);
      }

      if (filters.type) {
        entries = entries.filter(entry => entry.type === filters.type);
      }

      if (filters.startDate) {
        entries = entries.filter(entry => entry.timestamp >= filters.startDate!);
      }

      if (filters.endDate) {
        entries = entries.filter(entry => entry.timestamp <= filters.endDate!);
      }

      if (filters.resourceId) {
        entries = entries.filter(entry => {
          if (entry.type === 'approval_action') {
            return (entry as ApprovalAuditEntry).videoId === filters.resourceId;
          }
          if (entry.type === 'payment_transaction') {
            return (entry as PaymentAuditEntry).transactionId === filters.resourceId;
          }
          if (entry.type === 'subscription_change') {
            return (entry as SubscriptionAuditEntry).subscriptionId === filters.resourceId;
          }
          if (entry.type === 'security_violation') {
            return (entry as SecurityViolationEntry).resourceId === filters.resourceId;
          }
          return false;
        });
      }

      if (filters.severity) {
        entries = entries.filter(entry => {
          if (entry.type === 'security_violation') {
            return (entry as SecurityViolationEntry).severity === filters.severity;
          }
          return false;
        });
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      if (filters.offset) {
        entries = entries.slice(filters.offset);
      }

      if (filters.limit) {
        entries = entries.slice(0, filters.limit);
      }

      return entries;
    } catch (error) {
      console.error('Error querying audit entries:', error);
      return [];
    }
  }

  /**
   * Gets audit statistics for monitoring and reporting
   */
  public async getAuditStatistics(): Promise<AuditStatistics> {
    try {
      const entries = Array.from(this.auditStorage.values());
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Count entries by type
      const entriesByType: Record<string, number> = {};
      const entriesByUser: Record<string, number> = {};
      let securityViolationsTotal = 0;
      const securityViolationsBySeverity: Record<string, number> = {};
      let recentSecurityViolations = 0;

      for (const entry of entries) {
        // Count by type
        entriesByType[entry.type] = (entriesByType[entry.type] || 0) + 1;

        // Count by user
        entriesByUser[entry.userId] = (entriesByUser[entry.userId] || 0) + 1;

        // Count security violations
        if (entry.type === 'security_violation') {
          const securityEntry = entry as SecurityViolationEntry;
          securityViolationsTotal++;
          securityViolationsBySeverity[securityEntry.severity] = 
            (securityViolationsBySeverity[securityEntry.severity] || 0) + 1;

          if (entry.timestamp >= oneDayAgo) {
            recentSecurityViolations++;
          }
        }
      }

      // Verify integrity of a sample of entries
      const sampleSize = Math.min(100, entries.length);
      const sampleEntries = entries.slice(0, sampleSize);
      let verifiedCount = 0;
      let failedCount = 0;

      for (const entry of sampleEntries) {
        const verification = await this.verifyIntegrity(entry.id);
        if (verification.isValid) {
          verifiedCount++;
        } else {
          failedCount++;
        }
      }

      // Calculate storage metrics
      const timestamps = entries.map(e => e.timestamp);
      const oldestEntry = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : new Date();
      const newestEntry = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : new Date();
      
      // Estimate storage size (rough calculation)
      const totalSizeBytes = entries.reduce((size, entry) => {
        return size + JSON.stringify(entry).length * 2; // Rough estimate including overhead
      }, 0);

      return {
        totalEntries: entries.length,
        entriesByType,
        entriesByUser,
        securityViolations: {
          total: securityViolationsTotal,
          bySeverity: securityViolationsBySeverity,
          recent: recentSecurityViolations
        },
        integrityStatus: {
          verified: verifiedCount,
          failed: failedCount,
          pending: entries.length - sampleSize
        },
        storageMetrics: {
          totalSizeBytes,
          oldestEntry,
          newestEntry
        }
      };
    } catch (error) {
      console.error('Error getting audit statistics:', error);
      throw new Error(`Failed to get audit statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Performs batch integrity verification
   */
  public async performBatchIntegrityCheck(): Promise<BatchAuditResult> {
    const startTime = Date.now();
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      const entries = Array.from(this.auditStorage.values());

      for (const entry of entries) {
        try {
          const verification = await this.verifyIntegrity(entry.id);
          processedCount++;
          
          if (!verification.isValid) {
            failedCount++;
            errors.push(`Entry ${entry.id} failed integrity check`);
            
            // Log security violation for tampered entries
            await this.logSecurityViolation({
              userId: 'system',
              userType: 'system',
              violationType: 'data_integrity_failure',
              severity: 'high',
              resourceId: entry.id,
              resourceType: 'system',
              attemptedAction: 'integrity_verification',
              deniedReason: 'Audit entry checksum mismatch - possible tampering',
              requiresInvestigation: true,
              additionalContext: {
                expectedChecksum: verification.expectedChecksum,
                actualChecksum: verification.actualChecksum
              }
            });
          }
        } catch (error) {
          failedCount++;
          errors.push(`Error verifying entry ${entry.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: failedCount === 0,
        processedCount,
        failedCount,
        errors,
        duration,
        timestamp: new Date()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        processedCount,
        failedCount: failedCount + 1,
        errors: [...errors, `Batch integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        duration,
        timestamp: new Date()
      };
    }
  }

  /**
   * Generates a unique audit ID
   */
  private generateAuditId(type: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${type}_${timestamp}_${random}`;
  }

  /**
   * Calculates tamper-proof checksum for an audit entry
   */
  private async calculateChecksum(entry: Partial<AuditEntry>): Promise<string> {
    try {
      // Create a deterministic string representation of the entry
      const entryWithoutChecksum = { ...entry };
      delete entryWithoutChecksum.checksum;
      
      // Sort keys to ensure consistent ordering
      const sortedEntry = this.sortObjectKeys(entryWithoutChecksum);
      const entryString = JSON.stringify(sortedEntry);
      
      // Use browser-compatible HMAC
      return await createBrowserHmac(this.config.checksumAlgorithm, this.secretKey, entryString);
    } catch (error) {
      console.error('Error calculating checksum:', error);
      throw new Error('Failed to calculate audit entry checksum');
    }
  }

  /**
   * Recursively sorts object keys for consistent serialization
   */
  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: any = {};
    
    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObjectKeys(obj[key]);
    }
    
    return sortedObj;
  }

  /**
   * Stores an audit entry with tamper-proof measures
   */
  private async storeAuditEntry(entry: AuditEntry): Promise<void> {
    try {
      // In a production environment, this would write to a secure database
      // with encryption, replication, and backup capabilities
      this.auditStorage.set(entry.id, entry);

      // Log storage success
      console.log(`📝 Audit entry stored: ${entry.id} [${entry.type}]`);

      // In production, trigger backup/replication here
      if (this.config.backupEnabled) {
        await this.triggerBackup(entry);
      }
    } catch (error) {
      console.error('Error storing audit entry:', error);
      throw new Error('Failed to store audit entry');
    }
  }

  /**
   * Triggers backup for audit entry (placeholder for production implementation)
   */
  private async triggerBackup(entry: AuditEntry): Promise<void> {
    // In production, this would trigger backup to secure storage
    console.log(`🔄 Backup triggered for audit entry: ${entry.id}`);
  }

  /**
   * Starts periodic integrity verification
   */
  private startIntegrityVerification(): void {
    // Run integrity check every hour
    setInterval(async () => {
      try {
        console.log('🔍 Starting periodic integrity verification...');
        const result = await this.performBatchIntegrityCheck();
        
        if (result.success) {
          console.log(`✅ Integrity verification completed: ${result.processedCount} entries verified`);
        } else {
          console.error(`❌ Integrity verification failed: ${result.failedCount} failures out of ${result.processedCount} entries`);
        }
      } catch (error) {
        console.error('Error in periodic integrity verification:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Gets audit entry by ID
   */
  public getAuditEntry(entryId: string): AuditEntry | undefined {
    return this.auditStorage.get(entryId);
  }

  /**
   * Gets audit configuration
   */
  public getConfiguration(): AuditStorageConfig {
    return { ...this.config };
  }

  /**
   * Updates audit configuration (admin function)
   */
  public updateConfiguration(newConfig: Partial<AuditStorageConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Audit configuration updated:', newConfig);
  }

  /**
   * Clears old audit entries based on retention policy
   */
  public async cleanupOldEntries(): Promise<BatchAuditResult> {
    const startTime = Date.now();
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      const cutoffDate = new Date(Date.now() - this.config.retentionPeriodDays * 24 * 60 * 60 * 1000);
      const entries = Array.from(this.auditStorage.entries());

      for (const [id, entry] of entries) {
        try {
          if (entry.timestamp < cutoffDate) {
            this.auditStorage.delete(id);
            processedCount++;
          }
        } catch (error) {
          failedCount++;
          errors.push(`Error cleaning up entry ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const duration = Date.now() - startTime;

      await this.logSystemEvent({
        eventType: 'system_event',
        component: 'AuditSystem',
        operation: 'cleanupOldEntries',
        success: failedCount === 0,
        duration,
        recordsAffected: processedCount,
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined
      });

      return {
        success: failedCount === 0,
        processedCount,
        failedCount,
        errors,
        duration,
        timestamp: new Date()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        processedCount,
        failedCount: failedCount + 1,
        errors: [...errors, `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        duration,
        timestamp: new Date()
      };
    }
  }
}

// Export singleton instance
export const auditSystem = AuditSystem.getInstance();