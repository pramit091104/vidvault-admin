import { getUserSubscription, getUserIdFromToken } from '../lib/subscriptionValidator.js';

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from Authorization header
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required. Please sign in to check subscription status.',
        code: 'AUTH_REQUIRED'
      });
    }

    // Get user subscription
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