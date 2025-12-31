// Session storage for Vercel serverless functions using GCS as persistent storage
// This ensures sessions persist across different function instances

import { Storage } from '@google-cloud/storage';

// Initialize GCS client for session storage
let storage = null;
let sessionBucket = null;

try {
  let credentials;
  if (process.env.GCS_CREDENTIALS) {
    credentials = JSON.parse(process.env.GCS_CREDENTIALS);
  } else if (process.env.GCS_CREDENTIALS_BASE64) {
    const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
    credentials = JSON.parse(decoded);
  }

  if (credentials && process.env.GCS_PROJECT_ID && process.env.GCS_BUCKET_NAME) {
    storage = new Storage({ 
      projectId: process.env.GCS_PROJECT_ID, 
      credentials 
    });
    sessionBucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    console.log('✅ GCS session storage initialized');
  } else {
    console.warn('⚠️ GCS credentials not found for session storage');
  }
} catch (error) {
  console.error('❌ Failed to initialize GCS for session storage:', error.message);
}

// Session file path in GCS
function getSessionPath(sessionId) {
  return `upload_sessions/${sessionId}.json`;
}

// Save session to GCS
export async function saveSession(sessionId, sessionData) {
  try {
    if (!sessionBucket) {
      console.error('❌ Session bucket not available');
      return false;
    }

    // Prepare session data for storage
    const dataToStore = {
      ...sessionData,
      createdAt: sessionData.createdAt?.toISOString() || new Date().toISOString(),
      expiresAt: sessionData.expiresAt?.toISOString() || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      completedAt: sessionData.completedAt?.toISOString() || null,
      lastUpdated: new Date().toISOString()
    };

    // Store in GCS
    const file = sessionBucket.file(getSessionPath(sessionId));
    await file.save(JSON.stringify(dataToStore), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache',
      }
    });

    console.log(`✅ Session ${sessionId} saved to GCS`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving session ${sessionId} to GCS:`, error.message);
    return false;
  }
}

// Get session from GCS
export async function getSession(sessionId) {
  try {
    if (!sessionBucket) {
      console.error('❌ Session bucket not available');
      return null;
    }

    const file = sessionBucket.file(getSessionPath(sessionId));
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`❌ Session ${sessionId} not found in GCS`);
      return null;
    }

    // Download and parse session data
    const [contents] = await file.download();
    const sessionData = JSON.parse(contents.toString('utf-8'));

    // Convert ISO strings back to Date objects
    const session = {
      ...sessionData,
      createdAt: new Date(sessionData.createdAt),
      expiresAt: new Date(sessionData.expiresAt),
      completedAt: sessionData.completedAt ? new Date(sessionData.completedAt) : null,
      lastUpdated: sessionData.lastUpdated ? new Date(sessionData.lastUpdated) : null
    };

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      await deleteSession(sessionId);
      console.log(`⏰ Session ${sessionId} expired and removed`);
      return null;
    }

    console.log(`✅ Session ${sessionId} retrieved from GCS`);
    return session;
  } catch (error) {
    console.error(`❌ Error getting session ${sessionId} from GCS:`, error.message);
    return null;
  }
}

// Delete session from GCS
export async function deleteSession(sessionId) {
  try {
    if (!sessionBucket) {
      console.error('❌ Session bucket not available');
      return true; // Return true to avoid blocking
    }

    const file = sessionBucket.file(getSessionPath(sessionId));
    
    // Check if file exists before deleting
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`🗑️ Session ${sessionId} deleted from GCS`);
    } else {
      console.log(`ℹ️ Session ${sessionId} not found for deletion`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error deleting session ${sessionId} from GCS:`, error.message);
    return true; // Return true to avoid blocking
  }
}

// Update session in GCS
export async function updateSession(sessionId, updates) {
  try {
    // Get existing session
    const session = await getSession(sessionId);
    if (!session) {
      console.log(`❌ Cannot update session ${sessionId}: not found`);
      return false;
    }

    // Merge updates
    const updatedSession = {
      ...session,
      ...updates,
      lastUpdated: new Date()
    };

    // Save updated session
    const saved = await saveSession(sessionId, updatedSession);
    if (saved) {
      console.log(`✅ Session ${sessionId} updated in GCS`);
    }
    return saved;
  } catch (error) {
    console.error(`❌ Error updating session ${sessionId}:`, error.message);
    return false;
  }
}

// Get session statistics (list all sessions)
export async function getSessionStats() {
  try {
    if (!sessionBucket) {
      return {
        totalSessions: 0,
        sessionIds: [],
        error: 'Session bucket not available'
      };
    }

    const [files] = await sessionBucket.getFiles({
      prefix: 'upload_sessions/',
    });

    const sessionIds = files
      .filter(file => file.name.endsWith('.json'))
      .map(file => file.name.replace('upload_sessions/', '').replace('.json', ''));

    return {
      totalSessions: sessionIds.length,
      sessionIds,
      storage: 'GCS'
    };
  } catch (error) {
    console.error('❌ Error getting session stats:', error.message);
    return {
      totalSessions: 0,
      sessionIds: [],
      error: error.message
    };
  }
}