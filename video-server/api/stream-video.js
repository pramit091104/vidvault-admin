import { Storage } from '@google-cloud/storage';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let bucket = null;

const initStorage = () => {
  if (bucket) return;

  if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
    try {
      let credentials = null;

      if (process.env.GCS_CREDENTIALS) {
        try {
          const credentialsRaw = process.env.GCS_CREDENTIALS;
          if (typeof credentialsRaw === 'string') {
            credentials = JSON.parse(credentialsRaw);
          } else {
            credentials = credentialsRaw;
          }

          if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
          }
        } catch (e) {
          console.error('Error parsing GCS_CREDENTIALS:', e);
        }
      }

      const storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID,
        credentials: credentials
      });
      bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

      console.log('GCS initialized successfully in stream-video handler');
    } catch (error) {
      console.error('Failed to initialize GCS:', error.message);
    }
  }
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    initStorage();
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const { path: gcsPath } = req.query;

    if (!gcsPath) {
      return res.status(400).json({ error: 'path parameter is required' });
    }

    console.log('Streaming video from:', gcsPath);

    const file = bucket.file(gcsPath);
    const [exists] = await file.exists();

    if (!exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();
    const fileSize = parseInt(metadata.size);
    const contentType = metadata.contentType || 'video/mp4';

    // Handle range requests for video seeking
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      // Stream the requested range
      file.createReadStream({ start, end })
        .on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).end();
          }
        })
        .pipe(res);
    } else {
      // Stream entire file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });

      file.createReadStream()
        .on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).end();
          }
        })
        .pipe(res);
    }

  } catch (error) {
    console.error('Error in stream-video handler:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
