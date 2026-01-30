import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import cacheManager from './cacheManager.js';

// Initialize Firebase Admin
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
      }

      if (credentials) {
        initializeApp({
          credential: cert(credentials),
          projectId: process.env.GCS_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
        });
      }
    }
    
    if (!db) {
      db = getFirestore();
    }
    
    return db;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin for batch operations:', error);
    throw error;
  }
}

// Batch operation manager
class BatchOperationManager {
  constructor() {
    this.pendingOperations = new Map(); // userId -> operations array
    this.batchTimeout = 100; // 100ms batch window
    this.maxBatchSize = 500; // Firestore limit
    this.flushTimers = new Map(); // userId -> timer
  }

  // Add operation to batch
  addOperation(userId, operation) {
    if (!this.pendingOperations.has(userId)) {
      this.pendingOperations.set(userId, []);
    }

    const operations = this.pendingOperations.get(userId);
    operations.push(operation);

    // Clear existing timer
    if (this.flushTimers.has(userId)) {
      clearTimeout(this.flushTimers.get(userId));
    }

    // Set new timer or flush immediately if batch is full
    if (operations.length >= this.maxBatchSize) {
      this.flushBatch(userId);
    } else {
      const timer = setTimeout(() => {
        this.flushBatch(userId);
      }, this.batchTimeout);
      this.flushTimers.set(userId, timer);
    }
  }

  // Flush batch for specific user
  async flushBatch(userId) {
    const operations = this.pendingOperations.get(userId);
    if (!operations || operations.length === 0) {
      return;
    }

    try {
      const database = db || initializeFirebaseAdmin();
      const batch = database.batch();

      // Group operations by type for optimization
      const incrementOps = operations.filter(op => op.type === 'increment');
      const updateOps = operations.filter(op => op.type === 'update');
      const createOps = operations.filter(op => op.type === 'create');

      // Process increment operations (combine multiple increments)
      if (incrementOps.length > 0) {
        const combinedIncrements = this.combineIncrements(incrementOps);
        for (const [docPath, increments] of combinedIncrements) {
          const docRef = database.doc(docPath);
          batch.update(docRef, increments);
        }
      }

      // Process update operations
      for (const op of updateOps) {
        const docRef = database.doc(op.docPath);
        batch.update(docRef, op.data);
      }

      // Process create operations
      for (const op of createOps) {
        const docRef = database.doc(op.docPath);
        batch.set(docRef, op.data, op.options || {});
      }

      // Execute batch
      await batch.commit();
      console.log(`✅ Executed batch of ${operations.length} operations for user ${userId}`);

      // Invalidate relevant caches
      this.invalidateCaches(userId, operations);

    } catch (error) {
      console.error(`❌ Batch operation failed for user ${userId}:`, error);
      // Don't throw - log and continue
    } finally {
      // Clean up
      this.pendingOperations.delete(userId);
      if (this.flushTimers.has(userId)) {
        clearTimeout(this.flushTimers.get(userId));
        this.flushTimers.delete(userId);
      }
    }
  }

  // Combine multiple increment operations
  combineIncrements(incrementOps) {
    const combined = new Map();

    for (const op of incrementOps) {
      if (!combined.has(op.docPath)) {
        combined.set(op.docPath, { updatedAt: new Date() });
      }

      const increments = combined.get(op.docPath);
      for (const [field, value] of Object.entries(op.increments)) {
        if (increments[field]) {
          increments[field] = FieldValue.increment((increments[field]._operand || 0) + value);
        } else {
          increments[field] = FieldValue.increment(value);
        }
      }
    }

    return combined;
  }

  // Invalidate relevant caches
  invalidateCaches(userId, operations) {
    // Invalidate subscription cache
    cacheManager.invalidateUserSubscription(userId);
    
    // Invalidate client count cache
    cacheManager.invalidateUserClientCount(userId);

    // Invalidate other relevant caches based on operation types
    const hasVideoOps = operations.some(op => 
      op.type === 'increment' && op.increments.videoUploadsUsed
    );
    const hasClientOps = operations.some(op => 
      op.type === 'increment' && op.increments.clientsUsed
    );

    if (hasVideoOps || hasClientOps) {
      // Invalidate user-specific patterns
      cacheManager.invalidatePattern('subscription', userId);
      cacheManager.invalidatePattern('clientCount', userId);
    }
  }

  // Force flush all pending batches
  async flushAll() {
    const userIds = Array.from(this.pendingOperations.keys());
    await Promise.all(userIds.map(userId => this.flushBatch(userId)));
  }

  // Get stats
  getStats() {
    return {
      pendingBatches: this.pendingOperations.size,
      totalPendingOps: Array.from(this.pendingOperations.values())
        .reduce((sum, ops) => sum + ops.length, 0),
      activeTimers: this.flushTimers.size
    };
  }
}

// Create singleton instance
export const batchManager = new BatchOperationManager();

// Optimized subscription operations
export class OptimizedSubscriptionService {
  
  // Increment video upload count (batched)
  static async incrementVideoUploadCount(userId) {
    batchManager.addOperation(userId, {
      type: 'increment',
      docPath: `subscriptions/${userId}`,
      increments: {
        videoUploadsUsed: 1
      }
    });
  }

  // Increment client count (batched)
  static async incrementClientCount(userId) {
    batchManager.addOperation(userId, {
      type: 'increment',
      docPath: `subscriptions/${userId}`,
      increments: {
        clientsUsed: 1
      }
    });
  }

  // Decrement client count (batched)
  static async decrementClientCount(userId) {
    batchManager.addOperation(userId, {
      type: 'increment',
      docPath: `subscriptions/${userId}`,
      increments: {
        clientsUsed: -1
      }
    });
  }

  // Batch update subscription
  static async updateSubscription(userId, updates) {
    batchManager.addOperation(userId, {
      type: 'update',
      docPath: `subscriptions/${userId}`,
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });
  }

  // Create subscription (immediate)
  static async createSubscription(userId, subscriptionData) {
    try {
      const database = db || initializeFirebaseAdmin();
      const docRef = database.collection('subscriptions').doc(userId);
      
      await docRef.set({
        ...subscriptionData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Cache the new subscription
      await cacheManager.setSubscription(userId, subscriptionData);
      
      return true;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  // Get subscription with caching
  static async getSubscription(userId) {
    try {
      // Check cache first
      const cached = await cacheManager.getSubscription(userId);
      if (cached) {
        return cached;
      }

      // Get from database
      const database = db || initializeFirebaseAdmin();
      const docRef = database.collection('subscriptions').doc(userId);
      const doc = await docRef.get();
      
      let subscription;
      if (!doc.exists) {
        // Return default subscription
        subscription = {
          userId,
          tier: 'free',
          videoUploadsUsed: 0,
          maxVideoUploads: 5,
          clientsUsed: 0,
          maxClients: 5,
          maxFileSize: 100,
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
      await cacheManager.setSubscription(userId, subscription);
      return subscription;
      
    } catch (error) {
      console.error('Error getting subscription:', error);
      
      // Return default subscription on error
      const defaultSubscription = {
        userId,
        tier: 'free',
        videoUploadsUsed: 0,
        maxVideoUploads: 5,
        clientsUsed: 0,
        maxClients: 5,
        maxFileSize: 100,
        status: 'active'
      };
      
      await cacheManager.setSubscription(userId, defaultSubscription, 60); // Short cache on error
      return defaultSubscription;
    }
  }
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Flushing pending batch operations...');
  await batchManager.flushAll();
});

process.on('SIGINT', async () => {
  console.log('Flushing pending batch operations...');
  await batchManager.flushAll();
});

export default batchManager;