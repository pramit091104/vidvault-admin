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
  private instance: Razorpay;

  constructor() {
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      throw new Error('Razorpay key ID is not configured');
    }
    
    this.instance = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  async createOrder(paymentRequest: PaymentRequest) {
    try {
      const options = {
        amount: paymentRequest.amount,
        currency: paymentRequest.currency || 'INR', // Default to INR
        receipt: paymentRequest.receipt || `order_${Date.now()}`,
        notes: paymentRequest.notes,
        payment_capture: 1, // Auto capture payment
      };

      const order = await this.instance.orders.create(options);
      return order;
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new Error('Failed to create payment order');
    }
  }

  verifyPayment(verification: PaymentVerification) {
    try {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '');
      hmac.update(verification.orderId + '|' + verification.paymentId);
      const generatedSignature = hmac.digest('hex');
      
      return generatedSignature === verification.signature;
    } catch (error) {
      console.error('Error verifying payment:', error);
      return false;
    }
  }

  // Add more methods as needed (refund, fetch payments, etc.)
}

export const razorpayService = new RazorpayService();
