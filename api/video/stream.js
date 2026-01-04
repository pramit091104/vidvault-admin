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
let db = null;

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
    db = getFirestore();
    
    console.log('✅ GCS and Firestore initialized for video streaming');
  } catch (error) {
    console.error('❌ Failed to initialize GCS for streaming:', error.message);
  }
}

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET and HEAD requests
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!bucket || !db) {
      return res.status(503).json({ error: 'Storage service unavailable' });
    }

    const { videoId, token } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    // Verify the video exists and get its details
    const videoDoc = await db.collection('gcsClientCodes').doc(videoId).get();
    
    if (!videoDoc.exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoData = videoDoc.data();
    
    // Check if video is active
    if (!videoData.isActive) {
      return res.status(404).json({ error: 'Video not available' });
    }

    // Check if video link has expired
    if (videoData.linkExpiresAt && new Date() > videoData.linkExpiresAt.toDate()) {
      return res.status(410).json({ error: 'Video link has expired' });
    }

    // Verify token if provided (for additional security)
    if (token) {
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        console.log('Authenticated user accessing video:', decodedToken.uid);
      } catch (authError) {
        // Token verification failed, but we'll allow access for public videos
        console.log('Token verification failed, allowing public access');
      }
    }

    // Get the file from GCS
    const gcsPath = videoData.gcsPath || videoData.fileName;
    const file = bucket.file(gcsPath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Video file not found in storage' });
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();
    const fileSize = parseInt(metadata.size);
    const contentType = metadata.contentType || 'video/mp4';

    // Handle range requests for video streaming
    const range = req.headers.range;
    
    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      // Set partial content headers
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Security headers to prevent caching and downloading
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "default-src 'self'",
        // Prevent right-click save
        'Content-Disposition': 'inline; filename="video.mp4"'
      });

      // Stream the requested range
      const stream = file.createReadStream({
        start: start,
        end: end
      });

      stream.pipe(res);
      
      // Update access count
      try {
        await db.collection('gcsClientCodes').doc(videoId).update({
          accessCount: videoData.accessCount + 1,
          lastAccessed: new Date()
        });
      } catch (updateError) {
        console.warn('Failed to update access count:', updateError);
      }

    } else {
      // No range request, send entire file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "default-src 'self'",
        'Content-Disposition': 'inline; filename="video.mp4"'
      });

      const stream = file.createReadStream();
      stream.pipe(res);
    }

  } catch (error) {
    console.error('Video streaming error:', error);
    res.status(500).json({ 
      error: 'Failed to stream video',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}