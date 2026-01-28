// Test file to verify all interfaces and data models are properly defined
import {
  // Core data models
  Subscription,
  SubscriptionStatus,
  PaymentTransaction,
  PaymentResult,
  VideoAccess,
  VideoMetadata,
  ApprovalAction,
  AuditEntry,
  
  // Service interfaces
  ISubscriptionManager,
  IPaymentManager,
  IApprovalManager,
  INotificationManager,
  ICacheManager,
  IAuditSystem,
  IVideoAccessService,
  IIntegrationService,
  
  // Firestore schemas
  FirestoreSubscription,
  FirestorePaymentTransaction,
  FirestoreAuditEntry,
  FirestoreVideoAccessLog,
  FirestoreApprovalAction,
  
  // Enums
  SubscriptionTier,
  SubscriptionStatusEnum,
  PaymentStatus,
  ApprovalStatus,
  UserType,
  AuditType,
  SecuritySeverity,
  
  // Error types
  SubscriptionError,
  PaymentError,
  ApprovalError,
  AuditError,
  VideoAccessError,
} from './index';

describe('Type Definitions', () => {
  test('Core data model interfaces are properly defined', () => {
    // Test that all core interfaces exist and have expected structure
    const subscription: Subscription = {
      id: 'test-id',
      userId: 'user-id',
      tier: 'premium',
      status: 'active',
      startDate: new Date(),
      expiryDate: new Date(),
      uploadCount: 5,
      maxUploads: 100,
      features: ['upload', 'download'],
      paymentHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      maxClients: 10,
      clientsUsed: 2,
      maxFileSize: 1073741824,
    };
    
    expect(subscription.id).toBe('test-id');
    expect(subscription.tier).toBe('premium');
    expect(subscription.status).toBe('active');
  });
  
  test('Service interfaces are properly defined', () => {
    // Test that service interfaces have expected method signatures
    const mockSubscriptionManager: Partial<ISubscriptionManager> = {
      validateSubscription: async (userId: string) => ({
        isActive: true,
        tier: 'premium',
        expiryDate: new Date(),
        uploadCount: 5,
        features: ['upload'],
        maxUploads: 100,
        maxClients: 10,
        maxFileSize: 1073741824,
        clientsUsed: 2,
        status: 'active',
      }),
    };
    
    expect(typeof mockSubscriptionManager.validateSubscription).toBe('function');
  });
  
  test('Enum values are correctly defined', () => {
    expect(SubscriptionTier.FREE).toBe('free');
    expect(SubscriptionTier.PREMIUM).toBe('premium');
    expect(SubscriptionTier.ENTERPRISE).toBe('enterprise');
    
    expect(SubscriptionStatusEnum.ACTIVE).toBe('active');
    expect(SubscriptionStatusEnum.EXPIRED).toBe('expired');
    expect(SubscriptionStatusEnum.CANCELLED).toBe('cancelled');
    
    expect(PaymentStatus.PENDING).toBe('pending');
    expect(PaymentStatus.COMPLETED).toBe('completed');
    expect(PaymentStatus.FAILED).toBe('failed');
    expect(PaymentStatus.PARTIAL).toBe('partial');
    
    expect(ApprovalStatus.PENDING).toBe('pending');
    expect(ApprovalStatus.APPROVED).toBe('approved');
    expect(ApprovalStatus.REJECTED).toBe('rejected');
    expect(ApprovalStatus.REVISION_REQUESTED).toBe('revision_requested');
  });
  
  test('Error classes are properly defined', () => {
    const subscriptionError = new SubscriptionError('Test error', 'TEST_CODE', { detail: 'test' });
    expect(subscriptionError.name).toBe('SubscriptionError');
    expect(subscriptionError.message).toBe('Test error');
    expect(subscriptionError.code).toBe('TEST_CODE');
    expect(subscriptionError.details).toEqual({ detail: 'test' });
    
    const paymentError = new PaymentError('Payment failed', 'PAYMENT_FAILED');
    expect(paymentError.name).toBe('PaymentError');
    expect(paymentError.message).toBe('Payment failed');
    expect(paymentError.code).toBe('PAYMENT_FAILED');
  });
  
  test('Firestore schema interfaces are properly defined', () => {
    const firestoreSubscription: FirestoreSubscription = {
      id: 'test-id',
      userId: 'user-id',
      tier: 'premium',
      status: 'active',
      startDate: { seconds: 1640995200, nanoseconds: 0 } as any, // Mock Timestamp
      expiryDate: { seconds: 1672531200, nanoseconds: 0 } as any, // Mock Timestamp
      uploadCount: 5,
      maxUploads: 100,
      maxClients: 10,
      clientsUsed: 2,
      maxFileSize: 1073741824,
      features: ['upload', 'download'],
      createdAt: { seconds: 1640995200, nanoseconds: 0 } as any, // Mock Timestamp
      updatedAt: { seconds: 1640995200, nanoseconds: 0 } as any, // Mock Timestamp
      version: 1,
    };
    
    expect(firestoreSubscription.id).toBe('test-id');
    expect(firestoreSubscription.tier).toBe('premium');
    expect(firestoreSubscription.version).toBe(1);
  });
  
  test('Video access interfaces are properly defined', () => {
    const videoAccess: VideoAccess = {
      videoId: 'video-id',
      userId: 'user-id',
      signedUrl: 'https://example.com/video.mp4',
      expiryTime: new Date(),
      accessGranted: new Date(),
      subscriptionTierRequired: 'premium',
      subscriptionVerified: true,
      accessType: 'view',
    };
    
    expect(videoAccess.videoId).toBe('video-id');
    expect(videoAccess.subscriptionTierRequired).toBe('premium');
    expect(videoAccess.accessType).toBe('view');
  });
  
  test('Audit entry interfaces are properly defined', () => {
    const auditEntry: Partial<AuditEntry> = {
      id: 'audit-id',
      timestamp: new Date(),
      userId: 'user-id',
      userType: 'authenticated',
      checksum: 'test-checksum',
      type: 'approval_action',
    };
    
    expect(auditEntry.id).toBe('audit-id');
    expect(auditEntry.type).toBe('approval_action');
    expect(auditEntry.userType).toBe('authenticated');
  });
});