// Property-based test generators for data models
import fc from 'fast-check';
import { 
  SubscriptionStatus, 
  Subscription, 
  PaymentTransaction, 
  PaymentResult 
} from '../types/subscription';
import { 
  ApprovalAction, 
  VideoAccess, 
  VideoMetadata 
} from '../types/video';
import { 
  AuditEntry, 
  ApprovalAuditEntry, 
  PaymentAuditEntry, 
  SubscriptionAuditEntry,
  SecurityViolationEntry 
} from '../types/audit';

/**
 * Generators for subscription-related types
 */
export const subscriptionGenerators = {
  tier: () => fc.constantFrom('free', 'premium', 'enterprise'),
  
  status: () => fc.constantFrom('active', 'expired', 'cancelled'),
  
  subscriptionStatus: () => fc.record({
    isActive: fc.boolean(),
    tier: subscriptionGenerators.tier(),
    expiryDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
    uploadCount: fc.integer({ min: 0, max: 1000 }),
    features: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
    maxUploads: fc.integer({ min: 1, max: 1000 }),
    maxClients: fc.integer({ min: 1, max: 100 }),
    maxFileSize: fc.integer({ min: 1024, max: 10737418240 }), // 1KB to 10GB
    clientsUsed: fc.integer({ min: 0, max: 100 }),
    subscriptionDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() })),
    status: subscriptionGenerators.status(),
  }),
  
  subscription: () => fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    tier: subscriptionGenerators.tier(),
    status: subscriptionGenerators.status(),
    startDate: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    expiryDate: fc.date({ min: new Date(), max: new Date('2030-12-31') }),
    uploadCount: fc.integer({ min: 0, max: 1000 }),
    maxUploads: fc.integer({ min: 1, max: 1000 }),
    features: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
    paymentHistory: fc.array(paymentGenerators.paymentRecord(), { minLength: 0, maxLength: 10 }),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    maxClients: fc.integer({ min: 1, max: 100 }),
    clientsUsed: fc.integer({ min: 0, max: 100 }),
    maxFileSize: fc.integer({ min: 1024, max: 10737418240 }),
  }),
};

/**
 * Generators for payment-related types
 */
export const paymentGenerators = {
  paymentStatus: () => fc.constantFrom('pending', 'completed', 'failed', 'partial'),
  
  currency: () => fc.constantFrom('INR', 'USD', 'EUR'),
  
  paymentRecord: () => fc.record({
    id: fc.uuid(),
    amount: fc.float({ min: 1, max: 100000, noNaN: true }),
    currency: paymentGenerators.currency(),
    status: paymentGenerators.paymentStatus(),
    razorpayPaymentId: fc.option(fc.string({ minLength: 10, maxLength: 50 })),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    completedAt: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() })),
  }),
  
  paymentTransaction: () => fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    razorpayPaymentId: fc.string({ minLength: 10, maxLength: 50 }),
    razorpayOrderId: fc.string({ minLength: 10, maxLength: 50 }),
    amount: fc.float({ min: 1, max: 100000, noNaN: true }),
    currency: paymentGenerators.currency(),
    status: paymentGenerators.paymentStatus(),
    subscriptionId: fc.uuid(),
    webhookReceived: fc.boolean(),
    retryCount: fc.integer({ min: 0, max: 10 }),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    completedAt: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() })),
    failureReason: fc.option(fc.string({ minLength: 5, maxLength: 200 })),
    metadata: fc.option(fc.dictionary(fc.string(), fc.anything())),
  }),
  
  paymentResult: () => fc.record({
    success: fc.boolean(),
    transactionId: fc.uuid(),
    subscriptionUpdated: fc.boolean(),
    retryRequired: fc.boolean(),
    errorDetails: fc.option(fc.string({ minLength: 5, maxLength: 200 })),
    partialAmount: fc.option(fc.float({ min: 1, max: 100000, noNaN: true })),
  }),
};

/**
 * Generators for video-related types
 */
