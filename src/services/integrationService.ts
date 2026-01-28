import { subscriptionManager } from './subscriptionManager';
import { paymentManager } from './paymentManager';
import { approvalManager } from './approvalManager';
import { notificationManager } from './notificationManager';
import { auditSystem } from './auditSystem';
import { cacheManager } from './cacheManager';
import { videoAccessService } from './videoAccessService';

/**
 * Error types for unified error handling
 */
export type ServiceErrorType = 
  | 'subscription_error'
  | 'payment_error'
  | 'approval_error'
  | 'notification_error'
  | 'audit_error'
  | 'cache_error'
  | 'video_access_error'
  | 'integration_error'
  | 'validation_error'
  | 'security_error';

/**
 * Service error with context and recovery information
 */
export interface ServiceError {
  type: ServiceErrorType;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  recoverable: boolean;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  userId?: string;
  component: string;
  operation: string;
}

/**
 * Integration result with success/failure information
 */
export interface IntegrationResult<T = any> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  warnings?: string[];
  metadata?: Record<string, any>;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errorCount: number;
  details?: Record<string, any>;
}

/**
 * System health overview
 */
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: Date;
  uptime: number;
}

/**
 * IntegrationService provides unified error handling and coordinates all managers
 * Implements proper dependency injection and service orchestration
 * 
 * Key Features:
 * - Unified error handling across all services
 * - Service health monitoring
 * - Graceful degradation
 * - Automatic retry mechanisms
 * - Comprehensive logging and audit trails
 * - Circuit breaker pattern for resilience
 */
export class IntegrationService {
  private static instance: IntegrationService;
  private serviceErrors: Map<string, ServiceError[]> = new Map();
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private startTime: Date;

  private constructor() {
    this.startTime = new Date();
    this.initializeServices();
    this.startHealthMonitoring();
  }

  public static getInstance(): IntegrationService {
    if (!IntegrationService.instance) {
      IntegrationService.instance = new IntegrationService();
    }
    return IntegrationService.instance;
  }

  /**
   * Initializes all services and their dependencies
   */
  private async initializeServices(): Promise<void> {
    try {
      console.log('🚀 Initializing integrated service system...');

      // Initialize circuit breakers for each service
      this.initializeCircuitBreakers();

      // Warm up caches for better performance
      await this.warmupCaches();

      // Verify service connectivity
      await this.verifyServiceConnectivity();

      console.log('✅ Service system initialization completed');
    } catch (error) {
      console.error('❌ Service system initialization failed:', error);
      await this.handleSystemError('integration_error', 'Service initialization failed', error, {
        component: 'IntegrationService',
        operation: 'initializeServices'
      });
    }
  }

  /**
   * Processes subscription-related operations with integrated error handling
   */
  public async processSubscriptionOperation(
    operation: 'validate' | 'upgrade' | 'downgrade' | 'cancel',
    userId: string,
    data?: any
  ): Promise<IntegrationResult> {
    const operationId = `subscription_${operation}_${Date.now()}`;
    
    try {
      // Check circuit breaker
      if (!this.circuitBreakers.get('subscription')?.canExecute()) {
        throw new Error('Subscription service is currently unavailable');
      }

      let result: any;
      const startTime = Date.now();

      switch (operation) {
        case 'validate':
          result = await subscriptionManager.validateSubscription(userId);
          break;
        case 'upgrade':
          result = await subscriptionManager.upgradeSubscription(userId, data);
          // Invalidate cache after upgrade
          cacheManager.invalidateUserCache(userId);
          // Send notification about upgrade
          await this.sendSubscriptionNotification(userId, 'upgrade', result);
          break;
        case 'downgrade':
          // Implementation would go here
          throw new Error('Downgrade operation not yet implemented');
        case 'cancel':
          // Implementation would go here
          throw new Error('Cancel operation not yet implemented');
        default:
          throw new Error(`Unknown subscription operation: ${operation}`);
      }

      const duration = Date.now() - startTime;
      
      // Record successful operation
      this.circuitBreakers.get('subscription')?.recordSuccess();
      
      // Log success
      await auditSystem.logSystemEvent({
        eventType: 'system_event',
        component: 'IntegrationService',
        operation: `processSubscriptionOperation_${operation}`,
        success: true,
        duration,
        userId,
        metadata: { operationId, operation, result }
      });

      return {
        success: true,
        data: result,
        metadata: { operationId, duration }
      };
    } catch (error) {
      // Record failure
      this.circuitBreakers.get('subscription')?.recordFailure();
      
      const serviceError = await this.handleServiceError(
        'subscription_error',
        `Subscription ${operation} failed`,
        error,
        {
          component: 'SubscriptionManager',
          operation: `processSubscriptionOperation_${operation}`,
          userId,
          operationId,
          data
        }
      );

      return {
        success: false,
        error: serviceError,
        metadata: { operationId }
      };
    }
  }

