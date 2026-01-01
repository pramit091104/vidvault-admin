import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { validateFileUpload, incrementVideoUploadCount, getUserIdFromToken } from '../lib/subscriptionValidator.js';

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
      console.log('✅ GCS initialized for simple upload');
    }
  } catch (error) {
    console.error('❌ Failed to initialize GCS:', error.message);
  }
}

// Multer for handling file uploads (dynamic limit based on subscription)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max (will be validated per user)
  }
});

export const config = {
  api: {
    bodyParser: false, // Disable default body parser for multer
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    // Handle multipart form data
    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 500MB.' });
        }
        return res.status(400).json({ error: err.message });
      }

      const fileData = req.file?.buffer;
      const fileName = req.body.fileName || req.file?.originalname;
      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

      if (!fileData || !fileName) {
        return res.status(400).json({ 
          error: 'Missing required fields: file and fileName' 
        });
      }

      // Get user ID from Authorization header
      const userId = await getUserIdFromToken(req.headers.authorization);
      if (!userId) {
        return res.status(401).json({ 
          error: 'Authentication required. Please sign in to upload files.',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate upload permissions and limits
      const validation = await validateFileUpload(userId, fileData.length);
      if (!validation.allowed) {
        return res.status(403).json({ 
          error: validation.error,
          code: validation.code
        });
      }

      console.log(`📤 Uploading file: ${fileName} (${fileData.length} bytes) for user: ${userId}`);

      // Generate unique file path
      const uploadId = uuidv4();
      const filePath = `uploads/${uploadId}/${fileName}`;
      const file = bucket.file(filePath);

      // Upload to GCS
      await file.save(fileData, {
        metadata: {
          contentType: req.file?.mimetype || metadata.contentType || 'application/octet-stream',
          metadata: {
            ...metadata,
            userId,
            uploadId,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      console.log(`✅ File uploaded to: ${filePath}`);

      // Increment user's upload count
      try {
        await incrementVideoUploadCount(userId);
        console.log(`📊 Incremented upload count for user: ${userId}`);
      } catch (error) {
        console.error('❌ Failed to increment upload count:', error);
        // Don't fail the upload, but log the error
      }

      // Generate signed URL (valid for 7 days)
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
      });

      console.log(`🔗 Generated signed URL`);

      res.status(200).json({
        success: true,
        uploadId,
        fileName,
        gcsPath: filePath,
        signedUrl,
        size: fileData.length,
        uploadedAt: new Date().toISOString(),
        subscription: {
          tier: validation.subscription.tier,
          uploadsUsed: validation.subscription.videoUploadsUsed + 1,
          maxUploads: validation.subscription.maxVideoUploads
        }
      });

    });

  } catch (error) {
    console.error('❌ Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
}
