import { Storage } from '@google-cloud/storage';
import { contentProtection } from '../../middleware/contentProtection.js';

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
  } catch (error) {
    console.error('Failed to initialize GCS:', error.message);
  }
}

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const { videoId } = req.query;
    const token = req.query.token || req.headers['x-access-token'];
    
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Validate access token using content protection middleware
    const validation = contentProtection.validateAccessToken(token, 'canStream');
    
    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }

    // Verify token is for this specific video
    if (validation.tokenData.videoId !== videoId) {
      return res.status(403).json({ error: 'Token not valid for this video' });
    }

    // Additional security checks
    const securityCheck = contentProtection.performSecurityChecks(req, validation.tokenData);
    if (!securityCheck.passed) {
      return res.status(403).json({ error: securityCheck.error });
    }

    // Construct GCS path
    const gcsPath = `videos/${videoId}.mp4`;
    const file = bucket.file(gcsPath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();
    const fileSize = parseInt(metadata.size);
    const contentType = metadata.contentType || 'video/mp4';

    // Set protection headers
    contentProtection.setProtectionHeaders(res, validation.tokenData.permissions.canDownload);

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
        'Expires': '0'
      });

      // Stream the requested chunk
      const stream = file.createReadStream({ start, end });
      stream.pipe(res);
      
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        }
      });

    } else {
      // Stream entire file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      const stream = file.createReadStream();
      stream.pipe(res);
      
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        }
      });
    }

  } catch (error) {
    console.error('Protected stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream failed' });
    }
  }
}