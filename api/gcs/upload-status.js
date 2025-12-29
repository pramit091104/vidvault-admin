import { Storage } from '@google-cloud/storage';
import { getSession, updateSession } from './lib/sessionStorage.js';

// Initialize Google Cloud Storage
let bucket = null;

if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    let credentials;
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
    } else if (process.env.GCS_CREDENTIALS_BASE64) {
      const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }

    if (credentials) {
      const storage = new Storage({ 
        projectId: process.env.GCS_PROJECT_ID, 
        credentials 
      });
      bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    }
  } catch (error) {
    console.warn('Failed to initialize GCS:', error.message);
  }
}

// Access global sessions
global.uploadSessions = global.uploadSessions || new Map();

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Get upload session from file storage
    const session = await getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Generate signed URL if completed and not already available
    let signedUrl = session.signedUrl;
    if (session.status === 'completed' && session.gcsPath && !signedUrl && bucket) {
      try {
        const gcsFile = bucket.file(session.gcsPath);
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
        const [url] = await gcsFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: expiresAt,
        });
        signedUrl = url;
        session.signedUrl = signedUrl; // Cache it
      } catch (urlError) {
        console.warn('Could not generate signed URL:', urlError.message);
      }
    }

    // Return session status
    res.status(200).json({
      sessionId: session.sessionId,
      fileName: session.fileName,
      totalSize: session.totalSize,
      totalChunks: session.totalChunks,
      uploadedChunks: session.uploadedChunks.length,
      status: session.status || 'uploading',
      gcsPath: session.gcsPath,
      signedUrl,
      error: session.error,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      completedAt: session.completedAt,
      progress: Math.round((session.uploadedChunks.length / session.totalChunks) * 100)
    });

  } catch (error) {
    console.error('Error getting upload status:', error);
    res.status(500).json({ error: error.message });
  }
}