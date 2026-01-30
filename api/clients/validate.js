import { validateClientCreation, getUserIdFromToken } from '../lib/subscriptionValidator.js';

export default async function handler(req, res) {

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
        error: 'Authentication required. Please sign in to validate client creation.',
        code: 'AUTH_REQUIRED'
      });
    }

    // Validate client creation permissions
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