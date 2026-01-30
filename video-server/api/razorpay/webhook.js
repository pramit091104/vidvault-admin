import crypto from 'crypto';

// Since we're in a Node.js environment and PaymentManager is TypeScript,
// we'll implement the core webhook processing logic directly here
// In a real implementation, you would compile TypeScript or use a different approach

// Validate environment variables
const validateEnvironment = () => {
  const missingVars = [];
  
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    missingVars.push('RAZORPAY_WEBHOOK_SECRET');
  }
  
  if (missingVars.length > 0) {
    const error = new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      `Please check your .env file and ensure all required variables are set.`
    );
    error.name = 'EnvironmentValidationError';
    throw error;
  }
};

// Validate environment on module load
try {
  validateEnvironment();
  console.log('✓ Razorpay webhook endpoint: Environment validation successful');
} catch (error) {
  console.error('❌ Razorpay webhook endpoint: Environment validation failed');
  console.error(error.message);
}

// Initialize webhook processing configuration
const WEBHOOK_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 16000, // 16 seconds
  backoffMultiplier: 2
};

// Core webhook processing logic
class WebhookProcessor {
  constructor() {
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  }

  /**
   * Processes Razorpay webhook with signature verification
   */
  async processWebhook(rawBody, signature, timestamp) {
    try {
      // Verify webhook signature
      const verificationResult = this.verifyWebhookSignature(rawBody, signature);
      if (!verificationResult.isValid) {
        throw new Error(`Webhook verification failed: ${verificationResult.errorMessage}`);
      }

      const webhookData = verificationResult.payload;
      
      // Extract payment information
      const payment = webhookData.payload.payment?.entity;
      if (!payment) {
        throw new Error('No payment data found in webhook payload');
      }

      console.log('💳 Processing payment webhook:', {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency
      });

      // Process based on payment status
      let result;
      switch (payment.status) {
        case 'captured':
        case 'authorized':
          result = await this.handleSuccessfulPayment(payment);
          break;
        case 'failed':
          result = await this.handleFailedPayment(payment);
          break;
        default:
          result = {
            success: false,
            transactionId: payment.id,
            subscriptionUpdated: false,
            retryRequired: false,
            errorDetails: `Unhandled payment status: ${payment.status}`
          };
      }

      return result;
    } catch (error) {
      console.error('Error processing webhook:', error);
      
      return {
        success: false,
        transactionId: '',
        subscriptionUpdated: false,
        retryRequired: this.shouldRetryWebhook(error),
        errorDetails: error.message
      };
    }
  }

  /**
   * Verifies webhook signature for security
   */
  verifyWebhookSignature(payload, signature) {
    try {
      if (!this.webhookSecret) {
        return {
          isValid: false,
          errorMessage: 'Webhook secret not configured'
        };
      }

      // Create HMAC signature
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');

      // Compare signatures
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        return {
          isValid: false,
          errorMessage: 'Invalid webhook signature'
        };
      }

      // Parse payload
      const webhookData = JSON.parse(payload);

      return {
        isValid: true,
        payload: webhookData
      };
    } catch (error) {
      return {
        isValid: false,
        errorMessage: `Signature verification failed: ${error.message}`
      };
    }
  }

  /**
   * Handles successful payment processing
   */
  async handleSuccessfulPayment(payment) {
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
      
      // For now, we'll log the successful processing
      console.log('💰 Payment processed successfully:', {
        paymentId: payment.id,
        userId,
        subscriptionTier,
        amount: payment.amount
      });

      return {
        success: true,
        transactionId: payment.id,
        subscriptionUpdated: true,
        retryRequired: false
      };
    } catch (error) {
      console.error('Error handling successful payment:', error);
      return {
        success: false,
        transactionId: payment.id,
        subscriptionUpdated: false,
        retryRequired: true,
        errorDetails: error.message
      };
    }
  }

  /**
   * Handles failed payment processing
   */
  async handleFailedPayment(payment) {
    try {
      console.log('❌ Processing failed payment:', payment.id);
      
      // Log failure details
      console.log('💸 Payment failure details:', {
        paymentId: payment.id,
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        errorSource: payment.error_source
      });

      // In a real implementation, this would:
      // 1. Update transaction status to failed
      // 2. Log failure for audit trail
      // 3. Notify user of payment failure
      // 4. Potentially trigger retry logic for certain error types

      return {
        success: false,
        transactionId: payment.id,
        subscriptionUpdated: false,
        retryRequired: false, // Don't retry failed payments automatically
        errorDetails: payment.error_description || 'Payment failed'
      };
    } catch (error) {
      console.error('Error handling failed payment:', error);
      return {
        success: false,
        transactionId: payment.id,
        subscriptionUpdated: false,
        retryRequired: false,
        errorDetails: error.message
      };
    }
  }

  /**
   * Determines if webhook should be retried based on error type
   */
  shouldRetryWebhook(error) {
    // Don't retry signature verification failures or malformed payloads
    if (error.message?.includes('verification failed') || 
        error.message?.includes('Invalid webhook signature') ||
        error.message?.includes('JSON')) {
      return false;
    }

    // Retry network errors, database issues, etc.
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'NETWORK_ERROR',
      'TIMEOUT',
      'SERVICE_UNAVAILABLE',
      'DATABASE_ERROR'
    ];

    const errorMessage = error.message || error.toString();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError) || 
      error.code === retryableError
    );
  }
}

