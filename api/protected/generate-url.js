import { contentProtection } from '../../middleware/contentProtection.js';
import { getVideoBySlugOrId } from '../../src/integrations/firebase/videoService.js';

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For now, skip Firebase auth verification - add it later
    // const authHeader = req.headers.authorization;
    // if (!authHeader || !authHeader.startsWith('Bearer ')) {
    //   return res.status(401).json({ error: 'Authentication required' });
    // }

    const { videoId, permissions = {} } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    // Generate access token with content protection
    const userId = 'anonymous-user'; // TODO: Extract from verified Firebase token
    const accessToken = contentProtection.generateAccessToken(userId, videoId, {
      canDownload: permissions.canDownload || false,
      canStream: permissions.canStream !== false, // Default to true
      quality: permissions.quality || 'standard',
      maxUses: permissions.maxUses || 10,
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes instead of 1 hour
      restrictToIp: req.ip, // Bind to user's IP
      allowedReferrers: [req.headers.origin || req.headers.referer]
    });

    // Generate protected streaming URL
    const protectedUrl = `/api/protected/stream?videoId=${videoId}&token=${accessToken}`;
    
    res.json({
      protectedUrl,
      expiresAt: Date.now() + (15 * 60 * 1000),
      permissions: {
        canDownload: permissions.canDownload || false,
        canStream: permissions.canStream !== false,
        quality: permissions.quality || 'standard',
        maxUses: permissions.maxUses || 10
      },
      remainingUses: permissions.maxUses || 10
    });

  } catch (error) {
    console.error('Generate protected URL error:', error);
    res.status(500).json({ error: 'Failed to generate protected URL' });
  }
}