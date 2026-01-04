import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (only once)
if (getApps().length === 0) {
  try {
    const credentials = process.env.GCS_CREDENTIALS ? JSON.parse(process.env.GCS_CREDENTIALS) : null;
    if (credentials) {
      initializeApp({
        credential: cert(credentials),
        projectId: process.env.GCS_PROJECT_ID
      });
    }
  } catch (error) {
    console.warn('Firebase Admin initialization skipped:', error.message);
  }
}

const db = getFirestore();

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
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    // Get video document
    const videoDoc = await db.collection('gcsClientCodes').doc(videoId).get();
    
    if (!videoDoc.exists) {
      return res.status(404).json({ 
        error: 'Video not found',
        hasAccess: false 
      });
    }

    const videoData = videoDoc.data();
    
    // Check if video is active
    if (!videoData.isActive) {
      return res.status(404).json({ 
        error: 'Video not available',
        hasAccess: false 
      });
    }

    // Check if video link has expired
    if (videoData.linkExpiresAt && new Date() > videoData.linkExpiresAt.toDate()) {
      return res.status(410).json({ 
        error: 'Video link has expired',
        hasAccess: false 
      });
    }

    // Verify authentication if token provided
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await getAuth().verifyIdToken(idToken);
        userId = decodedToken.uid;
      } catch (authError) {
        console.log('Token verification failed:', authError.message);
      }
    }

    // Check if user has access (owner or public video)
    const hasAccess = videoData.isPublic || 
                     videoData.isPubliclyAccessible || 
                     (userId && videoData.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied',
        hasAccess: false 
      });
    }

    res.status(200).json({ 
      hasAccess: true,
      videoId: videoId,
      title: videoData.title,
      expiresAt: videoData.linkExpiresAt ? videoData.linkExpiresAt.toDate().toISOString() : null
    });

  } catch (error) {
    console.error('Video access validation error:', error);
    res.status(500).json({ 
      error: 'Failed to validate video access',
      hasAccess: false 
    });
  }
}