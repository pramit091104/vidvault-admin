import { Storage } from '@google-cloud/storage';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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
    
    console.log('✅ GCS initialized for upload finalization');
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

    // Extract request data
    const { 
      gcsPath,
      videoId,
      metadata
    } = req.body;

    if (!gcsPath || !videoId) {
      return res.status(400).json({ 
        error: 'Missing required fields: gcsPath, videoId' 
      });
    }

    console.log(`📝 Finalizing upload for: ${gcsPath}`);

    // Verify file exists in GCS
    const file = bucket.file(gcsPath);
    const [exists] = await file.exists();

    if (!exists) {
      return res.status(404).json({ 
        error: 'File not found in storage' 
      });
    }

    // Get file metadata
    const [fileMetadata] = await file.getMetadata();

    // Move from drafts to final location if needed
    let finalPath = gcsPath;
    if (gcsPath.startsWith('drafts/')) {
      finalPath = gcsPath.replace('drafts/', 'videos/');
      await file.move(finalPath);
      console.log(`📦 Moved file from ${gcsPath} to ${finalPath}`);
    }

    // Generate signed URL for preview (7 days)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const finalFile = bucket.file(finalPath);
    
    const [signedUrl] = await finalFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });

    // Save metadata to Firestore
    const db = getFirestore();
    const videoRef = db.collection('gcsClientCodes').doc(videoId);

    await videoRef.set({
      id: videoId,
      title: metadata.title || 'Untitled',
      description: metadata.description || '',
      clientName: metadata.clientName || '',
      fileName: fileMetadata.name,
      gcsPath: finalPath,
      publicUrl: signedUrl,
      size: parseInt(fileMetadata.size),
      contentType: fileMetadata.contentType,
      userId: userId,
      securityCode: metadata.securityCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
      isActive: true,
      accessCount: 0,
      privacyStatus: 'private',
      isPubliclyAccessible: false,
      service: 'gcs',
      uploadedAt: new Date(),
      lastAccessed: null
    });

    console.log(`✅ Upload finalized and metadata saved`);

    res.status(200).json({
      success: true,
      videoId: videoId,
      gcsPath: finalPath,
      signedUrl: signedUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      size: fileMetadata.size,
      contentType: fileMetadata.contentType
    });

  } catch (error) {
    console.error('❌ Error finalizing upload:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
