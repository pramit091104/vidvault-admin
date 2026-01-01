import { validateFileUpload, getUserIdFromToken } from '../lib/subscriptionValidator.js';

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
    const { fileSize } = req.body;

    if (!fileSize || typeof fileSize !== 'number') {
      return res.status(400).json({ 
        error: 'File size is required and must be a number',
        code: 'INVALID_INPUT'
      });
    }

    // Get user ID from Authorization header
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required. Please sign in to validate upload.',
        code: 'AUTH_REQUIRED'
      });
    }

    // Validate upload permissions and limits
    const validation = await validateFileUpload(userId, fileSize);
    
    if (!validation.allowed) {
      return res.status(403).json({ 
        error: validation.error,
        code: validation.code,
        allowed: false
      });
    }

    res.status(200).json({
      allowed: true,
      subscription: validation.subscription
    });

  } catch (error) {
    console.error('❌ Error validating upload:', error);
    res.status(500).json({ 
      error: 'Failed to validate upload permissions',
      code: 'VALIDATION_ERROR'
    });
  }
}