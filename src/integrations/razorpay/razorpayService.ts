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
      const response = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentRequest),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || 'Failed to create payment order');
      }

      const order = await response.json();
      return order;
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create payment order');
    }
  }

  // Replace the verifyPayment method:
  async verifyPayment(verification: PaymentVerification) {
    try {
      const response = await fetch('/api/razorpay/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verification),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || 'Payment verification failed');
      }

      const data = await response.json();
      return data.isValid;
    } catch (error) {
      console.error('Error verifying payment:', error);
      return false;
    }
  }
}

export const razorpayService = new RazorpayService();