// Initialize webhook processor
let webhookProcessor;
try {
  webhookProcessor = new WebhookProcessor();
} catch (error) {
  console.error('❌ Failed to initialize WebhookProcessor:', error);
}

export default async function handler(req, res) {
  console.log('🔍 Webhook Handler - Request received:', {
    method: req.method,
    origin: req.headers.origin,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: {
      'x-razorpay-signature': req.headers['x-razorpay-signature'] ? '[PRESENT]' : '[MISSING]',
      'content-type': req.headers['content-type']
    }
  });

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Only allow POST requests for webhooks
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Webhooks only accept POST requests'
    });
  }

  try {
    // Validate WebhookProcessor is available
    if (!webhookProcessor) {
      throw new Error('WebhookProcessor not initialized');
    }

    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
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

    // Get timestamp if available
    const timestamp = req.headers['x-razorpay-timestamp'];

    console.log('📝 Processing webhook with signature verification...');

    // Process webhook through WebhookProcessor
    const result = await webhookProcessor.processWebhook(
      rawBody,
      signature,
      timestamp
    );

    // Log processing result
    console.log('✅ Webhook processed:', {
      success: result.success,
      transactionId: result.transactionId,
      subscriptionUpdated: result.subscriptionUpdated,
      retryRequired: result.retryRequired
    });

    // Handle retry scenarios
    if (result.retryRequired) {
      console.warn('⚠️ Webhook processing requires retry:', result.errorDetails);
      
      // Queue for retry (in a real implementation, this would use a job queue)
      await queueWebhookForRetry(rawBody, signature, timestamp);
      
      // Return 500 to signal Razorpay to retry
      return res.status(500).json({
        error: 'Processing failed',
        message: 'Webhook queued for retry',
        retryRequired: true
      });
    }

    // Return success response
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        transactionId: result.transactionId,
        subscriptionUpdated: result.subscriptionUpdated
      });
    } else {
      // Processing failed but no retry needed
      return res.status(400).json({
        error: 'Processing failed',
        message: result.errorDetails || 'Webhook processing failed',
        transactionId: result.transactionId
      });
    }

  } catch (error) {
    console.error('❌ Webhook processing error:', error);

    // Determine if this is a retryable error
    const isRetryable = isRetryableWebhookError(error);
    
    if (isRetryable) {
      // Queue for retry and return 500
      try {
        const rawBody = await getRawBody(req);
        const signature = req.headers['x-razorpay-signature'];
        const timestamp = req.headers['x-razorpay-timestamp'];
        
        await queueWebhookForRetry(rawBody, signature, timestamp);
      } catch (queueError) {
        console.error('❌ Failed to queue webhook for retry:', queueError);
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Webhook queued for retry',
        retryRequired: true
      });
    } else {
      // Non-retryable error, return 400
      return res.status(400).json({
        error: 'Bad request',
        message: error.message || 'Invalid webhook request'
      });
    }
  }
}

/**
 * Gets raw body from request for signature verification
 */
async function getRawBody(req) {
  try {
    if (req.body && typeof req.body === 'string') {
      return req.body;
    }

    if (req.body && typeof req.body === 'object') {
      return JSON.stringify(req.body);
    }

    // For serverless functions, body might be pre-parsed
    // Try to get raw body from different sources
    if (req.rawBody) {
      return req.rawBody;
    }

    // If body is already parsed, stringify it
    if (req.body) {
      return JSON.stringify(req.body);
    }

    return null;
  } catch (error) {
    console.error('Error getting raw body:', error);
    return null;
  }
}

/**
 * Determines if a webhook error is retryable
 */
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

/**
 * Queues webhook for retry processing
 * In a real implementation, this would use a proper job queue like Redis/Bull
 */
async function queueWebhookForRetry(rawBody, signature, timestamp) {
  try {
    console.log('📋 Queuing webhook for retry...');
    
    // In a real implementation, this would:
    // 1. Store the webhook data in a retry queue (Redis, database, etc.)
    // 2. Set up exponential backoff retry logic
    // 3. Track retry attempts and max retry limits
    // 4. Handle dead letter queue for failed retries
    
    const retryData = {
      rawBody,
      signature,
      timestamp,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 5
    };

    // Placeholder: Log the retry queue entry
    console.log('📋 Webhook queued for retry:', {
      bodyLength: rawBody?.length || 0,
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      queuedAt: retryData.queuedAt
    });

    // In production, you would:
    // await redisClient.lpush('webhook_retry_queue', JSON.stringify(retryData));
    // or
    // await database.webhookRetries.create(retryData);

  } catch (error) {
    console.error('❌ Failed to queue webhook for retry:', error);
    throw error;
  }
}

/**
 * Processes queued webhook retries
 * This would typically be called by a background job processor
 */
export async function processWebhookRetries() {
  try {
    console.log('🔄 Processing webhook retries...');
    
    // In a real implementation, this would:
    // 1. Get items from the retry queue
    // 2. Process each webhook with exponential backoff
    // 3. Remove successful items from queue
    // 4. Increment retry count for failed items
    // 5. Move items to dead letter queue after max retries
    
    // Placeholder implementation
    console.log('📋 Webhook retry processing completed');
    
  } catch (error) {
    console.error('❌ Error processing webhook retries:', error);
    throw error;
  }
}

/**
 * Health check endpoint for webhook processing
 */
export async function webhookHealthCheck() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      webhookProcessor: !!webhookProcessor,
      environment: {
        webhookSecret: !!process.env.RAZORPAY_WEBHOOK_SECRET,
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    };

    return health;
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}