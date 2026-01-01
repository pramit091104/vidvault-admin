import { Storage } from '@google-cloud/storage';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin (only once)
if (getApps().length === 0) {
  try {
    const credentials = process.env.GCS_CREDENTIALS ? JSON.parse(process.env.GCS_CREDENTIALS) : null;
    if (credentials) {
      initializeApp({
        credential: cert(credentials),
        projectId: process.env.GCS_PROJECT_ID
      });
    }
  } catch (error) {
    console.warn('Firebase Admin initialization skipped:', error.message);
  }
}

// Initialize Google Cloud Storage
let bucket = null;

if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    let credentials = null;
    
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    }
    
    const storage = new Storage({ 
      projectId: process.env.GCS_PROJECT_ID,
      credentials: credentials
    });
    bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    
    console.log('✅ GCS initialized for resumable upload URL generation');
  } catch (error) {
    console.error('❌ Failed to initialize GCS:', error.message);
  }
}

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    // Verify Firebase Auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (authError) {
      console.error('Auth verification failed:', authError.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    // Extract request data
    const { 
      fileName, 
      fileSize, 
      contentType,
      metadata = {}
    } = req.body;

    // Validation
    if (!fileName || !fileSize || !contentType) {
      return res.status(400).json({ 
        error: 'Missing required fields: fileName, fileSize, contentType' 
      });
    }

    // Validate file type (video only)
    const allowedTypes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/ogg',
      'video/x-matroska'
    ];

    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only video files are allowed.' 
      });
    }

    // Enforce file size limit (2GB)
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: 'File size exceeds 2GB limit' 
      });
    }

    // Generate unique file path: drafts/{userId}/{timestamp}-{fileName}
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsPath = `drafts/${userId}/${timestamp}-${sanitizedFileName}`;

    console.log(`📝 Generating resumable upload URL for: ${gcsPath}`);

    // Create file reference
    const file = bucket.file(gcsPath);

    // Generate resumable upload URL (valid for 1 hour)
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    
    const [uploadUrl] = await file.createResumableUpload({
      metadata: {
        contentType: contentType,
        metadata: {
          ...metadata,
          userId: userId,
          userEmail: userEmail,
          originalFileName: fileName,
          uploadedAt: new Date().toISOString(),
          uploadType: 'resumable'
        }
      },
      origin: origin || 'https://previu.online'
    });

    console.log(`✅ Resumable upload URL generated successfully`);

    res.status(200).json({
      success: true,
      uploadUrl: uploadUrl,
      gcsPath: gcsPath,
      expiresAt: new Date(expiresAt).toISOString(),
      userId: userId,
      metadata: {
        fileName: sanitizedFileName,
        fileSize: fileSize,
        contentType: contentType
      }
    });

  } catch (error) {
    console.error('❌ Error generating resumable upload URL:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
