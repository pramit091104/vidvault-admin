import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const router = express.Router();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_Rx5tnJCOUHefCi',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'gJfWtk2zshP9dKcZQocNPg6T',
});

// Create order endpoint
router.post('/create-order', async (req, res) => {
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
});

// Verify payment endpoint
router.post('/verify-payment', (req, res) => {
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
});

export default router;
