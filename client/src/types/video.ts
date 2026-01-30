// Video access and security types

/**
 * Video access control and signed URL management
 */
export interface VideoAccess {
  videoId: string;
  userId: string;
  signedUrl: string;
  expiryTime: Date;
  accessGranted: Date;
  subscriptionTierRequired: string;
  subscriptionVerified: boolean;
  accessType: 'view' | 'download' | 'stream';
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

/**
 * Video metadata for access control
 */
export interface VideoMetadata {
  id: string;
  title: string;
  creatorId: string;
  clientId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  subscriptionTierRequired: 'free' | 'premium' | 'enterprise';
  duration?: number; // in seconds
  fileSize: number; // in bytes
  uploadDate: Date;
  lastModified: Date;
  approvalHistory: ApprovalAction[];
}

/**
 * Approval action for video workflow
 */
export interface ApprovalAction {
  id: string;
  videoId: string;
  userId: string;
  userType: 'authenticated' | 'anonymous';
  action: 'approve' | 'reject' | 'request_revision';
  status: 'approved' | 'rejected' | 'revision_requested';
  feedback?: string;
  timestamp: Date;
  clientVerified: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Video URL generation options
 */
export interface VideoUrlOptions {
  expiryMinutes?: number;
  accessType: 'view' | 'download' | 'stream';
  allowDownload?: boolean;
  watermark?: boolean;
  quality?: 'low' | 'medium' | 'high' | 'original';
}

/**
 * Video access violation details
 */
export interface VideoAccessViolation {
  videoId: string;
  userId?: string;
  violationType: 'unauthorized_access' | 'expired_url' | 'invalid_subscription' | 'rate_limit_exceeded' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  additionalContext?: Record<string, any>;
}

/**
 * Video URL refresh result
 */
export interface VideoUrlRefreshResult {
  success: boolean;
  newUrl?: string;
  expiryTime?: Date;
  errorMessage?: string;
  retryAfter?: number; // seconds
}

/**
 * Video access validation result
 */
export interface VideoAccessValidation {
  isValid: boolean;
  hasAccess: boolean;
  subscriptionValid: boolean;
  urlValid: boolean;
  errors: string[];
  warnings: string[];
  expiryTime?: Date;
}