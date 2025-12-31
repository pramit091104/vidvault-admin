import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { saveSession } from '../lib/sessionStorage.js';

// Initialize Google Cloud Storage
let bucket = null;

console.log('Initializing GCS...');
console.log('GCS_BUCKET_NAME:', process.env.GCS_BUCKET_NAME);
console.log('GCS_PROJECT_ID:', process.env.GCS_PROJECT_ID);
console.log('GCS_CREDENTIALS available:', !!process.env.GCS_CREDENTIALS);

if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    let credentials;
    if (process.env.GCS_CREDENTIALS) {
      console.log('Using GCS_CREDENTIALS');
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
    } else if (process.env.GCS_CREDENTIALS_BASE64) {
      console.log('Using GCS_CREDENTIALS_BASE64');
      const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }

    if (credentials) {
      console.log('Creating storage client with project:', credentials.project_id);
      const storage = new Storage({ 
        projectId: process.env.GCS_PROJECT_ID, 
        credentials 
      });
      bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
      console.log('✅ GCS initialized successfully');
    } else {
      console.error('❌ No valid credentials found');
    }
  } catch (error) {
    console.error('❌ Failed to initialize GCS:', error.message);
  }
} else {
  console.error('❌ Missing GCS configuration');
}

// Session storage now handled by Firestore via sessionStorage.js

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Init chunked upload - checking bucket availability');
    
    if (!bucket) {
      console.error('Bucket not available - GCS not initialized');
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    console.log('Parsing request body:', req.body);
    const { fileName, totalSize, chunkSize, metadata } = req.body;

    // Validate required fields
    if (!fileName || !totalSize || !chunkSize) {
      console.error('Missing required fields:', { fileName, totalSize, chunkSize });
      return res.status(400).json({ 
        error: 'Missing required fields: fileName, totalSize, chunkSize' 
      });
    }

    console.log('Generating session ID');
    // Generate unique session ID
    const sessionId = uuidv4();
    const totalChunks = Math.ceil(totalSize / chunkSize);

    console.log('Creating session data for:', sessionId);
    // Create upload session
    const sessionData = {
      sessionId,
      fileName,
      totalSize,
      chunkSize,
      totalChunks,
      uploadedChunks: [],
      chunks: {},
      metadata: metadata || {},
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    console.log('Saving session to storage');
    // Store session using file-based storage
    const saved = await saveSession(sessionId, sessionData);
    if (!saved) {
      console.error('Failed to save session');
      return res.status(500).json({ error: 'Failed to create upload session' });
    }

    console.log('Session created successfully:', sessionId);
    res.status(200).json({
      sessionId,
      uploadUrl: '/api/gcs/upload-chunk',
      totalChunks,
      expiresAt: sessionData.expiresAt
    });

  } catch (error) {
    console.error('Error initializing chunked upload:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}