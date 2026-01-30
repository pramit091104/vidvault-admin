import crypto from 'crypto';

// Validate environment variables with detailed error messages
const validateEnvironment = () => {
  const missingVars = [];

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

  // Validate that the key is not a placeholder value
  if (process.env.RAZORPAY_KEY_SECRET === 'your_razorpay_key_secret_here') {
    throw new Error('RAZORPAY_KEY_SECRET is set to placeholder value. Please set it to your actual Razorpay key secret.');
  }
};

// Validate environment on module load
try {
  validateEnvironment();
  console.log('✓ Razorpay verify-payment endpoint: Environment validation successful');
} catch (error) {
  console.error('❌ Razorpay verify-payment endpoint: Environment validation failed');
  console.error(error.message);
  // Don't exit here as this is a serverless function, let it fail at runtime
}

export default async function handler(req, res) {
  console.log('🔍 Verify Payment Handler - Request received:', {
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
    const { orderId, paymentId, signature } = req.body;

    // Validate required fields
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(orderId + '|' + paymentId);
    const generatedSignature = hmac.digest('hex');

    const isValid = generatedSignature === signature;

    res.status(200).json({ isValid });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      error: 'Payment verification failed',
      message: error.message
    });
  }
}