export const videoGenerators = {
  approvalStatus: () => fc.constantFrom('pending', 'approved', 'rejected', 'revision_requested'),
  
  accessType: () => fc.constantFrom('view', 'download', 'stream'),
  
  userType: () => fc.constantFrom('authenticated', 'anonymous'),
  
  approvalAction: () => fc.record({
    id: fc.uuid(),
    videoId: fc.uuid(),
    userId: fc.uuid(),
    userType: videoGenerators.userType(),
    action: fc.constantFrom('approve', 'reject', 'request_revision'),
    status: fc.constantFrom('approved', 'rejected', 'revision_requested'),
    feedback: fc.option(fc.string({ minLength: 10, maxLength: 500 })),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    clientVerified: fc.boolean(),
    ipAddress: fc.option(fc.ipV4()),
    userAgent: fc.option(fc.string({ minLength: 20, maxLength: 200 })),
  }),
  
  videoAccess: () => fc.record({
    videoId: fc.uuid(),
    userId: fc.uuid(),
    signedUrl: fc.webUrl(),
    expiryTime: fc.date({ min: new Date(), max: new Date('2030-12-31') }),
    accessGranted: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    subscriptionTierRequired: subscriptionGenerators.tier(),
    subscriptionVerified: fc.boolean(),
    accessType: videoGenerators.accessType(),
    ipAddress: fc.option(fc.ipV4()),
    userAgent: fc.option(fc.string({ minLength: 20, maxLength: 200 })),
    sessionId: fc.option(fc.uuid()),
  }),
  
  videoMetadata: () => fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 5, maxLength: 100 }),
    creatorId: fc.uuid(),
    clientId: fc.option(fc.uuid()),
    status: videoGenerators.approvalStatus(),
    subscriptionTierRequired: subscriptionGenerators.tier(),
    duration: fc.option(fc.integer({ min: 1, max: 7200 })), // 1 second to 2 hours
    fileSize: fc.integer({ min: 1024, max: 10737418240 }), // 1KB to 10GB
    uploadDate: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    lastModified: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    approvalHistory: fc.array(videoGenerators.approvalAction(), { minLength: 0, maxLength: 5 }),
  }),
};

/**
 * Generators for audit-related types
 */
