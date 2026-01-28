-- Migration 001: Create audit and tracking tables
-- This migration creates the core audit system tables for comprehensive logging

-- Audit entries table for all system events
CREATE TABLE IF NOT EXISTS audit_entries (
  id VARCHAR(36) PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(36),
  user_type ENUM('authenticated', 'anonymous', 'system') NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(128),
  checksum VARCHAR(128) NOT NULL,
  type ENUM('approval_action', 'payment_transaction', 'subscription_change', 'security_violation', 'system_event') NOT NULL,
  
  -- Approval action specific fields
  video_id VARCHAR(36),
  video_title VARCHAR(255),
  action ENUM('approve', 'reject', 'request_revision'),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  feedback TEXT,
  reviewer_name VARCHAR(255),
  reviewer_email VARCHAR(255),
  client_verified BOOLEAN,
  rate_limit_remaining INTEGER,
  rate_limit_reset_time TIMESTAMP,
  
  -- Payment transaction specific fields
  transaction_id VARCHAR(36),
  razorpay_payment_id VARCHAR(128),
  razorpay_order_id VARCHAR(128),
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  payment_method VARCHAR(50),
  payment_status ENUM('pending', 'completed', 'failed', 'partial'),
  subscription_id VARCHAR(36),
  subscription_tier VARCHAR(20),
  webhook_received BOOLEAN,
  retry_count INTEGER DEFAULT 0,
  failure_reason TEXT,
  integrity_check_passed BOOLEAN,
  
  -- Subscription change specific fields
  change_type ENUM('create', 'upgrade', 'downgrade', 'cancel', 'expire', 'renew', 'auto_downgrade', 'integrity_update'),
  before_tier VARCHAR(20),
  before_status VARCHAR(20),
  before_expiry_date TIMESTAMP,
  before_upload_count INTEGER,
  before_max_uploads INTEGER,
  before_clients_used INTEGER,
  before_max_clients INTEGER,
  after_tier VARCHAR(20),
  after_status VARCHAR(20),
  after_expiry_date TIMESTAMP,
  after_upload_count INTEGER,
  after_max_uploads INTEGER,
  after_clients_used INTEGER,
  after_max_clients INTEGER,
  preserved_data BOOLEAN,
  payment_id VARCHAR(36),
  change_reason TEXT,
  
  -- Security violation specific fields
  violation_type ENUM('unauthorized_access', 'rate_limit_exceeded', 'invalid_signature', 'permission_denied', 'suspicious_activity', 'data_integrity_failure'),
  severity ENUM('low', 'medium', 'high', 'critical'),
  resource_id VARCHAR(36),
  resource_type ENUM('video', 'subscription', 'payment', 'user', 'system'),
  attempted_action VARCHAR(255),
  denied_reason TEXT,
  requires_investigation BOOLEAN,
  
  -- System event specific fields
  event_type ENUM('cache_invalidation', 'batch_process', 'notification_sent', 'webhook_processed', 'data_migration', 'backup_created', 'system_event'),
  component VARCHAR(100),
  operation VARCHAR(100),
  success BOOLEAN,
  duration INTEGER, -- in milliseconds
  records_affected INTEGER,
  error_message TEXT,
  
  -- Generic metadata field for additional context
  metadata JSON,
  
  -- Indexes for performance
  INDEX idx_audit_timestamp (timestamp),
  INDEX idx_audit_user_id (user_id),
  INDEX idx_audit_type (type),
  INDEX idx_audit_video_id (video_id),
  INDEX idx_audit_transaction_id (transaction_id),
  INDEX idx_audit_subscription_id (subscription_id),
  INDEX idx_audit_severity (severity),
  INDEX idx_audit_requires_investigation (requires_investigation)
);

-- Enhanced subscriptions table with audit tracking
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tier ENUM('free', 'premium', 'enterprise') NOT NULL DEFAULT 'free',
  status ENUM('active', 'expired', 'cancelled') NOT NULL DEFAULT 'active',
  start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMP,
  upload_count INTEGER NOT NULL DEFAULT 0,
  max_uploads INTEGER NOT NULL DEFAULT 5,
  max_clients INTEGER NOT NULL DEFAULT 1,
  clients_used INTEGER NOT NULL DEFAULT 0,
  max_file_size BIGINT NOT NULL DEFAULT 104857600, -- 100MB in bytes
  features JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Audit fields
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  version INTEGER NOT NULL DEFAULT 1,
  
  INDEX idx_subscriptions_user_id (user_id),
  INDEX idx_subscriptions_status (status),
  INDEX idx_subscriptions_tier (tier),
  INDEX idx_subscriptions_expiry (expiry_date),
  UNIQUE KEY unique_active_subscription (user_id, status)
);

