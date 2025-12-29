import { Storage } from '@google-cloud/storage';

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

export default async function handler(req, res) {
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const { fileName } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ error: 'fileName required' });
    }

    // Delete the file from GCS
    await bucket.file(fileName).delete();
    
    res.json({ success: true });

  } catch (error) {
    console.error('GCS delete error:', error);
    res.status(500).json({ error: error.message });
  }
}