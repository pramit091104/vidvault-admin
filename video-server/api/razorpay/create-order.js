import Razorpay from 'razorpay';
import crypto from 'crypto';

// Validate environment variables with detailed error messages (non-blocking)
const validateEnvironment = () => {
  const missingVars = [];

  if (!process.env.RAZORPAY_KEY_ID) {
    missingVars.push('RAZORPAY_KEY_ID');
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    missingVars.push('RAZORPAY_KEY_SECRET');
  }

  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing Razorpay env vars: ${missingVars.join(', ')}`);
    return false;
  }
  return true;
};

// Validate environment on module load (log only)
try {
  if (validateEnvironment()) {
    console.log('✓ Razorpay create-order endpoint: Environment looks good');
  }
} catch (error) {
  console.error('❌ Razorpay create-order endpoint: Environment validation failed', error.message);
}

// Initialize Razorpay instance lazily
const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials missing');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

export default async function handler(req, res) {
  console.log('🔍 Create Order Handler - Request received:', {
    method: req.method,
    origin: req.headers.origin,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Check if request is valid (global CORS middleware protects origins)
  // Logic simplified as server.js handles headers

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: amount, // Amount in smallest currency unit (paise)
      currency,
      receipt,
      notes,
      payment_capture: 1, // Auto capture payment
    };

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      error: 'Failed to create payment order',
      message: error.message
    });
  }
}