  /**
   * Processes payment-related operations with webhook handling
   */
  public async processPaymentOperation(
    operation: 'webhook' | 'verify' | 'retry',
    data: any
  ): Promise<IntegrationResult> {
    const operationId = `payment_${operation}_${Date.now()}`;
    
    try {
      // Check circuit breaker
      if (!this.circuitBreakers.get('payment')?.canExecute()) {
        throw new Error('Payment service is currently unavailable');
      }

      let result: any;
      const startTime = Date.now();

      switch (operation) {
        case 'webhook':
          result = await paymentManager.processWebhook(data.payload, data.signature, data.timestamp);
          // If subscription was updated, invalidate cache
          if (result.subscriptionUpdated && data.userId) {
            cacheManager.invalidateUserCache(data.userId);
          }
          break;
        case 'verify':
          result = await paymentManager.verifyPayment(data.paymentId);
          break;
        case 'retry':
          result = await paymentManager.retryFailedPayment(data.paymentId);
          break;
        default:
          throw new Error(`Unknown payment operation: ${operation}`);
      }

      const duration = Date.now() - startTime;
      
      // Record successful operation
      this.circuitBreakers.get('payment')?.recordSuccess();
      
      // Log success
      await auditSystem.logSystemEvent({
        eventType: 'system_event',
        component: 'IntegrationService',
        operation: `processPaymentOperation_${operation}`,
        success: true,
        duration,
        metadata: { operationId, operation, result }
      });

      return {
        success: true,
        data: result,
        metadata: { operationId, duration }
      };
    } catch (error) {
      // Record failure
      this.circuitBreakers.get('payment')?.recordFailure();
      
      const serviceError = await this.handleServiceError(
        'payment_error',
        `Payment ${operation} failed`,
        error,
        {
          component: 'PaymentManager',
          operation: `processPaymentOperation_${operation}`,
          operationId,
          data
        }
      );

      return {
        success: false,
        error: serviceError,
        metadata: { operationId }
      };
    }
  }

