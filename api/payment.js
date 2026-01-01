import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_Rx5tnJCOUHefCi',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'gJfWtk2zshP9dKcZQocNPg6T',
});

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const action = pathname.split('/').pop();

    switch (action) {
      case 'create-order':
        return await handleCreateOrder(req, res);

      case 'verify-payment':
        return await handleVerifyPayment(req, res);

      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('❌ Payment API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}

async function handleCreateOrder(req, res) {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    const options = {
      amount: amount, // Amount in smallest currency unit (paise)
      currency,
      receipt,
      notes,
      payment_capture: 1, // Auto capture payment
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
}

async function handleVerifyPayment(req, res) {
  try {
    const { orderId, paymentId, signature } = req.body;

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'gJfWtk2zshP9dKcZQocNPg6T');
    hmac.update(orderId + '|' + paymentId);
    const generatedSignature = hmac.digest('hex');

    const isValid = generatedSignature === signature;
    res.json({ isValid });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
}