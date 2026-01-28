// Main types index - exports all interfaces and data models

// Subscription types
export * from './subscription';

// Payment types  
export * from './payment';

// Audit types
export * from './audit';

// Video types
export * from './video';

// Service interfaces
export * from './services';

// Database schema types
export * from '../database/firestore-schema';

// Re-export commonly used types for convenience
export type {
  // Core data models
  Subscription,
  SubscriptionStatus,
} from './subscription';

export type {
  PaymentTransaction,
  PaymentResult,
} from './payment';

export type {
  AuditEntry,
} from './audit';

export type {
  VideoAccess,
  VideoMetadata,
  ApprovalAction,
} from './video';

export type {
  // Service interfaces
  ISubscriptionManager,
  IPaymentManager,
  IApprovalManager,
  INotificationManager,
  ICacheManager,
  IAuditSystem,
  IVideoAccessService,
  IIntegrationService,
} from './services';

export type {
  // Firestore schemas
  FirestoreSubscription,
  FirestorePaymentTransaction,
  FirestoreAuditEntry,
  FirestoreVideoAccessLog,
  FirestoreApprovalAction,
} from '../database/firestore-schema';

// Common utility types
export interface DatabaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version?: number;
}

export interface AuditableEntity extends DatabaseEntity {
  createdBy?: string;
  updatedBy?: string;
}

export interface TimestampedEntity {
  timestamp: Date;
}

export interface UserContextEntity {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface ValidationEntity {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Common enums
export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export enum SubscriptionStatusEnum {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISION_REQUESTED = 'revision_requested'
}

export enum UserType {
  AUTHENTICATED = 'authenticated',
  ANONYMOUS = 'anonymous',
  SYSTEM = 'system'
}

export enum AuditType {
  APPROVAL_ACTION = 'approval_action',
  PAYMENT_TRANSACTION = 'payment_transaction',
  SUBSCRIPTION_CHANGE = 'subscription_change',
  SECURITY_VIOLATION = 'security_violation',
  SYSTEM_EVENT = 'system_event'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error types
export class SubscriptionError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export class PaymentError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class ApprovalError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'ApprovalError';
  }
}

export class AuditError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'AuditError';
  }
}

export class VideoAccessError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'VideoAccessError';
  }
}

// Configuration types
export interface SystemConfiguration {
  database: {
    connectionString: string;
    maxConnections: number;
    timeout: number;
  };
  cache: {
    defaultTTL: number;
    maxSize: number;
    provider: 'memory' | 'redis';
  };
  audit: {
    enabled: boolean;
    retentionDays: number;
    checksumAlgorithm: 'sha256' | 'sha512';
    tamperProofing: boolean;
  };
  notifications: {
    provider: 'email' | 'sms' | 'push';
    retryAttempts: number;
    retryDelay: number;
  };
  security: {
    rateLimiting: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
    };
    signedUrls: {
      defaultExpiryMinutes: number;
      maxExpiryMinutes: number;
    };
  };
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Event types for system integration
export interface SystemEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: any;
  metadata?: Record<string, any>;
}

export interface EventHandler<T = any> {
  handle(event: SystemEvent & { data: T }): Promise<void>;
}

// Health check types
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  services: HealthCheckResult[];
  timestamp: Date;
}