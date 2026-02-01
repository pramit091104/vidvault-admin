import { Storage } from '@google-cloud/storage';

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
      console.log('✅ GCS initialized for metadata API');
    }
  } catch (error) {
    console.error('❌ Failed to initialize GCS:', error.message);
  }
}

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const fileName = String(req.query.fileName || '');

    if (!fileName) {
      return res.status(400).json({ error: 'fileName query required' });
    }

    // Get file metadata from GCS
    const [metadata] = await bucket.file(fileName).getMetadata();

    res.json({
      name: metadata.name,
      size: metadata.size,
      contentType: metadata.contentType,
      timeCreated: metadata.timeCreated,
      updated: metadata.updated,
      etag: metadata.etag
    });

  } catch (error) {
    console.error('GCS metadata error:', error);
    if (error.code === 404) {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}