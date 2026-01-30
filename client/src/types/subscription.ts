// Enhanced subscription types for the new SubscriptionManager
export interface SubscriptionStatus {
  isActive: boolean;
  tier: 'free' | 'premium' | 'enterprise';
  expiryDate: Date;
  uploadCount: number;
  features: string[];
  maxUploads: number;
  maxClients: number;
  maxFileSize: number;
  clientsUsed: number;
  subscriptionDate?: Date;
  status: 'active' | 'expired' | 'cancelled';
}

export interface Subscription {
  id: string;
  userId: string;
  tier: 'free' | 'premium' | 'enterprise';
  status: 'active' | 'expired' | 'cancelled';
  startDate: Date;
  expiryDate: Date;
  uploadCount: number;
  maxUploads: number;
  features: string[];
  paymentHistory: PaymentRecord[];
  createdAt: Date;
  updatedAt: Date;
  maxClients: number;
  clientsUsed: number;
  maxFileSize: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  razorpayPaymentId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface SubscriptionUpgradeOptions {
  newTier: 'free' | 'premium' | 'enterprise';
  preserveData: boolean;
  paymentId?: string;
  transactionId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BusinessRules {
  maxUploadsByTier: Record<string, number>;
  maxClientsByTier: Record<string, number>;
  maxFileSizeByTier: Record<string, number>;
  featuresByTier: Record<string, string[]>;
}