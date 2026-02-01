import { Storage } from '@google-cloud/storage';
import multer from 'multer';

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

    // Fix private_key newlines if they are escaped as literal '\n' strings
    if (credentials && credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    if (credentials) {
      const storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID,
        credentials
      });
      bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
      console.log('✅ GCS initialized for storage API');
    }
  } catch (error) {
    console.error('❌ Failed to initialize GCS:', error.message);
  }
}

const upload = multer({ storage: multer.memoryStorage() });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {

  if (!bucket) {
    return res.status(503).json({ error: 'Storage unavailable' });
  }

  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const action = pathname.split('/').pop();

    switch (action) {
      case 'upload':
        if (req.method !== 'POST') {
          res.setHeader('Allow', ['POST']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleUpload(req, res);

      case 'delete':
        if (req.method !== 'DELETE') {
          res.setHeader('Allow', ['DELETE']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleDelete(req, res);

      case 'metadata':
        if (req.method !== 'GET') {
          res.setHeader('Allow', ['GET']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleMetadata(req, res);

      case 'signed-url':
        if (req.method !== 'POST') {
          res.setHeader('Allow', ['POST']);
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return await handleSignedUrl(req, res);

      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('❌ Storage API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}

async function handleUpload(req, res) {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      return res.status(400).json({ error: err.message });
    }

    const fileBuffer = req.file?.buffer;
    const originalName = req.file?.originalname;
    const fileName = req.body.fileName || originalName;
    const contentType = req.body.contentType || req.file?.mimetype || 'application/octet-stream';
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

    if (!fileBuffer || !fileName) {
      return res.status(400).json({ error: 'No file provided' });
    }

    try {
      const gcsFile = bucket.file(fileName);

      await gcsFile.save(fileBuffer, {
        metadata: { contentType, metadata },
        resumable: false,
      });

      // Generate signed URL
      let signedUrl = null;
      try {
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
        const [url] = await gcsFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: expiresAt,
        });
        signedUrl = url;
      } catch (e) {
        console.warn('Could not generate signed URL for uploaded file:', e.message);
      }

      res.status(201).json({ success: true, fileName, signedUrl });
    } catch (error) {
      console.error('GCS upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

async function handleDelete(req, res) {
  try {
    const { fileName } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'fileName required' });
    }

    await bucket.file(fileName).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('GCS delete error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleMetadata(req, res) {
  try {
    const fileName = String(req.query.fileName || '');
    if (!fileName) {
      return res.status(400).json({ error: 'fileName query required' });
    }

    const [meta] = await bucket.file(fileName).getMetadata();
    res.json(meta);
  } catch (error) {
    console.error('GCS metadata error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleSignedUrl(req, res) {
  try {
    const { videoId, service } = req.body;
    console.log('[/api/storage/signed-url] request body:', { videoId, service });

    // Clean up the input ID
    const cleanId = videoId.replace(/\.mp4\.mp4$/, '.mp4');
    console.log(`🔍 Searching for: "${cleanId}"`);

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
        console.log(`✅ FOUND at: ${path}`);
        break;
      }
    }

    if (!foundFile) {
      console.error('⚠️ File not found. Searched paths:', potentialPaths);
      return res.status(404).json({
        error: 'Video not found in storage',
        searchedFor: cleanId,
        searchedPaths: potentialPaths
      });
    }

    // Generate signed URL
    const expiresAt = Date.now() + 60 * 60 * 1000;
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