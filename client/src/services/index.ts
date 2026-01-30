// Main application service - primary interface for frontend
export { applicationService, ApplicationService } from './applicationService';

// Integration service - coordinates all managers
export { integrationService, IntegrationService } from './integrationService';
export type { 
  ServiceError, 
  ServiceErrorType, 
  IntegrationResult, 
  ServiceHealth, 
  SystemHealth 
} from './integrationService';

// Individual service managers
export { subscriptionManager, SubscriptionManager } from './subscriptionManager';
export { paymentManager, PaymentManager } from './paymentManager';
export { approvalManager, ApprovalManager } from './approvalManager';
export { notificationManager, NotificationManager } from './notificationManager';
export { auditSystem, AuditSystem } from './auditSystem';
export { cacheManager, CacheManager } from './cacheManager';
export { videoAccessService, VideoAccessService } from './videoAccessService';

// Type exports for better TypeScript support
export type { SubscriptionStatus } from '@/types/subscription';
export type { SecureVideoAccess, VideoAccessRequest } from './videoAccessService';
export type { 
  NotificationType, 
  NotificationStatus, 
  ApprovalNotificationData,
  SubscriptionReminderData 
} from './notificationManager';

/**
 * Service initialization and health check utilities
 */
export class ServiceManager {
  private static initialized = false;

  /**
   * Initializes all services and performs health checks
   */
  public static async initialize(): Promise<void> {
    if (ServiceManager.initialized) {
      console.log('Services already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing service system...');

      // Get the integration service instance (this triggers initialization)
      const integration = integrationService;
      
      // Perform initial health check
      const health = await integration.performHealthCheck();
      
      if (health.overall === 'unhealthy') {
        console.warn('⚠️ Some services are unhealthy:', health.services.filter(s => s.status === 'unhealthy'));
      }

      ServiceManager.initialized = true;
      console.log('✅ Service system initialized successfully');
      
      // Log initialization to audit system
      await auditSystem.logSystemEvent({
        eventType: 'system_event',
        component: 'ServiceManager',
        operation: 'initialize',
        success: true,
        metadata: { 
          servicesInitialized: health.services.length,
          overallHealth: health.overall
        }
      });
    } catch (error) {
      console.error('❌ Service system initialization failed:', error);
      
      // Log initialization failure
      try {
        await auditSystem.logSystemEvent({
          eventType: 'system_event',
          component: 'ServiceManager',
          operation: 'initialize',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (auditError) {
        console.error('Failed to log initialization failure:', auditError);
      }
      
      throw error;
    }
  }

  /**
   * Gets the current initialization status
   */
  public static isInitialized(): boolean {
    return ServiceManager.initialized;
  }

  /**
   * Performs a comprehensive health check of all services
   */
  public static async healthCheck(): Promise<SystemHealth> {
    if (!ServiceManager.initialized) {
      await ServiceManager.initialize();
    }
    
    return await integrationService.performHealthCheck();
  }

  /**
   * Gets service statistics for monitoring
   */
  public static getServiceStats(): {
    cacheStats: any;
    notificationQueueStatus: any;
    systemHealth: SystemHealth;
    serviceErrors: any[];
  } {
    return {
      cacheStats: cacheManager.getStats(),
      notificationQueueStatus: notificationManager.getQueueStatus(),
      systemHealth: integrationService.getSystemHealth(),
      serviceErrors: integrationService.getServiceErrors()
    };
  }

  /**
   * Clears all service caches and resets error states (admin function)
   */
  public static async reset(): Promise<void> {
    console.log('🔄 Resetting service system...');
    
    try {
      // Clear caches
      cacheManager.clearAll();
      
      // Clear service errors
      integrationService.clearServiceErrors();
      
      // Clear notification queue old entries
      notificationManager.clearOldNotifications();
      
      // Perform health check
      await ServiceManager.healthCheck();
      
      console.log('✅ Service system reset completed');
    } catch (error) {
      console.error('❌ Service system reset failed:', error);
      throw error;
    }
  }
}

/**
 * Convenience function to get the main application service
 * This is the primary interface that frontend components should use
 */
export function getApplicationService(): ApplicationService {
  return applicationService;
}

/**
 * Convenience function to check if services are ready
 */
export async function ensureServicesReady(): Promise<void> {
  if (!ServiceManager.isInitialized()) {
    await ServiceManager.initialize();
  }
}

/**
 * Convenience function for health monitoring
 */
export async function getSystemStatus(): Promise<{
  healthy: boolean;
  details: SystemHealth;
  stats: any;
}> {
  const health = await ServiceManager.healthCheck();
  const stats = ServiceManager.getServiceStats();
  
  return {
    healthy: health.overall === 'healthy',
    details: health,
    stats
  };
}

// ServiceManager is already exported above with the class definition