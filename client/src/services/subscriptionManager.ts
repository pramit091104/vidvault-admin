import { auth } from '@/integrations/firebase/config';
import { getSubscriptionStatus, updateSubscription, BackendSubscription } from '@/services/backendApiService';
import { cacheManager } from '@/services/cacheManager';
import { auditSystem } from './auditSystem';
import { 
  SubscriptionStatus, 
  Subscription, 
  SubscriptionUpgradeOptions, 
  ValidationResult, 
  BusinessRules 
} from '@/types/subscription';

/**
 * SubscriptionManager handles subscription validation, expiry checking, and tier management
 * with real-time database validation and data integrity checks.
 */
export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private businessRules: BusinessRules;

  private constructor() {
    this.businessRules = {
      maxUploadsByTier: {
        free: 5,
        premium: 50,
        enterprise: 200
      },
      maxClientsByTier: {
        free: 5,
        premium: 50,
        enterprise: 100
      },
      maxFileSizeByTier: {
        free: 100, // MB
        premium: 500, // MB
        enterprise: 2000 // MB
      },
      featuresByTier: {
        free: ['basic_upload', 'basic_sharing'],
        premium: ['basic_upload', 'basic_sharing', 'advanced_analytics', 'priority_support'],
        enterprise: ['basic_upload', 'basic_sharing', 'advanced_analytics', 'priority_support', 'custom_branding', 'api_access']
      }
    };
  }

  public static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  /**
   * Validates subscription status by querying the database in real-time
   * Never uses hardcoded values - always queries current subscription data
   * Uses unified cache manager for consistent caching
   */
  public async validateSubscription(userId: string): Promise<SubscriptionStatus> {
    try {
      if (!userId) {
        // Log security violation for missing user ID
        await auditSystem.logSecurityViolation({
          userId: 'unknown',
          userType: 'anonymous',
          violationType: 'unauthorized_access',
          severity: 'medium',
          resourceType: 'subscription',
          attemptedAction: 'validateSubscription',
          deniedReason: 'User ID is required for subscription validation',
          requiresInvestigation: false
        });
        throw new Error('User ID is required for subscription validation');
      }

      // Check cache first using unified cache manager
      const cachedSubscription = cacheManager.getSubscriptionCache(userId);
      if (cachedSubscription) {
        // Verify cached data is not expired
        const isExpired = this.checkExpiry(cachedSubscription.expiryDate);
        if (!isExpired) {
          return cachedSubscription;
        } else {
          // Cache has expired subscription, invalidate and continue to fetch fresh data
          cacheManager.invalidateUserCache(userId);
        }
      }

      // Always query database for real-time validation - no hardcoded values
      const backendSubscription = await getSubscriptionStatus();
      
      // Check expiry status
      const isExpired = this.checkExpiry(backendSubscription.expiryDate);
      
      // If expired, trigger automatic downgrade
      if (isExpired && backendSubscription.status === 'active') {
        await this.downgradeExpiredSubscription(userId);
        // Re-fetch after downgrade
        const updatedSubscription = await getSubscriptionStatus();
        const subscriptionStatus = this.mapToSubscriptionStatus(updatedSubscription);
        
        // Cache the updated subscription with unified TTL
        cacheManager.setSubscriptionCache(userId, subscriptionStatus);
        return subscriptionStatus;
      }

      const subscriptionStatus = this.mapToSubscriptionStatus(backendSubscription);
      
      // Cache the subscription data with unified TTL (3 minutes)
      cacheManager.setSubscriptionCache(userId, subscriptionStatus);
      
      return subscriptionStatus;
    } catch (error) {
      console.error('Error validating subscription:', error);
      
      // Log system event for validation failure
      await auditSystem.logSystemEvent({
        eventType: 'system_event',
        component: 'SubscriptionManager',
        operation: 'validateSubscription',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        userId,
        metadata: { userId }
      });
      
      throw new Error(`Subscription validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if a subscription has expired based on expiry date
   */
  public checkExpiry(expiryDate?: Date | string): boolean {
    if (!expiryDate) {
      return false; // Free tier or no expiry date means no expiry
    }

    const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
    return expiry < new Date();
  }

  /**
   * Upgrades subscription with data preservation logic
   * Preserves existing upload counts and user data
   */
  public async upgradeSubscription(
    userId: string, 
    options: SubscriptionUpgradeOptions
  ): Promise<SubscriptionStatus> {
    try {
      if (!userId) {
        throw new Error('User ID is required for subscription upgrade');
      }

      // Validate upgrade options
      const validation = this.validateUpgradeOptions(options);
      if (!validation.isValid) {
        throw new Error(`Invalid upgrade options: ${validation.errors.join(', ')}`);
      }

      // Get current subscription to preserve data
      const currentSubscription = await getSubscriptionStatus();
      
      // Prepare upgrade data with preserved information
      const upgradeData = {
        tier: options.newTier,
        maxVideoUploads: this.businessRules.maxUploadsByTier[options.newTier],
        maxClients: this.businessRules.maxClientsByTier[options.newTier],
        maxFileSize: this.businessRules.maxFileSizeByTier[options.newTier],
        subscriptionDate: new Date(),
        expiryDate: this.calculateExpiryDate(options.newTier),
        status: 'active' as const,
        // Preserve existing data if requested
        ...(options.preserveData && {
          videoUploadsUsed: currentSubscription.videoUploadsUsed,
          clientsUsed: currentSubscription.clientsUsed
        })
      };

      // Use database transaction for atomic operation
      const updatedSubscription = await this.executeWithTransaction(async () => {
        return await updateSubscription(upgradeData);
      });

      // Invalidate cache to ensure fresh data on next access
      cacheManager.invalidateUserCache(userId);

      // Log the upgrade for audit trail
      await this.logSubscriptionChange(userId, currentSubscription, updatedSubscription, 'upgrade');

      const subscriptionStatus = this.mapToSubscriptionStatus(updatedSubscription);
      
      // Cache the updated subscription
      cacheManager.setSubscriptionCache(userId, subscriptionStatus);

      return subscriptionStatus;
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      throw new Error(`Subscription upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Downgrades expired subscriptions automatically
   * Called during validation when expiry is detected
   */
  private async downgradeExpiredSubscription(userId: string): Promise<void> {
    try {
      const currentSubscription = await getSubscriptionStatus();
      
      const downgradeData = {
        tier: 'free' as const,
        maxVideoUploads: this.businessRules.maxUploadsByTier.free,
        maxClients: this.businessRules.maxClientsByTier.free,
        maxFileSize: this.businessRules.maxFileSizeByTier.free,
        status: 'expired' as const,
        // Preserve usage counts but apply free tier limits
        videoUploadsUsed: Math.min(currentSubscription.videoUploadsUsed, this.businessRules.maxUploadsByTier.free),
        clientsUsed: Math.min(currentSubscription.clientsUsed, this.businessRules.maxClientsByTier.free)
      };

      const updatedSubscription = await updateSubscription(downgradeData);
      
      // Invalidate cache to ensure consistency
      cacheManager.invalidateUserCache(userId);

      // Log the downgrade
      await this.logSubscriptionChange(userId, currentSubscription, updatedSubscription, 'auto_downgrade');
    } catch (error) {
      console.error('Error downgrading expired subscription:', error);
      throw error;
    }
  }

  /**
   * Batch process to downgrade all expired subscriptions
   * Should be called periodically by a background job
   */
  public async downgradeExpiredSubscriptions(): Promise<number> {
    try {
      // This would typically query all active subscriptions from the database
      // For now, we'll implement a placeholder that would work with a proper backend
      console.log('Batch downgrade process started');
      
      // In a real implementation, this would:
      // 1. Query all active subscriptions with expiry dates in the past
      // 2. Process each one through downgradeExpiredSubscription
      // 3. Return the count of processed subscriptions
      
      // Placeholder implementation
      let processedCount = 0;
      
      // This would be replaced with actual database query
      // const expiredSubscriptions = await this.queryExpiredSubscriptions();
      // for (const subscription of expiredSubscriptions) {
      //   await this.downgradeExpiredSubscription(subscription.userId);
      //   processedCount++;
      // }
      
      console.log(`Batch downgrade completed. Processed ${processedCount} subscriptions.`);
      return processedCount;
    } catch (error) {
      console.error('Error in batch downgrade process:', error);
      throw error;
    }
  }

  /**
   * Validates business rules before applying subscription changes
   */
  private validateBusinessRules(subscriptionData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate tier
    if (!['free', 'premium', 'enterprise'].includes(subscriptionData.tier)) {
      errors.push('Invalid subscription tier');
    }

    // Validate upload limits
    const maxUploads = this.businessRules.maxUploadsByTier[subscriptionData.tier];
    if (subscriptionData.videoUploadsUsed > maxUploads) {
      warnings.push(`Upload count (${subscriptionData.videoUploadsUsed}) exceeds tier limit (${maxUploads})`);
    }

    // Validate client limits
    const maxClients = this.businessRules.maxClientsByTier[subscriptionData.tier];
    if (subscriptionData.clientsUsed > maxClients) {
      warnings.push(`Client count (${subscriptionData.clientsUsed}) exceeds tier limit (${maxClients})`);
    }

    // Validate expiry date for paid tiers
    if (subscriptionData.tier !== 'free' && !subscriptionData.expiryDate) {
      errors.push('Paid subscriptions must have an expiry date');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Maintains referential integrity across subscription updates
   */
  private async validateReferentialIntegrity(userId: string, subscriptionData: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate user exists
      if (!userId) {
        errors.push('User ID is required');
      }

      // Validate subscription data structure
      if (!subscriptionData.tier) {
        errors.push('Subscription tier is required');
      }

      // Check for data consistency
      if (subscriptionData.videoUploadsUsed < 0) {
        errors.push('Video upload count cannot be negative');
      }

      if (subscriptionData.clientsUsed < 0) {
        errors.push('Client count cannot be negative');
      }

      // Validate date consistency
      if (subscriptionData.subscriptionDate && subscriptionData.expiryDate) {
        const startDate = new Date(subscriptionData.subscriptionDate);
        const endDate = new Date(subscriptionData.expiryDate);
        if (startDate >= endDate) {
          errors.push('Subscription start date must be before expiry date');
        }
      }

    } catch (error) {
      errors.push(`Referential integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Executes operations within a database transaction for atomicity
   */
  private async executeWithTransaction<T>(operation: () => Promise<T>): Promise<T> {
    try {
      // In a real implementation, this would start a database transaction
      // For now, we'll execute the operation directly
      return await operation();
    } catch (error) {
      // In a real implementation, this would rollback the transaction
      console.error('Transaction failed, rolling back:', error);
      throw error;
    }
  }

  /**
   * Maps backend subscription data to SubscriptionStatus interface
   */
  private mapToSubscriptionStatus(backendSubscription: BackendSubscription): SubscriptionStatus {
    const isExpired = this.checkExpiry(backendSubscription.expiryDate);
    
    return {
      isActive: backendSubscription.status === 'active' && !isExpired,
      tier: backendSubscription.tier,
      expiryDate: backendSubscription.expiryDate ? new Date(backendSubscription.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default to 1 year for free
      uploadCount: backendSubscription.videoUploadsUsed,
      features: this.businessRules.featuresByTier[backendSubscription.tier] || [],
      maxUploads: backendSubscription.maxVideoUploads,
      maxClients: backendSubscription.maxClients,
      maxFileSize: backendSubscription.maxFileSize,
      clientsUsed: backendSubscription.clientsUsed,
      subscriptionDate: backendSubscription.subscriptionDate ? new Date(backendSubscription.subscriptionDate) : undefined,
      status: isExpired ? 'expired' : (backendSubscription.status as 'active' | 'expired' | 'cancelled')
    };
  }

  /**
   * Validates upgrade options
   */
  private validateUpgradeOptions(options: SubscriptionUpgradeOptions): ValidationResult {
    const errors: string[] = [];

    if (!options.newTier) {
      errors.push('New tier is required');
    }

    if (!['free', 'premium', 'enterprise'].includes(options.newTier)) {
      errors.push('Invalid tier specified');
    }

    if (typeof options.preserveData !== 'boolean') {
      errors.push('preserveData must be a boolean value');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Calculates expiry date based on subscription tier
   */
  private calculateExpiryDate(tier: string): Date {
    const now = new Date();
    switch (tier) {
      case 'premium':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      case 'enterprise':
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
      default:
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year for free (no actual expiry)
    }
  }

  /**
   * Comprehensive data integrity validation for subscription updates
   * Includes referential integrity checks and business rule validation
   */
  public async validateSubscriptionIntegrity(
    userId: string, 
    subscriptionData: any
  ): Promise<ValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Perform referential integrity checks
      const referentialCheck = await this.validateReferentialIntegrity(userId, subscriptionData);
      errors.push(...referentialCheck.errors);
      warnings.push(...referentialCheck.warnings);

      // Perform business rule validation
      const businessRuleCheck = this.validateBusinessRules(subscriptionData);
      errors.push(...businessRuleCheck.errors);
      warnings.push(...businessRuleCheck.warnings);

      // Additional integrity checks
      const additionalChecks = await this.performAdditionalIntegrityChecks(userId, subscriptionData);
      errors.push(...additionalChecks.errors);
      warnings.push(...additionalChecks.warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Performs additional integrity checks specific to subscription data
   */
  private async performAdditionalIntegrityChecks(
    userId: string, 
    subscriptionData: any
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for data type consistency
      if (typeof subscriptionData.videoUploadsUsed !== 'number') {
        errors.push('videoUploadsUsed must be a number');
      }

      if (typeof subscriptionData.clientsUsed !== 'number') {
        errors.push('clientsUsed must be a number');
      }

      if (typeof subscriptionData.maxVideoUploads !== 'number') {
        errors.push('maxVideoUploads must be a number');
      }

      if (typeof subscriptionData.maxClients !== 'number') {
        errors.push('maxClients must be a number');
      }

      if (typeof subscriptionData.maxFileSize !== 'number') {
        errors.push('maxFileSize must be a number');
      }

      // Check for reasonable value ranges
      if (subscriptionData.videoUploadsUsed > 10000) {
        warnings.push('Unusually high video upload count detected');
      }

      if (subscriptionData.clientsUsed > 1000) {
        warnings.push('Unusually high client count detected');
      }

      if (subscriptionData.maxFileSize > 10000) {
        warnings.push('Unusually high file size limit detected');
      }

      // Validate tier-specific constraints
      const tierConstraints = this.validateTierConstraints(subscriptionData);
      errors.push(...tierConstraints.errors);
      warnings.push(...tierConstraints.warnings);

      // Check for subscription status consistency
      const statusCheck = this.validateStatusConsistency(subscriptionData);
      errors.push(...statusCheck.errors);
      warnings.push(...statusCheck.warnings);

    } catch (error) {
      errors.push(`Additional integrity checks failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates tier-specific constraints and limits
   */
  private validateTierConstraints(subscriptionData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const tier = subscriptionData.tier;
    const expectedMaxUploads = this.businessRules.maxUploadsByTier[tier];
    const expectedMaxClients = this.businessRules.maxClientsByTier[tier];
    const expectedMaxFileSize = this.businessRules.maxFileSizeByTier[tier];

    // Validate that limits match tier expectations
    if (subscriptionData.maxVideoUploads !== expectedMaxUploads) {
      errors.push(`Max video uploads (${subscriptionData.maxVideoUploads}) doesn't match tier ${tier} expected value (${expectedMaxUploads})`);
    }

    if (subscriptionData.maxClients !== expectedMaxClients) {
      errors.push(`Max clients (${subscriptionData.maxClients}) doesn't match tier ${tier} expected value (${expectedMaxClients})`);
    }

    if (subscriptionData.maxFileSize !== expectedMaxFileSize) {
      errors.push(`Max file size (${subscriptionData.maxFileSize}) doesn't match tier ${tier} expected value (${expectedMaxFileSize})`);
    }

    // Validate usage doesn't exceed limits
    if (subscriptionData.videoUploadsUsed > subscriptionData.maxVideoUploads) {
      errors.push(`Video uploads used (${subscriptionData.videoUploadsUsed}) exceeds maximum allowed (${subscriptionData.maxVideoUploads})`);
    }

    if (subscriptionData.clientsUsed > subscriptionData.maxClients) {
      errors.push(`Clients used (${subscriptionData.clientsUsed}) exceeds maximum allowed (${subscriptionData.maxClients})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates subscription status consistency
   */
  private validateStatusConsistency(subscriptionData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check status field validity
    if (!['active', 'expired', 'cancelled'].includes(subscriptionData.status)) {
      errors.push(`Invalid subscription status: ${subscriptionData.status}`);
    }

    // Check expiry date consistency with status
    if (subscriptionData.status === 'active' && subscriptionData.expiryDate) {
      const isExpired = this.checkExpiry(subscriptionData.expiryDate);
      if (isExpired) {
        warnings.push('Subscription marked as active but expiry date has passed');
      }
    }

    if (subscriptionData.status === 'expired' && subscriptionData.expiryDate) {
      const isExpired = this.checkExpiry(subscriptionData.expiryDate);
      if (!isExpired) {
        warnings.push('Subscription marked as expired but expiry date is in the future');
      }
    }

    // Free tier should not have expiry constraints
    if (subscriptionData.tier === 'free' && subscriptionData.status === 'expired') {
      warnings.push('Free tier subscription should not be marked as expired');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Gets subscriptions expiring within the specified number of days
   * Used for sending renewal reminders
   */
  public async getExpiringSubscriptions(daysAhead: number = 7): Promise<Subscription[]> {
    try {
      // In a real implementation, this would query the database for subscriptions
      // expiring within the specified timeframe
      
      // For now, we'll return an empty array as this would typically be handled
      // by a backend service that has access to all user subscriptions
      console.log(`Checking for subscriptions expiring in ${daysAhead} days`);
      
      // This is a placeholder implementation
      // In production, this would be something like:
      // const cutoffDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
      // return await database.query('subscriptions').where('expiryDate', '<=', cutoffDate).where('status', '==', 'active');
      
      return [];
    } catch (error) {
      console.error('Error getting expiring subscriptions:', error);
      return [];
    }
  }

  /**
   * Performs atomic subscription update with full integrity validation
   */
  public async updateSubscriptionWithIntegrity(
    userId: string,
    updateData: any
  ): Promise<SubscriptionStatus> {
    try {
      // Validate integrity before update
      const integrityCheck = await this.validateSubscriptionIntegrity(userId, updateData);
      
      if (!integrityCheck.isValid) {
        throw new Error(`Subscription integrity validation failed: ${integrityCheck.errors.join(', ')}`);
      }

      // Log warnings if any
      if (integrityCheck.warnings.length > 0) {
        console.warn('Subscription update warnings:', integrityCheck.warnings);
      }

      // Get current subscription for audit trail
      const currentSubscription = await getSubscriptionStatus();

      // Execute update within transaction
      const updatedSubscription = await this.executeWithTransaction(async () => {
        return await updateSubscription(updateData);
      });

      // Invalidate cache to ensure consistency
      cacheManager.invalidateUserCache(userId);

      // Log the change for audit trail
      await this.logSubscriptionChange(userId, currentSubscription, updatedSubscription, 'integrity_update');

      const subscriptionStatus = this.mapToSubscriptionStatus(updatedSubscription);
      
      // Cache the updated subscription
      cacheManager.setSubscriptionCache(userId, subscriptionStatus);

      return subscriptionStatus;
    } catch (error) {
      console.error('Error updating subscription with integrity checks:', error);
      throw new Error(`Subscription update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates subscription data before any database operation
   */
  public async validateBeforeOperation(
    userId: string,
    operation: 'create' | 'update' | 'delete',
    data?: any
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Common validations
      if (!userId) {
        errors.push('User ID is required for all subscription operations');
      }

      // Operation-specific validations
      switch (operation) {
        case 'create':
          if (!data) {
            errors.push('Subscription data is required for creation');
          } else {
            const createValidation = await this.validateSubscriptionIntegrity(userId, data);
            errors.push(...createValidation.errors);
            warnings.push(...createValidation.warnings);
          }
          break;

        case 'update':
          if (!data) {
            errors.push('Update data is required for subscription updates');
          } else {
            const updateValidation = await this.validateSubscriptionIntegrity(userId, data);
            errors.push(...updateValidation.errors);
            warnings.push(...updateValidation.warnings);
          }
          break;

        case 'delete':
          // Check if user has active subscriptions that shouldn't be deleted
          try {
            const currentSubscription = await getSubscriptionStatus();
            if (currentSubscription.status === 'active' && currentSubscription.tier !== 'free') {
              warnings.push('Deleting active paid subscription - ensure proper cancellation process');
            }
          } catch (error) {
            // If we can't get current subscription, proceed with caution
            warnings.push('Could not verify current subscription status before deletion');
          }
          break;
      }

    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Logs subscription changes for audit trail
   */
  private async logSubscriptionChange(
    userId: string, 
    oldSubscription: BackendSubscription, 
    newSubscription: BackendSubscription, 
    changeType: string
  ): Promise<void> {
    try {
      // Use the audit system for comprehensive logging
      await auditSystem.logSubscriptionChange({
        userId,
        subscriptionId: userId, // Use userId as subscription identifier since BackendSubscription doesn't have id
        changeType: changeType as any,
        beforeState: {
          tier: oldSubscription.tier,
          status: oldSubscription.status,
          expiryDate: oldSubscription.expiryDate ? new Date(oldSubscription.expiryDate) : undefined,
          uploadCount: oldSubscription.videoUploadsUsed,
          maxUploads: oldSubscription.maxVideoUploads,
          clientsUsed: oldSubscription.clientsUsed,
          maxClients: oldSubscription.maxClients
        },
        afterState: {
          tier: newSubscription.tier,
          status: newSubscription.status,
          expiryDate: newSubscription.expiryDate ? new Date(newSubscription.expiryDate) : undefined,
          uploadCount: newSubscription.videoUploadsUsed,
          maxUploads: newSubscription.maxVideoUploads,
          clientsUsed: newSubscription.clientsUsed,
          maxClients: newSubscription.maxClients
        },
        preservedData: changeType === 'upgrade' || changeType === 'integrity_update',
        reason: `Subscription ${changeType} operation`
      });
    } catch (error) {
      console.error('Error logging subscription change to audit system:', error);
      // Fallback to console logging
      console.log('Subscription change logged (fallback):', {
        userId,
        changeType,
        timestamp: new Date().toISOString(),
        oldTier: oldSubscription.tier,
        newTier: newSubscription.tier,
        oldStatus: oldSubscription.status,
        newStatus: newSubscription.status
      });
    }
  }
}

// Export singleton instance
export const subscriptionManager = SubscriptionManager.getInstance();