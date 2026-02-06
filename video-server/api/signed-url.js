import { Storage } from '@google-cloud/storage';
import multer from 'multer';

// Initialize Google Cloud Storage
let bucket = null;

if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    let credentials = null;

    if (process.env.GCS_CREDENTIALS) {
      // Parse credentials and fix escaped newlines in private key
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      if (credentials.private_key) {
        // Replace escaped newlines with actual newlines
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    }

    const storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      credentials: credentials
    });
    bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

    console.log('GCS initialized successfully');
  } catch (error) {
    console.error('Failed to initialize GCS:', error.message);
    console.error('Error details:', error);
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
  // CORS headers

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
      console.error('Storage unavailable - bucket not initialized');
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const { videoId, gcsPath, service } = req.body;

    if (!videoId && !gcsPath) {
      return res.status(400).json({ error: 'videoId or gcsPath is required' });
    }

    console.log('Processing signed URL request for:', { videoId, gcsPath, service });

    // If gcsPath is provided, use it directly
    if (gcsPath) {
      console.log('Using provided gcsPath:', gcsPath);
      const file = bucket.file(gcsPath);
      const [exists] = await file.exists();

      if (exists) {
        // Generate signed URL
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
        console.log('Generating signed URL for gcsPath...');

        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: expiresAt,
        });

        console.log('Signed URL generated successfully for gcsPath');
        return res.json({ signedUrl, expiresAt: new Date(expiresAt).toISOString() });
      } else {
        console.error('File not found at gcsPath:', gcsPath);
        // Fall through to try videoId-based search
      }
    }

    // Clean up the input ID
    const cleanId = videoId.replace(/\.mp4\.mp4$/, '.mp4');

    // Search paths - expanded to cover more possibilities including new Uppy paths
    const potentialPaths = [
      // New Uppy upload paths (drafts folder structure)
      `drafts/${cleanId}`,
      `drafts/*/${cleanId}`, // Will need special handling
      // Legacy paths
      `videos/${cleanId}`,
      `uploads/${cleanId}`,
      cleanId,
      `${cleanId}.mp4`,
      `uploads/${cleanId}.mp4`,
      `videos/${cleanId}.mp4`,
      // Additional paths for different naming conventions
      `${cleanId.replace('.mp4', '')}.mp4`,
      `uploads/${cleanId.replace('.mp4', '')}.mp4`,
      `videos/${cleanId.replace('.mp4', '')}.mp4`,
      // Handle cases where cleanId might be a filename without extension
      `drafts/*/${cleanId.replace(/\.[^/.]+$/, '')}-*`,
    ];

    let foundFile = null;

    // First, try direct path matching
    for (const path of potentialPaths) {
      if (path.includes('*')) continue; // Skip wildcard paths for now
      console.log('Checking path:', path);
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (exists) {
        foundFile = file;
        console.log('Found file at path:', path);
        break;
      }
    }

    // If not found, try searching in drafts folder with wildcard patterns
    if (!foundFile) {
      console.log('Direct path search failed, trying drafts folder search...');

      try {
        // List files in drafts folder
        const [files] = await bucket.getFiles({
          prefix: 'drafts/',
          maxResults: 1000
        });

        // Search for files that match the videoId pattern
        const searchTerms = [
          cleanId,
          cleanId.replace('.mp4', ''),
          cleanId.replace(/\.[^/.]+$/, ''),
          videoId,
          videoId.replace('.mp4', ''),
          videoId.replace(/\.[^/.]+$/, '')
        ];

        for (const file of files) {
          const fileName = file.name;
          console.log('Checking drafts file:', fileName);

          // Check if any search term matches the file name
          for (const term of searchTerms) {
            if (fileName.includes(term) || fileName.endsWith(term) || fileName.includes(term.replace(/[^a-zA-Z0-9]/g, '_'))) {
              foundFile = file;
              console.log('Found matching file in drafts:', fileName);
              break;
            }
          }

          if (foundFile) break;
        }
      } catch (listError) {
        console.error('Error listing drafts folder:', listError);
      }
    }

    if (!foundFile) {
      console.error('Video not found in any of the searched paths');
      console.error('Searched paths:', potentialPaths);
      console.error('Original videoId:', videoId);
      console.error('Cleaned ID:', cleanId);

      return res.status(404).json({
        error: 'Video not found in storage. The video may have been moved or deleted.',
        searchedPaths: potentialPaths.filter(p => !p.includes('*')),
        videoId: videoId,
        cleanId: cleanId
      });
    }

    // Generate signed URL
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    console.log('Generating signed URL...');

    const [signedUrl] = await foundFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });

    console.log('Signed URL generated successfully');
    res.json({ signedUrl, expiresAt: new Date(expiresAt).toISOString() });

  } catch (error) {
    console.error('Error in signed-url handler:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