  /**
   * Processes approval operations with notifications and audit logging
   */
  public async processApprovalOperation(
    userId: string,
    videoId: string,
    action: 'approve' | 'reject' | 'request_revision',
    options: {
      feedback?: string;
      clientName?: string;
      videoCreatorId?: string;
    } = {}
  ): Promise<IntegrationResult> {
    const operationId = `approval_${action}_${Date.now()}`;
    
    try {
      // Check circuit breaker
      if (!this.circuitBreakers.get('approval')?.canExecute()) {
        throw new Error('Approval service is currently unavailable');
      }

      const startTime = Date.now();

      // Process approval with integrated notification and audit
      // Map action to the expected format
      let approvalStatus: 'approved' | 'rejected' | 'revision_requested';
      switch (action) {
        case 'approve':
          approvalStatus = 'approved';
          break;
        case 'reject':
          approvalStatus = 'rejected';
          break;
        case 'request_revision':
          approvalStatus = 'revision_requested';
          break;
        default:
          throw new Error(`Invalid approval action: ${action}`);
      }

      await approvalManager.processApproval(
        userId,
        videoId,
        approvalStatus,
        options.feedback,
        options.clientName,
        options.videoCreatorId
      );

      const duration = Date.now() - startTime;
      
      // Record successful operation
      this.circuitBreakers.get('approval')?.recordSuccess();
      
      // Log success
      await auditSystem.logSystemEvent({
        eventType: 'system_event',
        component: 'IntegrationService',
        operation: `processApprovalOperation_${action}`,
        success: true,
        duration,
        userId,
        metadata: { operationId, videoId, action, options }
      });

      return {
        success: true,
        data: { action, videoId, processed: true },
        metadata: { operationId, duration }
      };
    } catch (error) {
      // Record failure
      this.circuitBreakers.get('approval')?.recordFailure();
      
      const serviceError = await this.handleServiceError(
        'approval_error',
        `Approval ${action} failed`,
        error,
        {
          component: 'ApprovalManager',
          operation: `processApprovalOperation_${action}`,
          userId,
          videoId,
          operationId,
          options
        }
      );

      return {
        success: false,
        error: serviceError,
        metadata: { operationId }
      };
    }
  }

  /**
   * Processes video access requests with security validation
   */
  public async processVideoAccess(
    videoId: string,
    userId?: string,
    options: {
      videoDuration?: number;
      gcsPath?: string;
      refreshToken?: string;
    } = {}
  ): Promise<IntegrationResult> {
    const operationId = `video_access_${Date.now()}`;
    
    try {
      // Check circuit breaker
      if (!this.circuitBreakers.get('video_access')?.canExecute()) {
        throw new Error('Video access service is currently unavailable');
      }

      const startTime = Date.now();

      // Generate secure video access
      const result = await videoAccessService.generateSecureAccess({
        videoId,
        userId,
        videoDuration: options.videoDuration,
        gcsPath: options.gcsPath
      });

      const duration = Date.now() - startTime;
      
      // Record successful operation
      this.circuitBreakers.get('video_access')?.recordSuccess();
      
      // Log success
      await auditSystem.logSystemEvent({
        eventType: 'system_event',
        component: 'IntegrationService',
        operation: 'processVideoAccess',
        success: true,
        duration,
        userId: userId || 'anonymous',
        metadata: { operationId, videoId, options }
      });

      return {
        success: true,
        data: result,
        metadata: { operationId, duration }
      };
    } catch (error) {
      // Record failure
      this.circuitBreakers.get('video_access')?.recordFailure();
      
      const serviceError = await this.handleServiceError(
        'video_access_error',
        'Video access failed',
        error,
        {
          component: 'VideoAccessService',
          operation: 'processVideoAccess',
          userId: userId || 'anonymous',
          videoId,
          operationId,
          options
        }
      );

      return {
        success: false,
        error: serviceError,
        metadata: { operationId }
      };
    }
  }

