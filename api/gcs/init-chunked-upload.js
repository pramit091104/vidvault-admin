import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import { saveSession } from './lib/sessionStorage.js';

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

// In-memory session storage (use Redis or database in production)
global.uploadSessions = global.uploadSessions || new Map();

// In-memory session storage (use Redis or database in production)
global.uploadSessions = global.uploadSessions || new Map();

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const { fileName, totalSize, chunkSize, metadata } = req.body;

    // Validate required fields
    if (!fileName || !totalSize || !chunkSize) {
      return res.status(400).json({ 
        error: 'Missing required fields: fileName, totalSize, chunkSize' 
      });
    }

    // Generate unique session ID
    const sessionId = crypto.randomUUID();
    const totalChunks = Math.ceil(totalSize / chunkSize);

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

    // Store session using file-based storage
    const saved = await saveSession(sessionId, sessionData);
    if (!saved) {
      return res.status(500).json({ error: 'Failed to create upload session' });
    }

    res.status(200).json({
      sessionId,
      uploadUrl: '/api/gcs/upload-chunk',
      totalChunks,
      expiresAt: sessionData.expiresAt
    });

  } catch (error) {
    console.error('Error initializing chunked upload:', error);
    res.status(500).json({ error: error.message });
  }
}