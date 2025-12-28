import crypto from 'crypto';

export default async function handler(req, res) {
  // Enable CORS for your domain
  const allowedOrigins = [
    'https://previu.online',
    'https://www.previu.online',
    'http://localhost:8080',
    'http://localhost:5173'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
