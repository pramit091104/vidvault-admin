// Enhanced session storage for Vercel serverless functions
// Uses multiple strategies for better persistence

// Global storage that persists across function calls within the same instance
if (!global.uploadSessions) {
  global.uploadSessions = new Map();
  global.sessionTimestamps = new Map();
  global.lastCleanup = Date.now();
}

// Enhanced cleanup with better logging
function cleanupExpiredSessions() {
  const now = Date.now();
  if (now - global.lastCleanup > 2 * 60 * 1000) { // Clean every 2 minutes
    const sessions = global.uploadSessions;
    const timestamps = global.sessionTimestamps;
    let cleanedCount = 0;
    
    for (const [sessionId, session] of sessions.entries()) {
      const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt);
      if (now > expiresAt.getTime()) {
        sessions.delete(sessionId);
        timestamps.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions. Active sessions: ${sessions.size}`);
    }
    global.lastCleanup = now;
  }
}

// Enhanced session saving with better persistence
export async function saveSession(sessionId, sessionData) {
  try {
    cleanupExpiredSessions();
    
    // Ensure dates are properly formatted
    const sessionToStore = {
      ...sessionData,
      createdAt: sessionData.createdAt || new Date(),
      expiresAt: sessionData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
      completedAt: sessionData.completedAt || null,
      lastUpdated: new Date()
    };
    
    // Store in global memory
    global.uploadSessions.set(sessionId, sessionToStore);
    global.sessionTimestamps.set(sessionId, Date.now());
    
    // Also try to store in process.env as a backup (for very short-term persistence)
    try {
      const envKey = `UPLOAD_SESSION_${sessionId}`;
      process.env[envKey] = JSON.stringify({
        ...sessionToStore,
        createdAt: sessionToStore.createdAt.toISOString(),
        expiresAt: sessionToStore.expiresAt.toISOString(),
        completedAt: sessionToStore.completedAt?.toISOString() || null,
        lastUpdated: sessionToStore.lastUpdated.toISOString()
      });
    } catch (envError) {
      // Environment storage failed, but that's okay
    }
    
    console.log(`✅ Session ${sessionId} saved. Total sessions: ${global.uploadSessions.size}`);
    return true;
  } catch (error) {
    console.error('❌ Error saving session:', error);
    return false;
  }
}

// Enhanced session retrieval with fallback mechanisms
export async function getSession(sessionId) {
  try {
    cleanupExpiredSessions();
    
    // First try global memory
    let session = global.uploadSessions.get(sessionId);
    
    // If not in memory, try environment variables as backup
    if (!session) {
      try {
        const envKey = `UPLOAD_SESSION_${sessionId}`;
        const envData = process.env[envKey];
        if (envData) {
          const sessionData = JSON.parse(envData);
          session = {
            ...sessionData,
            createdAt: new Date(sessionData.createdAt),
            expiresAt: new Date(sessionData.expiresAt),
            completedAt: sessionData.completedAt ? new Date(sessionData.completedAt) : null,
            lastUpdated: new Date(sessionData.lastUpdated)
          };
          
          // Restore to memory for faster access
          global.uploadSessions.set(sessionId, session);
          global.sessionTimestamps.set(sessionId, Date.now());
          console.log(`🔄 Session ${sessionId} restored from environment backup`);
        }
      } catch (envError) {
        console.warn('Environment backup read failed:', envError.message);
      }
    }
    
    if (!session) {
      console.log(`❌ Session ${sessionId} not found. Available sessions: ${Array.from(global.uploadSessions.keys()).join(', ')}`);
      return null;
    }
    
    // Check if session is expired
    const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt);
    if (new Date() > expiresAt) {
      await deleteSession(sessionId);
      console.log(`⏰ Session ${sessionId} expired and removed`);
      return null;
    }
    
    // Update last access time
    global.sessionTimestamps.set(sessionId, Date.now());
    console.log(`✅ Session ${sessionId} found and valid`);
    return session;
  } catch (error) {
    console.error('❌ Error getting session:', error);
    return null;
  }
}

// Enhanced session deletion
export async function deleteSession(sessionId) {
  try {
    // Remove from global memory
    const deleted = global.uploadSessions.delete(sessionId);
    global.sessionTimestamps.delete(sessionId);
    
    // Remove from environment backup
    try {
      const envKey = `UPLOAD_SESSION_${sessionId}`;
      delete process.env[envKey];
    } catch (envError) {
      // Environment cleanup failed, but that's okay
    }
    
    console.log(`🗑️ Session ${sessionId} deletion: ${deleted ? 'success' : 'not found'}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting session:', error);
    return true; // Return true even on error to avoid blocking
  }
}

// Enhanced session update
export async function updateSession(sessionId, updates) {
  try {
    const session = global.uploadSessions.get(sessionId);
    if (!session) {
      // Try to restore from environment backup
      const restored = await getSession(sessionId);
      if (!restored) {
        console.log(`❌ Cannot update session ${sessionId}: not found`);
        return false;
      }
    }
    
    const currentSession = global.uploadSessions.get(sessionId);
    const updatedSession = { 
      ...currentSession, 
      ...updates,
      lastUpdated: new Date()
    };
    
    // Save the updated session
    return await saveSession(sessionId, updatedSession);
  } catch (error) {
    console.error('❌ Error updating session:', error);
    return false;
  }
}

// Utility function to get session statistics
export function getSessionStats() {
  return {
    totalSessions: global.uploadSessions?.size || 0,
    sessionIds: Array.from(global.uploadSessions?.keys() || []),
    lastCleanup: new Date(global.lastCleanup || 0).toISOString()
  };
}