// Simple session storage for Vercel serverless functions
// Uses environment variables and in-memory storage with fallback

// In-memory storage as fallback
const sessions = new Map();

export async function saveSession(sessionId, sessionData) {
  try {
    // Store in memory (will work within the same function execution)
    sessions.set(sessionId, sessionData);
    return true;
  } catch (error) {
    console.error('Error saving session:', error);
    return false;
  }
}

export async function getSession(sessionId) {
  try {
    // Get from memory
    const session = sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      sessions.delete(sessionId);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

export async function deleteSession(sessionId) {
  try {
    sessions.delete(sessionId);
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
}

export async function updateSession(sessionId, updates) {
  try {
    const session = await getSession(sessionId);
    if (!session) {
      return false;
    }
    
    const updatedSession = { ...session, ...updates };
    return await saveSession(sessionId, updatedSession);
  } catch (error) {
    console.error('Error updating session:', error);
    return false;
  }
}