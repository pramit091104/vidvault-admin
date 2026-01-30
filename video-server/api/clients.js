import { validateClientCreation, incrementClientCount, getUserIdFromToken } from './lib/subscriptionValidator.js';

export default async function handler(req, res) {

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
      case 'validate':
        if (req.method !== 'GET') {
          res.setHeader('Allow', ['GET']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleClientValidation(userId, res);

      case 'create':
        if (req.method !== 'POST') {
          res.setHeader('Allow', ['POST']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleClientCreation(userId, req, res);

      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('❌ Clients API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'SERVER_ERROR'
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

async function handleClientCreation(userId, req, res) {
  try {
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

    // Increment client count
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