// Simple session storage for Vercel serverless functions
// In production, use Redis or a database

import { writeFile, readFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SESSIONS_DIR = '/tmp/upload-sessions';

// Ensure sessions directory exists
async function ensureSessionsDir() {
  if (!existsSync(SESSIONS_DIR)) {
    await mkdir(SESSIONS_DIR, { recursive: true });
  }
}

export async function saveSession(sessionId, sessionData) {
  try {
    await ensureSessionsDir();
    const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    await writeFile(sessionPath, JSON.stringify(sessionData));
    return true;
  } catch (error) {
    console.error('Error saving session:', error);
    return false;
  }
}

export async function getSession(sessionId) {
  try {
    const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (!existsSync(sessionPath)) {
      return null;
    }
    
    const data = await readFile(sessionPath, 'utf8');
    const session = JSON.parse(data);
    
    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      await deleteSession(sessionId);
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
    const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (existsSync(sessionPath)) {
      await unlink(sessionPath);
    }
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