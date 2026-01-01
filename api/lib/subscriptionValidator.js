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
      
      // Try different credential sources
      if (process.env.GCS_CREDENTIALS) {
        credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      } else if (process.env.GCS_CREDENTIALS_BASE64) {
        const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        // Alternative environment variable name for Vercel
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

/**
 * Get user subscription from Firestore
 */
export async function getUserSubscription(userId) {
  try {
    // Ensure Firebase Admin is initialized
    const database = db || initializeFirebaseAdmin();
    
    const docRef = database.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      // Return default free subscription
      return {
        userId,
        tier: 'free',
        videoUploadsUsed: 0,
        maxVideoUploads: 5,
        clientsUsed: 0,
        maxClients: 5,
        maxFileSize: 50, // 50MB
        status: 'active'
      };
    }
    
    const data = doc.data();
    return {
      ...data,
      subscriptionDate: data.subscriptionDate?.toDate(),
      expiryDate: data.expiryDate?.toDate(),
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    };
  } catch (error) {
    console.error('❌ Error getting user subscription:', error);
    
    // Handle permission errors gracefully by returning default subscription
    if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
      console.warn('⚠️ Firestore permission denied, returning default subscription');
      return {
        userId,
        tier: 'free',
        videoUploadsUsed: 0,
        maxVideoUploads: 5,
        clientsUsed: 0,
        maxClients: 5,
        maxFileSize: 50, // 50MB
        status: 'active'
      };
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
 * Validate if user can add a client
 */
export async function validateClientCreation(userId) {
  try {
    const subscription = await getUserSubscription(userId);
    
    // Get current client count from Firestore
    const database = db || initializeFirebaseAdmin();
    const clientsRef = database.collection('clients');
    const clientsQuery = clientsRef.where('userId', '==', userId);
    const clientsSnapshot = await clientsQuery.get();
    const currentClientCount = clientsSnapshot.size;
    
    // Check client limit
    if (currentClientCount >= subscription.maxClients) {
      return {
        allowed: false,
        error: `Client limit reached. ${subscription.tier === 'free' ? 'Upgrade to Premium for 50 clients.' : 'You have reached your client limit.'}`,
        code: 'CLIENT_LIMIT_EXCEEDED'
      };
    }
    
    return {
      allowed: true,
      subscription,
      currentClientCount
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
        currentClientCount: 0 // Default to 0 if we can't check
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
 * Increment video upload count
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
        maxFileSize: 50,
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
 * Increment client count
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
        maxFileSize: 50,
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