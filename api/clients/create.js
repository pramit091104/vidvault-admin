import { validateClientCreation, incrementClientCount, getUserIdFromToken } from '../lib/subscriptionValidator.js';

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

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from Authorization header
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required. Please sign in to create clients.',
        code: 'AUTH_REQUIRED'
      });
    }

    // Validate client creation permissions
    const validation = await validateClientCreation(userId);
    
    if (!validation.allowed) {
      return res.status(403).json({ 
        error: validation.error,
        code: validation.code
      });
    }

    // Get client data from request body
    const { clientName, work, status, duration } = req.body;

    if (!clientName || !work) {
      return res.status(400).json({ 
        error: 'Missing required fields: clientName and work' 
      });
    }

    // Here you would typically create the client in your database
    // For now, we'll just increment the count and return success
    
    try {
      await incrementClientCount(userId);
      console.log(`📊 Incremented client count for user: ${userId}`);
    } catch (error) {
      console.error('❌ Failed to increment client count:', error);
      return res.status(500).json({ 
        error: 'Failed to update client count',
        code: 'COUNT_UPDATE_ERROR'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Client creation validated and count updated',
      subscription: {
        tier: validation.subscription.tier,
        clientsUsed: validation.currentClientCount + 1,
        maxClients: validation.subscription.maxClients
      }
    });

  } catch (error) {
    console.error('❌ Error creating client:', error);
    res.status(500).json({ 
      error: 'Failed to create client',
      code: 'CREATION_ERROR'
    });
  }
}