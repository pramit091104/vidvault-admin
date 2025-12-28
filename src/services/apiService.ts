// API service for Vercel serverless functions

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://previu.online' 
  : 'http://localhost:3001';

export interface PaymentRequest {
  amount: number;
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

class ApiService {
  // Create Razorpay order
  async createOrder(paymentRequest: PaymentRequest) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/razorpay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment order');
      }

      const order = await response.json();
      return order;
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new Error('Failed to create payment order');
    }
  }

  // Verify payment
  async verifyPayment(verification: PaymentVerification): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/razorpay/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verification),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment verification failed');
      }

      const data = await response.json();
      return data.isValid;
    } catch (error) {
      console.error('Error verifying payment:', error);
      return false;
    }
  }

  // Get signed URL for video
  async getSignedUrl(videoId: string, service?: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/signed-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId, service }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get signed URL');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      throw new Error('Failed to get signed URL');
    }
  }
}

export const apiService = new ApiService();
