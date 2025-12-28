// src/services/apiService.ts
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://previu.online' 
  : 'http://localhost:3000';

export const apiService = {
  async createOrder(paymentRequest: any) {
    const response = await fetch(`${API_BASE_URL}/api/razorpay/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create order');
    }

    return response.json();
  },

  async verifyPayment(verification: any) {
    const response = await fetch(`${API_BASE_URL}/api/razorpay/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verification),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Payment verification failed');
    }

    return response.json();
  },
};