import { Storage } from '@google-cloud/storage';
import multer from 'multer';

// Initialize Google Cloud Storage
let bucket = null;

if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    const storage = new Storage({ 
      projectId: process.env.GCS_PROJECT_ID,
      credentials: process.env.GCS_CREDENTIALS ? JSON.parse(process.env.GCS_CREDENTIALS) : undefined
    });
    bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  } catch (error) {
    console.warn('Failed to initialize GCS:', error.message);
  }
}

// Multer for handling file uploads in serverless environment
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

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

    const { videoId, service } = req.body;
    
    // Clean up the input ID
    const cleanId = videoId.replace(/\.mp4\.mp4$/, '.mp4');

    // Search paths
    const potentialPaths = [
      `videos/${cleanId}`,
      `uploads/${cleanId}`,
      cleanId,
      `${cleanId}.mp4`,
      `uploads/${cleanId}.mp4`,
      `videos/${cleanId}.mp4`
    ];

    let foundFile = null;

    // Try to find the file
    for (const path of potentialPaths) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (exists) {
        foundFile = file;
        break;
      }
    }

    if (!foundFile) {
      return res.status(404).json({ error: 'Video not found in storage' });
    }

    // Generate signed URL
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    const [signedUrl] = await foundFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });

    res.json({ signedUrl, expiresAt: new Date(expiresAt).toISOString() });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
