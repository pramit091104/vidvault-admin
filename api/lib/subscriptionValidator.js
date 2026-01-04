import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin if not already initialized
let db;

// In-memory cache for subscription data (5 minute TTL)
const subscriptionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache helper functions
function getCachedSubscription(userId) {
  const cached = subscriptionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedSubscription(userId, data) {
  subscriptionCache.set(userId, {
    data,
    timestamp: Date.now()
  });
}

function initializeFirebaseAdmin() {
  try {
    if (getApps().length === 0) {
      let credentials;
      
      // Try different credential sources
      if (process.env.GCS_CREDENTIALS) {
        try {
          credentials = JSON.parse(process.env.GCS_CREDENTIALS);
          console.log('✅ Using GCS_CREDENTIALS');
        } catch (e) {
          console.error('❌ Invalid JSON in GCS_CREDENTIALS:', e.message);
          throw new Error('Invalid GCS_CREDENTIALS format');
        }
      } else if (process.env.GCS_CREDENTIALS_BASE64) {
        try {
          const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
          credentials = JSON.parse(decoded);
          console.log('✅ Using GCS_CREDENTIALS_BASE64');
        } catch (e) {
          console.error('❌ Invalid base64 or JSON in GCS_CREDENTIALS_BASE64:', e.message);
          throw new Error('Invalid GCS_CREDENTIALS_BASE64 format');
        }
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          console.log('✅ Using FIREBASE_SERVICE_ACCOUNT_KEY');
        } catch (e) {
          console.error('❌ Invalid JSON in FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
          throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format');
        }
      }

      if (credentials) {
        // Validate required credential fields
        if (!credentials.private_key || !credentials.client_email || !credentials.project_id) {
          throw new Error('Firebase credentials missing required fields (private_key, client_email, project_id)');
        }

        const projectId = process.env.GCS_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || credentials.project_id;
        
        initializeApp({
          credential: cert(credentials),
          projectId: projectId
        });
        console.log(`✅ Firebase Admin initialized successfully for project: ${projectId}`);
      } else {
        console.error('❌ No Firebase credentials found in environment variables');
        console.error('Required: GCS_CREDENTIALS, GCS_CREDENTIALS_BASE64, or FIREBASE_SERVICE_ACCOUNT_KEY');
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

/**
 * Get user subscription from Firestore with caching
 */
export async function getUserSubscription(userId) {
  try {
    // Check cache first
    const cached = getCachedSubscription(userId);
    if (cached) {
      return cached;
    }

    // Ensure Firebase Admin is initialized
    const database = db || initializeFirebaseAdmin();
    
    const docRef = database.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
    const doc = await docRef.get();
    
    let subscription;
    if (!doc.exists) {
      // Return default free subscription
      subscription = {
        userId,
        tier: 'free',
        videoUploadsUsed: 0,
        maxVideoUploads: 5,
        clientsUsed: 0,
        maxClients: 5,
        maxFileSize: 100, // 100MB
        status: 'active'
      };
    } else {
      const data = doc.data();
      subscription = {
        ...data,
        subscriptionDate: data.subscriptionDate?.toDate(),
        expiryDate: data.expiryDate?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      };
    }

    // Cache the result
    setCachedSubscription(userId, subscription);
    return subscription;
  } catch (error) {
    console.error('❌ Error getting user subscription:', error);
    
    // Handle permission errors gracefully by returning default subscription
    if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
      console.warn('⚠️ Firestore permission denied, returning default subscription');
      const defaultSubscription = {
        userId,
        tier: 'free',
        videoUploadsUsed: 0,
        maxVideoUploads: 5,
        clientsUsed: 0,
        maxClients: 5,
        maxFileSize: 100, // 100MB
        status: 'active'
      };
      setCachedSubscription(userId, defaultSubscription);
      return defaultSubscription;
    }
    
    throw error;
  }
}

/**
 * Validate if user can upload a file
 */
export async function validateFileUpload(userId, fileSize) {
  try {
    const subscription = await getUserSubscription(userId);
    
    // Check upload count limit
    if (subscription.videoUploadsUsed >= subscription.maxVideoUploads) {
      return {
        allowed: false,
        error: `Upload limit reached. ${subscription.tier === 'free' ? 'Upgrade to Premium for 50 uploads per month.' : 'You have reached your monthly upload limit.'}`,
        code: 'UPLOAD_LIMIT_EXCEEDED'
      };
    }
    
    // Check file size limit (convert MB to bytes)
    const maxSizeBytes = subscription.maxFileSize * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
      return {
        allowed: false,
        error: `File too large. Maximum size is ${subscription.maxFileSize}MB for ${subscription.tier} users. ${subscription.tier === 'free' ? 'Upgrade to Premium for larger file uploads.' : 'Please compress your video first.'}`,
        code: 'FILE_SIZE_EXCEEDED'
      };
    }
    
    return {
      allowed: true,
      subscription
    };
  } catch (error) {
    console.error('❌ Error validating file upload:', error);
    return {
      allowed: false,
      error: 'Failed to validate upload permissions',
      code: 'VALIDATION_ERROR'
    };
  }
}

/**
 * Validate if user can add a client (optimized with cached counts)
 */
export async function validateClientCreation(userId) {
  try {
    const subscription = await getUserSubscription(userId);
    
    // Use cached client count from subscription document instead of querying all clients
    const currentClientCount = subscription.clientsUsed || 0;
    
    // Check client limit
    if (currentClientCount >= subscription.maxClients) {
      return {
        allowed: false,
        error: `Client limit reached. ${subscription.tier === 'free' ? 'Upgrade to Premium for 50 clients.' : 'You have reached your client limit.'}`,
        code: 'CLIENT_LIMIT_EXCEEDED',
        currentClientCount,
        maxClients: subscription.maxClients
      };
    }
    
    return {
      allowed: true,
      subscription,
      currentClientCount,
      maxClients: subscription.maxClients
    };
  } catch (error) {
    console.error('❌ Error validating client creation:', error);
    
    // Handle permission errors gracefully
    if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
      console.warn('⚠️ Firestore permission denied, allowing client creation with default limits');
      const subscription = await getUserSubscription(userId); // This will return default subscription
      return {
        allowed: true,
        subscription,
        currentClientCount: 0, // Default to 0 if we can't check
        maxClients: subscription.maxClients
      };
    }
    
    return {
      allowed: false,
      error: 'Failed to validate client creation permissions',
      code: 'VALIDATION_ERROR'
    };
  }
}

/**
 * Increment video upload count with cache invalidation
 */
export async function incrementVideoUploadCount(userId) {
  try {
    const database = db || initializeFirebaseAdmin();

    const docRef = database.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      // Create default subscription and increment
      await docRef.set({
        userId,
        tier: 'free',
        videoUploadsUsed: 1,
        maxVideoUploads: 5,
        clientsUsed: 0,
        maxClients: 5,
        maxFileSize: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Increment existing count
      await docRef.update({
        videoUploadsUsed: (doc.data().videoUploadsUsed || 0) + 1,
        updatedAt: new Date()
      });
    }
    
    // Invalidate cache to ensure fresh data on next read
    subscriptionCache.delete(userId);
    
    return true;
  } catch (error) {
    console.error('❌ Error incrementing video upload count:', error);
    
    // Handle permission errors gracefully
    if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
      console.warn('⚠️ Firestore permission denied, skipping upload count increment');
      return true; // Don't fail the upload due to counting issues
    }
    
    throw error;
  }
}

/**
 * Increment client count with cache invalidation
 */
export async function incrementClientCount(userId) {
  try {
    const database = db || initializeFirebaseAdmin();

    const docRef = database.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      // Create default subscription and increment
      await docRef.set({
        userId,
        tier: 'free',
        videoUploadsUsed: 0,
        maxVideoUploads: 5,
        clientsUsed: 1,
        maxClients: 5,
        maxFileSize: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Increment existing count
      await docRef.update({
        clientsUsed: (doc.data().clientsUsed || 0) + 1,
        updatedAt: new Date()
      });
    }
    
    // Invalidate cache to ensure fresh data on next read
    subscriptionCache.delete(userId);
    
    return true;
  } catch (error) {
    console.error('❌ Error incrementing client count:', error);
    
    // Handle permission errors gracefully
    if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
      console.warn('⚠️ Firestore permission denied, skipping client count increment');
      return true; // Don't fail the client creation due to counting issues
    }
    
    throw error;
  }
}

/**
 * Extract user ID from Firebase Auth token
 */
export async function getUserIdFromToken(authHeader) {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    
    // For development, you might want to decode the token
    // In production, you should verify it with Firebase Admin
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    
    return decodedToken.uid;
  } catch (error) {
    console.error('❌ Error verifying auth token:', error);
    return null;
  }
}