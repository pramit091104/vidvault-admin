import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin if not already initialized
let db;
let adminInitialized = false;

// In-memory cache for subscription data (5 minute TTL)
const subscriptionCache = new Map();
const tokenCache = new Map(); // Cache for verified tokens
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const TOKEN_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for tokens

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

function getCachedToken(token) {
  const cached = tokenCache.get(token);
  if (cached && Date.now() - cached.timestamp < TOKEN_CACHE_TTL) {
    return cached.userId;
  }
  return null;
}

function setCachedToken(token, userId) {
  tokenCache.set(token, {
    userId,
    timestamp: Date.now()
  });

  // Clean up old tokens to prevent memory leaks
  if (tokenCache.size > 1000) {
    const oldestEntries = Array.from(tokenCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, 100);

    oldestEntries.forEach(([key]) => tokenCache.delete(key));
  }
}

function initializeFirebaseAdmin() {
  if (adminInitialized && db) {
    return db;
  }

  console.log('🔄 Initializing Firebase Admin logic...');
  try {
    if (getApps().length === 0) {
      console.log('   No existing Firebase Apps found. Creating new...');

      let credentials;

      // Try different credential sources
      if (process.env.GCS_CREDENTIALS) {
        try {
          credentials = JSON.parse(process.env.GCS_CREDENTIALS);
          // Fix private key newlines
          if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
          }
          console.log('✅ Using GCS_CREDENTIALS');
        } catch (e) {
          console.error('❌ Invalid JSON in GCS_CREDENTIALS:', e.message);
          throw new Error('Invalid GCS_CREDENTIALS format');
        }
      } else if (process.env.GCS_CREDENTIALS_BASE64) {
        try {
          const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
          credentials = JSON.parse(decoded);
          // Fix private key newlines
          if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
          }
          console.log('✅ Using GCS_CREDENTIALS_BASE64');
        } catch (e) {
          console.error('❌ Invalid base64 or JSON in GCS_CREDENTIALS_BASE64:', e.message);
          throw new Error('Invalid GCS_CREDENTIALS_BASE64 format');
        }
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          // Fix private key newlines
          if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
          }
          console.log('✅ Using FIREBASE_SERVICE_ACCOUNT_KEY');
        } catch (e) {
          console.error('❌ Invalid JSON in FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
          throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format');
        }
      } else if (process.env.GCS_KEY_FILE) {
        try {
          // Resolve path relative to project root (video-server) or absolute
          const keyFilePath = path.isAbsolute(process.env.GCS_KEY_FILE)
            ? process.env.GCS_KEY_FILE
            : path.resolve(process.cwd(), process.env.GCS_KEY_FILE);

          if (fs.existsSync(keyFilePath)) {
            const keyFileContent = fs.readFileSync(keyFilePath, 'utf8');
            credentials = JSON.parse(keyFileContent);
            // Fix private key newlines
            if (credentials.private_key) {
              credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
            }
            console.log('✅ Using GCS_KEY_FILE:', keyFilePath);
          } else {
            console.warn('⚠️ GCS_KEY_FILE defined but file not found at:', keyFilePath);
          }
        } catch (e) {
          console.error('❌ Failed to read GCS_KEY_FILE:', e.message);
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

    db = getFirestore();
    adminInitialized = true;

    return db;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    throw error;
  }
}

// Initialize on module load, but handle errors gracefully
try {
  console.log('🔍 Attempting to initialize Firebase Admin...');
  console.log('   CWD:', process.cwd());
  console.log('   GCS_KEY_FILE env:', process.env.GCS_KEY_FILE);
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

    // Try to initialize Firebase Admin and get subscription
    try {
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
    } catch (firestoreError) {
      // If Firebase/Firestore fails, return default subscription
      console.warn('⚠️ Firebase/Firestore error, returning default subscription:', firestoreError.message);

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

      // Cache the default subscription
      setCachedSubscription(userId, defaultSubscription);
      return defaultSubscription;
    }
  } catch (error) {
    console.error('❌ Critical error getting user subscription:', error);

    // Last resort: return default subscription
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

    return defaultSubscription;
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
 * Extract user ID from Firebase Auth token with caching
 */
export async function getUserIdFromToken(authHeader) {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    // Check token cache first
    const cachedUserId = getCachedToken(token);
    if (cachedUserId) {
      return cachedUserId;
    }

    // Verify token with Firebase Admin
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);

    // Cache the verified token
    setCachedToken(token, decodedToken.uid);

    return decodedToken.uid;
  } catch (error) {
    console.error('❌ Error verifying auth token:', error);
    return null;
  }
}