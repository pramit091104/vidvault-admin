// Payment-related types for the PaymentManager
export interface PaymentTransaction {
  id: string;
  userId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'partial';
  subscriptionId: string;
  webhookReceived: boolean;
  retryCount: number;
  createdAt: Date;
  completedAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  subscriptionUpdated: boolean;
  retryRequired: boolean;
  errorDetails?: string;
  partialAmount?: number;
}

export interface RazorpayWebhook {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment: {
      entity: RazorpayPayment;
    };
    order?: {
      entity: RazorpayOrder;
    };
  };
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id: string;
  invoice_id?: string;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status?: string;
  captured: boolean;
  description?: string;
  card_id?: string;
  bank?: string;
  wallet?: string;
  vpa?: string;
  email: string;
  contact: string;
  notes: Record<string, string>;
  fee?: number;
  tax?: number;
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
  error_reason?: string;
  acquirer_data?: Record<string, any>;
  created_at: number;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  offer_id?: string;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface PaymentStatus {
  isValid: boolean;
  payment?: RazorpayPayment;
  order?: RazorpayOrder;
  errorMessage?: string;
  requiresRetry?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffMultiplier: number;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  errorMessage?: string;
  payload?: RazorpayWebhook;
}

export interface PartialPaymentInfo {
  expectedAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  isPartial: boolean;
}

export interface TransactionIntegrityCheck {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  canProceed: boolean;
}