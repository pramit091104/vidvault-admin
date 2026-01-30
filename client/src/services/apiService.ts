// src/services/apiService.ts
// API service with environment-aware configuration and proper error handling

import { getApiBaseUrl, handleNetworkError, validateApiResponse } from '../config/environment';

// Type definitions for API requests and responses
export interface PaymentRequest {
  amount: number;        // Amount in paise (smallest currency unit)
  currency: string;      // Currency code (e.g., 'INR')
  receipt: string;       // Unique receipt identifier
  notes?: Record<string, string>; // Additional metadata
}

export interface PaymentVerification {
  orderId: string;       // Razorpay order ID
  paymentId: string;     // Razorpay payment ID
  signature: string;     // Payment signature for verification
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
  status: string;
}

export interface PaymentVerificationResponse {
  isValid: boolean;
}

// Get the API base URL using the environment utility
const API_BASE_URL = getApiBaseUrl();

export const apiService = {
  async createOrder(paymentRequest: PaymentRequest): Promise<RazorpayOrder> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/razorpay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentRequest),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to create order' }));
        throw new Error(error.message || 'Failed to create order');
      }

      const result = await response.json();
      validateApiResponse(result);
      return result;
    } catch (error) {
      // Handle network failures and other errors using the utility
      throw handleNetworkError(error as Error);
    }
  },

  async verifyPayment(verification: PaymentVerification): Promise<PaymentVerificationResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/razorpay/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verification),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Payment verification failed' }));
        throw new Error(error.message || 'Payment verification failed');
      }

      const result = await response.json();
      validateApiResponse(result);
      return result;
    } catch (error) {
      // Handle network failures and other errors using the utility
      throw handleNetworkError(error as Error);
    }
  },
};