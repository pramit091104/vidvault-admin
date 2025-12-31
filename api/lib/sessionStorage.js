// Session storage for Vercel serverless functions using Firebase Admin SDK with fallback
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Fallback in-memory storage
const memoryStorage = new Map();

// Initialize Firebase Admin (only if not already initialized)
let app;
let db;
let useFirestore = false;

try {
  if (getApps().length === 0) {
    // Use the same service account credentials as GCS
    let credentials;
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
    } else if (process.env.GCS_CREDENTIALS_BASE64) {
      const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }

    if (credentials) {
      app = initializeApp({
        credential: cert(credentials),
        projectId: process.env.GCS_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
      });
      db = getFirestore(app);
      useFirestore = true;
      console.log('✅ Firebase Admin initialized for session storage');
    } else {
      console.warn('⚠️ Firebase Admin credentials not found, using memory storage');
    }
  } else {
    app = getApps()[0];
    db = getFirestore(app);
    useFirestore = true;
  }
} catch (error) {
  console.warn('⚠️ Failed to initialize Firebase Admin, using memory storage:', error.message);
  useFirestore = false;
}

// Collection name for upload sessions
const SESSIONS_COLLECTION = 'upload_sessions';

export async function saveSession(sessionId, sessionData) {
  try {
    if (useFirestore && db) {
      // Convert dates to Firestore timestamps
      const firestoreData = {
        ...sessionData,
        createdAt: sessionData.createdAt || new Date(),
        expiresAt: sessionData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
        completedAt: sessionData.completedAt || null
      };

      await db.collection(SESSIONS_COLLECTION).doc(sessionId).set(firestoreData);
      return true;
    } else {
      // Fallback to memory storage
      memoryStorage.set(sessionId, sessionData);
      return true;
    }
  } catch (error) {
    console.error('Error saving session:', error);
    // Fallback to memory storage on error
    memoryStorage.set(sessionId, sessionData);
    return true;
  }
}

export async function getSession(sessionId) {
  try {
    if (useFirestore && db) {
      const doc = await db.collection(SESSIONS_COLLECTION).doc(sessionId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      const sessionData = doc.data();
      
      // Check if session is expired
      const expiresAt = sessionData.expiresAt.toDate ? sessionData.expiresAt.toDate() : new Date(sessionData.expiresAt);
      if (new Date() > expiresAt) {
        await deleteSession(sessionId);
        return null;
      }
      
      // Convert Firestore timestamps back to Date objects
      return {
        ...sessionData,
        createdAt: sessionData.createdAt.toDate ? sessionData.createdAt.toDate() : new Date(sessionData.createdAt),
        expiresAt: expiresAt,
        completedAt: sessionData.completedAt ? (sessionData.completedAt.toDate ? sessionData.completedAt.toDate() : new Date(sessionData.completedAt)) : null
      };
    } else {
      // Fallback to memory storage
      const session = memoryStorage.get(sessionId);
      if (!session) {
        return null;
      }
      
      // Check if session is expired
      if (new Date() > new Date(session.expiresAt)) {
        memoryStorage.delete(sessionId);
        return null;
      }
      
      return session;
    }
  } catch (error) {
    console.error('Error getting session:', error);
    // Fallback to memory storage on error
    const session = memoryStorage.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      memoryStorage.delete(sessionId);
      return null;
    }
    
    return session;
  }
}

export async function deleteSession(sessionId) {
  try {
    if (useFirestore && db) {
      await db.collection(SESSIONS_COLLECTION).doc(sessionId).delete();
    }
    // Also remove from memory storage
    memoryStorage.delete(sessionId);
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    // Fallback to memory storage
    memoryStorage.delete(sessionId);
    return true;
  }
}

export async function updateSession(sessionId, updates) {
  try {
    if (useFirestore && db) {
      // Convert any Date objects to Firestore timestamps
      const firestoreUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value instanceof Date) {
          firestoreUpdates[key] = value;
        } else {
          firestoreUpdates[key] = value;
        }
      }
      
      await db.collection(SESSIONS_COLLECTION).doc(sessionId).update(firestoreUpdates);
      return true;
    } else {
      // Fallback to memory storage
      const session = memoryStorage.get(sessionId);
      if (!session) {
        return false;
      }
      
      const updatedSession = { ...session, ...updates };
      memoryStorage.set(sessionId, updatedSession);
      return true;
    }
  } catch (error) {
    console.error('Error updating session:', error);
    // Fallback to memory storage
    const session = memoryStorage.get(sessionId);
    if (!session) {
      return false;
    }
    
    const updatedSession = { ...session, ...updates };
    memoryStorage.set(sessionId, updatedSession);
    return true;
  }
}