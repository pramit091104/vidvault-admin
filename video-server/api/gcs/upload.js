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

    // Handle multipart form data
    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const { fileName, contentType, metadata } = req.body;
      const file = req.file;

      try {
        // Upload file to GCS
        const gcsFile = bucket.file(fileName);
        const stream = gcsFile.createWriteStream({
          metadata: {
            contentType: contentType || file.mimetype,
            metadata: metadata ? JSON.parse(metadata) : {}
          }
        });

        stream.on('error', (error) => {
          console.error('GCS upload error:', error);
          res.status(500).json({ error: error.message });
        });

        stream.on('finish', async () => {
          try {
            // Generate signed URL for immediate access
            const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
            const [signedUrl] = await gcsFile.getSignedUrl({
              version: 'v4',
              action: 'read',
              expires: expiresAt,
            });

            res.status(201).json({ 
              success: true, 
              fileName,
              signedUrl 
            });
          } catch (urlError) {
            console.warn('Could not generate signed URL:', urlError.message);
            res.status(201).json({ 
              success: true, 
              fileName 
            });
          }
        });

        stream.end(file.buffer);

      } catch (error) {
        console.error('GCS upload error:', error);
        res.status(500).json({ error: error.message });
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}