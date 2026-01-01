import { getUserSubscription, getUserIdFromToken, validateClientCreation } from './lib/subscriptionValidator.js';

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get user ID from Authorization header
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required. Please sign in.',
        code: 'AUTH_REQUIRED'
      });
    }

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const action = pathname.split('/').pop();

    switch (action) {
      case 'status':
        if (req.method !== 'GET') {
          res.setHeader('Allow', ['GET']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleSubscriptionStatus(userId, res);

      case 'validate-client':
        if (req.method !== 'GET') {
          res.setHeader('Allow', ['GET']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleClientValidation(userId, res);

      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('❌ Subscription API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}

async function handleSubscriptionStatus(userId, res) {
  try {
    const subscription = await getUserSubscription(userId);

    res.status(200).json({
      success: true,
      subscription: {
        tier: subscription.tier,
        videoUploadsUsed: subscription.videoUploadsUsed,
        maxVideoUploads: subscription.maxVideoUploads,
        clientsUsed: subscription.clientsUsed,
        maxClients: subscription.maxClients,
        maxFileSize: subscription.maxFileSize,
        status: subscription.status,
        subscriptionDate: subscription.subscriptionDate,
        expiryDate: subscription.expiryDate
      }
    });
  } catch (error) {
    console.error('❌ Error getting subscription status:', error);
    res.status(500).json({ 
      error: 'Failed to get subscription status',
      code: 'SUBSCRIPTION_ERROR'
    });
  }
}

async function handleClientValidation(userId, res) {
  try {
    const validation = await validateClientCreation(userId);
    
    if (!validation.allowed) {
      return res.status(403).json({ 
        error: validation.error,
        code: validation.code,
        allowed: false
      });
    }

    res.status(200).json({
      allowed: true,
      subscription: validation.subscription,
      currentClientCount: validation.currentClientCount,
      maxClients: validation.subscription.maxClients
    });
  } catch (error) {
    console.error('❌ Error validating client creation:', error);
    res.status(500).json({ 
      error: 'Failed to validate client creation permissions',
      code: 'VALIDATION_ERROR'
    });
  }
}