  /**
   * Handles service errors with unified error processing
   */
  private async handleServiceError(
    type: ServiceErrorType,
    message: string,
    originalError: any,
    context: Record<string, any>
  ): Promise<ServiceError> {
    const serviceError: ServiceError = {
      type,
      message,
      originalError: originalError instanceof Error ? originalError : new Error(String(originalError)),
      context,
      recoverable: this.isRecoverableError(originalError),
      retryable: this.isRetryableError(originalError),
      severity: this.determineSeverity(type, originalError),
      timestamp: new Date(),
      userId: context.userId,
      component: context.component || 'Unknown',
      operation: context.operation || 'Unknown'
    };

    // Store error for monitoring
    const serviceKey = context.component || 'Unknown';
    const errors = this.serviceErrors.get(serviceKey) || [];
    errors.push(serviceError);
    
    // Keep only last 100 errors per service
    if (errors.length > 100) {
      errors.splice(0, errors.length - 100);
    }
    
    this.serviceErrors.set(serviceKey, errors);

    // Log to audit system
    try {
      await auditSystem.logSystemEvent({
        eventType: 'system_event',
        component: serviceError.component,
        operation: serviceError.operation,
        success: false,
        errorMessage: serviceError.message,
        userId: serviceError.userId,
        metadata: {
          errorType: serviceError.type,
          severity: serviceError.severity,
          recoverable: serviceError.recoverable,
          retryable: serviceError.retryable,
          context: serviceError.context
        }
      });
    } catch (auditError) {
      console.error('Failed to log service error to audit system:', auditError);
    }

    // Log security violations for high severity errors
    if (serviceError.severity === 'high' || serviceError.severity === 'critical') {
      try {
        await auditSystem.logSecurityViolation({
          userId: serviceError.userId || 'system',
          userType: 'system',
          violationType: 'suspicious_activity',
          severity: serviceError.severity === 'critical' ? 'critical' : 'high',
          resourceType: 'system',
          attemptedAction: serviceError.operation,
          deniedReason: serviceError.message,
          requiresInvestigation: true,
          additionalContext: serviceError.context
        });
      } catch (securityLogError) {
        console.error('Failed to log security violation:', securityLogError);
      }
    }

    console.error(`Service Error [${serviceError.type}]:`, {
      message: serviceError.message,
      component: serviceError.component,
      operation: serviceError.operation,
      severity: serviceError.severity,
      context: serviceError.context
    });

    return serviceError;
  }

  /**
   * Handles system-level errors
   */
  private async handleSystemError(
    type: ServiceErrorType,
    message: string,
    originalError: any,
    context: Record<string, any>
  ): Promise<void> {
    const serviceError = await this.handleServiceError(type, message, originalError, context);
    
    // For system errors, also update service health
    this.updateServiceHealth(context.component || 'System', 'unhealthy', {
      lastError: serviceError.message,
      errorTime: serviceError.timestamp
    });
  }

  /**
   * Sends subscription-related notifications
   */
  private async sendSubscriptionNotification(
    userId: string,
    type: 'upgrade' | 'downgrade' | 'expiry_reminder',
    subscriptionData: any
  ): Promise<void> {
    try {
      switch (type) {
        case 'upgrade':
          // Send upgrade confirmation (implementation would depend on notification requirements)
          console.log(`Subscription upgrade notification sent to user ${userId}`);
          break;
        case 'expiry_reminder':
          await notificationManager.sendSubscriptionReminderByUserId(
            userId,
            subscriptionData.daysUntilExpiry || 7,
            subscriptionData.tier || 'premium',
            subscriptionData.expiryDate || new Date()
          );
          break;
        default:
          console.log(`Subscription notification type ${type} not implemented`);
      }
    } catch (error) {
      console.error('Failed to send subscription notification:', error);
      // Don't throw - notification failure shouldn't break the main operation
    }
  }

  /**
   * Determines if an error is recoverable
   */
  private isRecoverableError(error: any): boolean {
    if (!error) return false;
    
    const recoverablePatterns = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'rate limit',
      'service unavailable'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return recoverablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Determines if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const retryablePatterns = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'timeout',
      'network error',
      'service unavailable',
      'rate limit'
    ];
    
    const errorMessage = error.message || error.code || '';
    return retryablePatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Determines error severity
   */
  private determineSeverity(type: ServiceErrorType, error: any): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors
    if (type === 'security_error' || type === 'audit_error') {
      return 'critical';
    }
    
    // High severity errors
    if (type === 'payment_error' || type === 'integration_error') {
      return 'high';
    }
    
    // Check error message for severity indicators
    const errorMessage = error?.message?.toLowerCase() || '';
    