export const auditGenerators = {
  userType: () => fc.constantFrom('authenticated', 'anonymous', 'system'),
  
  auditType: () => fc.constantFrom('approval_action', 'payment_transaction', 'subscription_change', 'security_violation', 'system_event'),
  
  severity: () => fc.constantFrom('low', 'medium', 'high', 'critical'),
  
  baseAuditEntry: () => fc.record({
    id: fc.uuid(),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    userId: fc.uuid(),
    userType: auditGenerators.userType(),
    ipAddress: fc.option(fc.ipV4()),
    userAgent: fc.option(fc.string({ minLength: 20, maxLength: 200 })),
    sessionId: fc.option(fc.uuid()),
    checksum: fc.string({ minLength: 32, maxLength: 128 }),
  }),
  
  approvalAuditEntry: () => fc.record({
    ...auditGenerators.baseAuditEntry().value,
    type: fc.constant('approval_action' as const),
    videoId: fc.uuid(),
    videoTitle: fc.option(fc.string({ minLength: 5, maxLength: 100 })),
    action: fc.constantFrom('approve', 'reject', 'request_revision'),
    previousStatus: fc.option(fc.string({ minLength: 3, maxLength: 20 })),
    newStatus: fc.string({ minLength: 3, maxLength: 20 }),
    feedback: fc.option(fc.string({ minLength: 10, maxLength: 500 })),
    reviewerName: fc.option(fc.string({ minLength: 2, maxLength: 50 })),
    reviewerEmail: fc.option(fc.emailAddress()),
    clientVerified: fc.boolean(),
    rateLimitStatus: fc.option(fc.record({
      remainingActions: fc.integer({ min: 0, max: 100 }),
      resetTime: fc.date({ min: new Date(), max: new Date('2030-12-31') }),
    })),
  }),
  
  paymentAuditEntry: () => fc.record({
    ...auditGenerators.baseAuditEntry().value,
    type: fc.constant('payment_transaction' as const),
    transactionId: fc.uuid(),
    razorpayPaymentId: fc.string({ minLength: 10, maxLength: 50 }),
    razorpayOrderId: fc.option(fc.string({ minLength: 10, maxLength: 50 })),
    amount: fc.float({ min: 1, max: 100000, noNaN: true }),
    currency: paymentGenerators.currency(),
    paymentMethod: fc.option(fc.string({ minLength: 3, maxLength: 20 })),
    paymentStatus: paymentGenerators.paymentStatus(),
    subscriptionId: fc.option(fc.uuid()),
    subscriptionTier: fc.option(subscriptionGenerators.tier()),
    webhookReceived: fc.boolean(),
    retryCount: fc.integer({ min: 0, max: 10 }),
    failureReason: fc.option(fc.string({ minLength: 5, maxLength: 200 })),
    integrityCheckPassed: fc.boolean(),
    metadata: fc.option(fc.dictionary(fc.string(), fc.anything())),
  }),
  
  subscriptionAuditEntry: () => fc.record({
    ...auditGenerators.baseAuditEntry().value,
    type: fc.constant('subscription_change' as const),
    subscriptionId: fc.option(fc.uuid()),
    changeType: fc.constantFrom('create', 'upgrade', 'downgrade', 'cancel', 'expire', 'renew', 'auto_downgrade', 'integrity_update'),
    beforeState: fc.record({
      tier: subscriptionGenerators.tier(),
      status: subscriptionGenerators.status(),
      expiryDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })),
      uploadCount: fc.integer({ min: 0, max: 1000 }),
      maxUploads: fc.integer({ min: 1, max: 1000 }),
      clientsUsed: fc.integer({ min: 0, max: 100 }),
      maxClients: fc.integer({ min: 1, max: 100 }),
    }),
    afterState: fc.record({
      tier: subscriptionGenerators.tier(),
      status: subscriptionGenerators.status(),
      expiryDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })),
      uploadCount: fc.integer({ min: 0, max: 1000 }),
      maxUploads: fc.integer({ min: 1, max: 1000 }),
      clientsUsed: fc.integer({ min: 0, max: 100 }),
      maxClients: fc.integer({ min: 1, max: 100 }),
    }),
    preservedData: fc.boolean(),
    paymentId: fc.option(fc.uuid()),
    reason: fc.option(fc.string({ minLength: 5, maxLength: 200 })),
  }),
  
  securityViolationEntry: () => fc.record({
    ...auditGenerators.baseAuditEntry().value,
    type: fc.constant('security_violation' as const),
    violationType: fc.constantFrom('unauthorized_access', 'rate_limit_exceeded', 'invalid_signature', 'permission_denied', 'suspicious_activity', 'data_integrity_failure'),
    severity: auditGenerators.severity(),
    resourceId: fc.option(fc.uuid()),
    resourceType: fc.option(fc.constantFrom('video', 'subscription', 'payment', 'user', 'system')),
    attemptedAction: fc.option(fc.string({ minLength: 5, maxLength: 100 })),
    deniedReason: fc.string({ minLength: 5, maxLength: 200 }),
    additionalContext: fc.option(fc.dictionary(fc.string(), fc.anything())),
    requiresInvestigation: fc.boolean(),
  }),
};

/**
 * Smart generators that create realistic test data
 */
