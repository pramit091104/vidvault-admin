import Razorpay from 'razorpay';

export interface PaymentRequest {
  amount: number; // Amount in smallest currency unit (e.g., paise for INR)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface PaymentVerification {
  orderId: string;
  paymentId: string;
  signature: string;
}

class RazorpayService {
  constructor() {
    // No need to initialize Razorpay instance here since we're using backend API
  }

  // Replace the createOrder method in razorpayService.ts:
  async createOrder(paymentRequest: PaymentRequest) {
    try {
      const response = await fetch('http://localhost:3001/api/razorpay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentRequest),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment order');
      }

      const order = await response.json();
      return order;
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new Error('Failed to create payment order');
    }
  }

  // Replace the verifyPayment method:
  verifyPayment(verification: PaymentVerification) {
    try {
      // This will be handled by the backend now
      return fetch('http://localhost:3001/api/razorpay/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verification),
      })
        .then(response => response.json())
        .then(data => data.isValid);
    } catch (error) {
      console.error('Error verifying payment:', error);
      return false;
    }
  }
}

export const razorpayService = new RazorpayService();
