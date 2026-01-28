import { getUserSubscription, getUserIdFromToken, validateClientCreation } from './lib/subscriptionValidator.js';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin if not already initialized
let db;

function initializeFirebaseAdmin() {
  try {
    if (getApps().length === 0) {
      let credentials;
      
      if (process.env.GCS_CREDENTIALS) {
        credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      } else if (process.env.GCS_CREDENTIALS_BASE64) {
        const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      }

      if (credentials) {
        initializeApp({
          credential: cert(credentials),
          projectId: process.env.GCS_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
        });
        console.log('✅ Firebase Admin initialized successfully');
      } else {
        console.warn('⚠️ No Firebase credentials found in environment variables');
        throw new Error('Firebase credentials not found');
      }
    }
    
    if (!db) {
      db = getFirestore();
    }
    
    return db;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    throw error;
  }
}

// Initialize on module load, but handle errors gracefully
try {
  initializeFirebaseAdmin();
} catch (error) {
  console.warn('Firebase Admin initialization deferred due to:', error.message);
}

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

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

      case 'update':
        if (req.method !== 'POST') {
          res.setHeader('Allow', ['POST']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleSubscriptionUpdate(userId, req, res);

      case 'validate-client':
        if (req.method !== 'GET') {
          res.setHeader('Allow', ['GET']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleClientValidation(userId, res);

      case 'increment-video':
        if (req.method !== 'POST') {
          res.setHeader('Allow', ['POST']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleIncrementVideo(userId, res);

      case 'increment-client':
        if (req.method !== 'POST') {
          res.setHeader('Allow', ['POST']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleIncrementClient(userId, res);

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
    // Import cache manager for unified caching
    const { cacheManager } = await import('../middleware/cacheManager.js');
    
    // Check cache first with unified TTL (3 minutes)
    const cacheKey = `subscription_${userId}`;
    let subscription = await cacheManager.get('subscription', userId);
    
    if (!subscription) {
      // Use optimized subscription service with caching
      const { OptimizedSubscriptionService } = await import('../middleware/batchOperations.js');
      subscription = await OptimizedSubscriptionService.getSubscription(userId);
      
      // Cache with unified 3-minute TTL
      await cacheManager.set('subscription', userId, subscription, 180); // 3 minutes in seconds
    }

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

async function handleSubscriptionUpdate(userId, req, res) {
  try {
    const { 
      tier, 
      maxVideoUploads, 
      maxClients, 
      maxFileSize,
      subscriptionDate,
      expiryDate,
      status = 'active'
    } = req.body;

    // Validate required fields
    if (!tier || !maxVideoUploads || !maxClients || !maxFileSize) {
      return res.status(400).json({ 
        error: 'Missing required fields: tier, maxVideoUploads, maxClients, maxFileSize' 
      });
    }

    // Validate tier
    if (!['free', 'premium'].includes(tier)) {
      return res.status(400).json({ 
        error: 'Invalid tier. Must be "free" or "premium"' 
      });
    }

    // Ensure Firebase Admin is initialized
    const database = db || initializeFirebaseAdmin();
    
    const docRef = database.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
    const doc = await docRef.get();
    
    const subscriptionData = {
      userId,
      tier,
      maxVideoUploads,
      maxClients,
      maxFileSize,
      status,
      updatedAt: new Date()
    };

    // Add subscription and expiry dates if provided
    if (subscriptionDate) {
      subscriptionData.subscriptionDate = new Date(subscriptionDate);
    }
    if (expiryDate) {
      subscriptionData.expiryDate = new Date(expiryDate);
    }

    if (!doc.exists) {
      // Create new subscription document
      subscriptionData.videoUploadsUsed = 0;
      subscriptionData.clientsUsed = 0;
      subscriptionData.createdAt = new Date();
      
      await docRef.set(subscriptionData);
      console.log(`✅ Created new subscription for user: ${userId} (${tier})`);
    } else {
      // Update existing subscription, preserve usage counts
      const existingData = doc.data();
      subscriptionData.videoUploadsUsed = existingData.videoUploadsUsed || 0;
      subscriptionData.clientsUsed = existingData.clientsUsed || 0;
      subscriptionData.createdAt = existingData.createdAt || new Date();
      
      await docRef.set(subscriptionData, { merge: true });
      console.log(`✅ Updated subscription for user: ${userId} (${tier})`);
    }

    // Return the updated subscription
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();
    
    // Invalidate cache after subscription update to ensure consistency
    const { cacheManager } = await import('../middleware/cacheManager.js');
    await cacheManager.delete('subscription', userId);
    
    res.status(200).json({
      success: true,
      subscription: {
        tier: updatedData.tier,
        videoUploadsUsed: updatedData.videoUploadsUsed,
        maxVideoUploads: updatedData.maxVideoUploads,
        clientsUsed: updatedData.clientsUsed,
        maxClients: updatedData.maxClients,
        maxFileSize: updatedData.maxFileSize,
        status: updatedData.status,
        subscriptionDate: updatedData.subscriptionDate?.toDate(),
        expiryDate: updatedData.expiryDate?.toDate(),
        createdAt: updatedData.createdAt?.toDate(),
        updatedAt: updatedData.updatedAt?.toDate()
      }
    });

  } catch (error) {
    console.error('❌ Error updating subscription:', error);
    
    // Handle permission errors gracefully
    if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
      console.warn('⚠️ Firestore permission denied for subscription update');
      return res.status(500).json({ 
        error: 'Unable to update subscription due to database permissions',
        code: 'PERMISSION_DENIED'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update subscription',
      code: 'UPDATE_ERROR'
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

async function handleIncrementVideo(userId, res) {
  try {
    // Import batch operations dynamically
    const { OptimizedSubscriptionService } = await import('../middleware/batchOperations.js');
    await OptimizedSubscriptionService.incrementVideoUploadCount(userId);
    
    // Invalidate cache after increment to ensure consistency
    const { cacheManager } = await import('../middleware/cacheManager.js');
    await cacheManager.delete('subscription', userId);
    
    res.status(200).json({
      success: true,
      message: 'Video upload count incremented'
    });
  } catch (error) {
    console.error('❌ Error incrementing video count:', error);
    res.status(500).json({ 
      error: 'Failed to increment video upload count',
      code: 'INCREMENT_ERROR'
    });
  }
}

async function handleIncrementClient(userId, res) {
  try {
    // Import batch operations dynamically
    const { OptimizedSubscriptionService } = await import('../middleware/batchOperations.js');
    await OptimizedSubscriptionService.incrementClientCount(userId);
    
    // Invalidate cache after increment to ensure consistency
    const { cacheManager } = await import('../middleware/cacheManager.js');
    await cacheManager.delete('subscription', userId);
    
    res.status(200).json({
      success: true,
      message: 'Client count incremented'
    });
  } catch (error) {
    console.error('❌ Error incrementing client count:', error);
    res.status(500).json({ 
      error: 'Failed to increment client count',
      code: 'INCREMENT_ERROR'
    });
  }
}