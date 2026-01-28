import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

      case 'webhook':
        return await handleWebhook(req, res);

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

async function handleWebhook(req, res) {
  console.log('🔍 Webhook Handler - Request received:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    headers: {
      'x-razorpay-signature': req.headers['x-razorpay-signature'] ? '[PRESENT]' : '[MISSING]',
      'content-type': req.headers['content-type']
    }
  });

  try {
    // Get raw body for signature verification
    const rawBody = getRawBody(req);
    if (!rawBody) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Request body is required'
      });
    }

    // Get signature from headers
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({
        error: 'Missing signature',
        message: 'x-razorpay-signature header is required'
      });
    }

    // Verify webhook signature
    const isValidSignature = verifyWebhookSignature(rawBody, signature);
    if (!isValidSignature) {
      return res.status(400).json({
        error: 'Invalid signature',
        message: 'Webhook signature verification failed'
      });
    }

    // Parse webhook payload
    const webhookData = JSON.parse(rawBody);
    console.log('📝 Processing webhook event:', webhookData.event);

    // Extract payment information
    const payment = webhookData.payload.payment?.entity;
    if (!payment) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'No payment data found in webhook'
      });
    }

    // Process webhook based on event type
    let result;
    switch (webhookData.event) {
      case 'payment.captured':
      case 'payment.authorized':
        result = await processSuccessfulPayment(payment);
        break;
      case 'payment.failed':
        result = await processFailedPayment(payment);
        break;
      default:
        console.log(`ℹ️ Unhandled webhook event: ${webhookData.event}`);
        result = { success: true, message: 'Event acknowledged but not processed' };
    }

    // Log processing result
    console.log('✅ Webhook processed:', {
      event: webhookData.event,
      paymentId: payment.id,
      success: result.success
    });

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      event: webhookData.event,
      paymentId: payment.id
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);

    // Determine if this is a retryable error
    const isRetryable = isRetryableWebhookError(error);
    
    if (isRetryable) {
      // Return 500 to signal Razorpay to retry
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Webhook processing failed, will retry',
        retryable: true
      });
    } else {
      // Non-retryable error, return 400
      return res.status(400).json({
        error: 'Bad request',
        message: error.message || 'Invalid webhook request',
        retryable: false
      });
    }
  }
}

// Helper functions for webhook processing

function getRawBody(req) {
  try {
    if (req.body && typeof req.body === 'string') {
      return req.body;
    }

    if (req.body && typeof req.body === 'object') {
      return JSON.stringify(req.body);
    }

    // For serverless functions, body might be pre-parsed
    if (req.rawBody) {
      return req.rawBody;
    }

    return null;
  } catch (error) {
    console.error('Error getting raw body:', error);
    return null;
  }
}

function verifyWebhookSignature(payload, signature) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return false;
    }

    // Create HMAC signature
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Compare signatures using timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function processSuccessfulPayment(payment) {
  try {
    console.log('✅ Processing successful payment:', payment.id);
    
    // Extract user information from payment notes
    const userId = payment.notes.userId;
    const subscriptionTier = payment.notes.subscriptionTier;
    
    if (!userId || !subscriptionTier) {
      throw new Error('Missing user ID or subscription tier in payment notes');
    }

    // In a real implementation, this would:
    // 1. Update the payment transaction record in database
    // 2. Update user subscription based on payment
    // 3. Clear subscription cache
    // 4. Send confirmation notifications
    
    console.log('💰 Payment processed successfully:', {
      paymentId: payment.id,
      userId,
      subscriptionTier,
      amount: payment.amount
    });

    // TODO: Integrate with SubscriptionManager to update subscription
    // TODO: Clear subscription cache
    // TODO: Send notification to user

    return {
      success: true,
      transactionId: payment.id,
      subscriptionUpdated: true
    };
  } catch (error) {
    console.error('Error processing successful payment:', error);
    throw error;
  }
}

async function processFailedPayment(payment) {
  try {
    console.log('❌ Processing failed payment:', payment.id);
    
    // Log failure details
    console.log('💸 Payment failure details:', {
      paymentId: payment.id,
      errorCode: payment.error_code,
      errorDescription: payment.error_description,
      errorSource: payment.error_source
    });

    // TODO: Update transaction status to failed
    // TODO: Log failure for audit trail
    // TODO: Notify user of payment failure

    return {
      success: true,
      transactionId: payment.id,
      subscriptionUpdated: false
    };
  } catch (error) {
    console.error('Error processing failed payment:', error);
    throw error;
  }
}

function isRetryableWebhookError(error) {
  if (!error) return false;

  const nonRetryableErrors = [
    'verification failed',
    'Invalid webhook signature',
    'Missing signature',
    'Invalid request',
    'JSON',
    'SyntaxError'
  ];

  const errorMessage = error.message || error.toString();
  
  // Don't retry signature verification failures or malformed requests
  if (nonRetryableErrors.some(nonRetryable => 
    errorMessage.toLowerCase().includes(nonRetryable.toLowerCase()))) {
    return false;
  }

  // Retry network errors, timeouts, and database issues
  const retryableErrors = [
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'NETWORK_ERROR',
    'TIMEOUT',
    'SERVICE_UNAVAILABLE',
    'DATABASE_ERROR',
    'TRANSACTION_ERROR'
  ];

  return retryableErrors.some(retryableError => 
    errorMessage.includes(retryableError) || 
    error.code === retryableError
  );
}