-- Enhanced payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  razorpay_payment_id VARCHAR(128),
  razorpay_order_id VARCHAR(128),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM('pending', 'completed', 'failed', 'partial') NOT NULL DEFAULT 'pending',
  subscription_id VARCHAR(36),
  webhook_received BOOLEAN NOT NULL DEFAULT FALSE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Audit fields
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  version INTEGER NOT NULL DEFAULT 1,
  
  INDEX idx_payment_user_id (user_id),
  INDEX idx_payment_razorpay_id (razorpay_payment_id),
  INDEX idx_payment_status (status),
  INDEX idx_payment_subscription_id (subscription_id),
  INDEX idx_payment_created_at (created_at)
);

-- Video access tracking table
CREATE TABLE IF NOT EXISTS video_access_logs (
  id VARCHAR(36) PRIMARY KEY,
  video_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  signed_url_hash VARCHAR(128), -- Hash of the signed URL for security
  expiry_time TIMESTAMP NOT NULL,
  access_granted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subscription_tier_required ENUM('free', 'premium', 'enterprise') NOT NULL,
  subscription_verified BOOLEAN NOT NULL,
  access_type ENUM('view', 'download', 'stream') NOT NULL DEFAULT 'view',
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(128),
  
  INDEX idx_video_access_video_id (video_id),
  INDEX idx_video_access_user_id (user_id),
  INDEX idx_video_access_granted (access_granted),
  INDEX idx_video_access_expiry (expiry_time)
);

-- Video access violations table
CREATE TABLE IF NOT EXISTS video_access_violations (
  id VARCHAR(36) PRIMARY KEY,
  video_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  violation_type ENUM('unauthorized_access', 'expired_url', 'invalid_subscription', 'rate_limit_exceeded', 'suspicious_activity') NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  additional_context JSON,
  
  INDEX idx_violations_video_id (video_id),
  INDEX idx_violations_user_id (user_id),
  INDEX idx_violations_type (violation_type),
  INDEX idx_violations_severity (severity),
  INDEX idx_violations_timestamp (timestamp)
);

-- Approval actions table with enhanced tracking
CREATE TABLE IF NOT EXISTS approval_actions (
  id VARCHAR(36) PRIMARY KEY,
  video_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  user_type ENUM('authenticated', 'anonymous') NOT NULL,
  action ENUM('approve', 'reject', 'request_revision') NOT NULL,
  status ENUM('approved', 'rejected', 'revision_requested') NOT NULL,
  feedback TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  client_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(128),
  
  -- Rate limiting fields
  rate_limit_key VARCHAR(128),
  rate_limit_count INTEGER DEFAULT 1,
  rate_limit_window_start TIMESTAMP,
  
  INDEX idx_approval_video_id (video_id),
  INDEX idx_approval_user_id (user_id),
  INDEX idx_approval_timestamp (timestamp),
  INDEX idx_approval_status (status),
  INDEX idx_approval_rate_limit (rate_limit_key, rate_limit_window_start)
);

-- Notification queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('approval_status', 'revision_request', 'subscription_reminder', 'subscription_expired', 'payment_confirmation') NOT NULL,
  status ENUM('pending', 'sent', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  template_data JSON,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  error_message TEXT,
  
  INDEX idx_notification_user_id (user_id),
  INDEX idx_notification_status (status),
  INDEX idx_notification_type (type),
  INDEX idx_notification_next_attempt (next_attempt),
  INDEX idx_notification_created_at (created_at)
);

-- Cache invalidation tracking
CREATE TABLE IF NOT EXISTS cache_invalidations (
  id VARCHAR(36) PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL,
  invalidation_type ENUM('user_subscription', 'video_access', 'payment_status', 'manual', 'system') NOT NULL,
  triggered_by VARCHAR(36),
  reason TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_cache_key (cache_key),
  INDEX idx_cache_type (invalidation_type),
  INDEX idx_cache_timestamp (timestamp)
);