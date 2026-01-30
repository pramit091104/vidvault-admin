import Razorpay from 'razorpay';
import crypto from 'crypto';

// Validate environment variables with detailed error messages
const validateEnvironment = () => {
  const missingVars = [];

  if (!process.env.RAZORPAY_KEY_ID) {
    missingVars.push('RAZORPAY_KEY_ID');
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    missingVars.push('RAZORPAY_KEY_SECRET');
  }

  if (missingVars.length > 0) {
    const error = new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      `Please check your .env file and ensure all required variables are set. ` +
      `Refer to .env.example for the required format.`
    );
    error.name = 'EnvironmentValidationError';
    throw error;
  }

  // Validate that the keys are not placeholder values
  if (process.env.RAZORPAY_KEY_ID === 'your_razorpay_key_id_here') {
    throw new Error('RAZORPAY_KEY_ID is set to placeholder value. Please set it to your actual Razorpay key ID.');
  }

  if (process.env.RAZORPAY_KEY_SECRET === 'your_razorpay_key_secret_here') {
    throw new Error('RAZORPAY_KEY_SECRET is set to placeholder value. Please set it to your actual Razorpay key secret.');
  }
};

// Validate environment on module load
try {
  validateEnvironment();
  console.log('✓ Razorpay create-order endpoint: Environment validation successful');
} catch (error) {
  console.error('❌ Razorpay create-order endpoint: Environment validation failed');
  console.error(error.message);
  // Don't exit here as this is a serverless function, let it fail at runtime
}

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