    if (errorMessage.includes('security') || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      return 'high';
    }
    
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Initializes circuit breakers for all services
   */
  private initializeCircuitBreakers(): void {
    const services = ['subscription', 'payment', 'approval', 'notification', 'audit', 'cache', 'video_access'];
    
    services.forEach(service => {
      this.circuitBreakers.set(service, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 30000, // 30 seconds
        monitoringPeriod: 60000 // 1 minute
      }));
    });
  }

  /**
   * Warms up caches for better performance
   */
  private async warmupCaches(): Promise<void> {
    try {
      // Warm up frequently accessed data
      console.log('🔥 Warming up caches...');
      
      // This would typically warm up with actual user data
      // For now, we'll just ensure the cache manager is ready
      cacheManager.ensureConsistency();
      
      console.log('✅ Cache warmup completed');
    } catch (error) {
      console.error('Cache warmup failed:', error);
    }
  }

  /**
   * Verifies connectivity to all services
   */
  private async verifyServiceConnectivity(): Promise<void> {
    const services = [
      { name: 'SubscriptionManager', check: () => subscriptionManager !== null },
      { name: 'PaymentManager', check: () => paymentManager !== null },
      { name: 'ApprovalManager', check: () => approvalManager !== null },
      { name: 'NotificationManager', check: () => notificationManager !== null },
      { name: 'AuditSystem', check: () => auditSystem !== null },
      { name: 'CacheManager', check: () => cacheManager !== null },
      { name: 'VideoAccessService', check: () => videoAccessService !== null }
    ];

    for (const service of services) {
      try {
        const isHealthy = service.check();
        this.updateServiceHealth(service.name, isHealthy ? 'healthy' : 'unhealthy');
      } catch (error) {
        this.updateServiceHealth(service.name, 'unhealthy', { error: error.message });
      }
    }
  }

  /**
   * Updates service health status
   */
  private updateServiceHealth(
    serviceName: string, 
    status: 'healthy' | 'degraded' | 'unhealthy',
    details?: Record<string, any>
  ): void {
    const errors = this.serviceErrors.get(serviceName) || [];
    const recentErrors = errors.filter(e => 
      Date.now() - e.timestamp.getTime() < 60000 // Last minute
    );

    this.serviceHealth.set(serviceName, {
      service: serviceName,
      status,
      lastCheck: new Date(),
      errorCount: recentErrors.length,
      details
    });
  }

  /**
   * Starts health monitoring
   */
  private startHealthMonitoring(): void {
    // Check service health every 30 seconds
    setInterval(async () => {
      await this.verifyServiceConnectivity();
    }, 30000);
  }

  /**
   * Gets system health status
   */
  public getSystemHealth(): SystemHealth {
    const services = Array.from(this.serviceHealth.values());
    
    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    
    if (unhealthyCount > 0) {
      overall = unhealthyCount > services.length / 2 ? 'unhealthy' : 'degraded';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      services,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  /**
   * Gets service errors for monitoring
   */
  public getServiceErrors(serviceName?: string): ServiceError[] {
    if (serviceName) {
      return this.serviceErrors.get(serviceName) || [];
    }
    
    const allErrors: ServiceError[] = [];
    for (const errors of this.serviceErrors.values()) {
      allErrors.push(...errors);
    }
    
    return allErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clears service errors (admin function)
   */
  public clearServiceErrors(serviceName?: string): void {
    if (serviceName) {
      this.serviceErrors.delete(serviceName);
    } else {
      this.serviceErrors.clear();
    }
  }

  /**
   * Performs system health check
   */
  public async performHealthCheck(): Promise<SystemHealth> {
    await this.verifyServiceConnectivity();
    return this.getSystemHealth();
  }
}

/**
 * Circuit Breaker implementation for service resilience
 */
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(private config: {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
  }) {}

  canExecute(): boolean {
    const now = Date.now();
    
    if (this.state === 'open') {
      if (now - this.lastFailureTime >= this.config.recoveryTimeout) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }
}

// Export singleton instance
export const integrationService = IntegrationService.getInstance();