export const smartGenerators = {
  // Generate a valid subscription that respects business rules
  validSubscription: () => fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    tier: subscriptionGenerators.tier(),
    status: fc.constantFrom('active', 'expired'), // More realistic statuses
    startDate: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    expiryDate: fc.date({ min: new Date(), max: new Date('2030-12-31') }),
    uploadCount: fc.integer({ min: 0, max: 100 }), // Reasonable upload count
    maxUploads: fc.integer({ min: 5, max: 1000 }),
    features: fc.array(fc.constantFrom('upload', 'download', 'streaming', 'analytics', 'priority_support'), { minLength: 1, maxLength: 5 }),
    paymentHistory: fc.array(paymentGenerators.paymentRecord(), { minLength: 0, maxLength: 3 }),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    maxClients: fc.integer({ min: 1, max: 50 }),
    clientsUsed: fc.integer({ min: 0, max: 50 }),
    maxFileSize: fc.constantFrom(104857600, 1073741824, 5368709120), // 100MB, 1GB, 5GB
  }).filter(sub => sub.clientsUsed <= sub.maxClients && sub.uploadCount <= sub.maxUploads),
  
  // Generate expired subscription for testing downgrade scenarios
  expiredSubscription: () => smartGenerators.validSubscription().map(sub => ({
    ...sub,
    status: 'expired' as const,
    expiryDate: fc.date({ min: new Date('2020-01-01'), max: new Date(Date.now() - 86400000) }).generate(fc.random()), // Past date
  })),
  
  // Generate payment transaction with consistent data
  consistentPaymentTransaction: () => fc.tuple(
    fc.uuid(), // userId
    subscriptionGenerators.tier(), // subscription tier
    fc.float({ min: 100, max: 10000, noNaN: true }) // amount
  ).map(([userId, tier, amount]) => ({
    id: fc.uuid().generate(fc.random()),
    userId,
    razorpayPaymentId: `pay_${fc.string({ minLength: 10, maxLength: 20 }).generate(fc.random())}`,
    razorpayOrderId: `order_${fc.string({ minLength: 10, maxLength: 20 }).generate(fc.random())}`,
    amount,
    currency: 'INR' as const,
    status: fc.constantFrom('pending', 'completed', 'failed').generate(fc.random()),
    subscriptionId: fc.uuid().generate(fc.random()),
    webhookReceived: fc.boolean().generate(fc.random()),
    retryCount: fc.integer({ min: 0, max: 3 }).generate(fc.random()),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }).generate(fc.random()),
    completedAt: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() })).generate(fc.random()),
    failureReason: fc.option(fc.string({ minLength: 5, maxLength: 100 })).generate(fc.random()),
    metadata: fc.option(fc.dictionary(fc.string(), fc.string())).generate(fc.random()),
  })),
};

/**
 * Constraint generators for testing edge cases
 */
export const constraintGenerators = {
  // Generate data that violates business rules for negative testing
  invalidSubscription: () => fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    tier: subscriptionGenerators.tier(),
    status: subscriptionGenerators.status(),
    startDate: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    expiryDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
    uploadCount: fc.integer({ min: -10, max: 10000 }), // Can be negative or excessive
    maxUploads: fc.integer({ min: -5, max: 10000 }), // Can be negative
    features: fc.array(fc.string(), { minLength: 0, maxLength: 20 }),
    paymentHistory: fc.array(paymentGenerators.paymentRecord(), { minLength: 0, maxLength: 20 }),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    maxClients: fc.integer({ min: -5, max: 1000 }), // Can be negative
    clientsUsed: fc.integer({ min: -10, max: 1000 }), // Can be negative or exceed max
    maxFileSize: fc.integer({ min: -1024, max: 107374182400 }), // Can be negative or excessive
  }),
  
  // Generate edge case dates
  edgeCaseDates: () => fc.oneof(
    fc.constant(new Date(0)), // Unix epoch
    fc.constant(new Date('1970-01-01')),
    fc.constant(new Date('2038-01-19')), // 32-bit timestamp limit
    fc.constant(new Date('9999-12-31')), // Far future
    fc.date({ min: new Date(Date.now() - 1000), max: new Date(Date.now() + 1000) }), // Very recent
  ),
  
  // Generate boundary values for integers
  boundaryIntegers: () => fc.oneof(
    fc.constant(0),
    fc.constant(1),
    fc.constant(-1),
    fc.constant(Number.MAX_SAFE_INTEGER),
    fc.constant(Number.MIN_SAFE_INTEGER),
    fc.integer({ min: -1000, max: 1000 }),
  ),
};