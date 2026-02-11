import { Storage } from '@google-cloud/storage';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import multer from 'multer';
import { parseAndFixGCSCredentials, logCredentialInfo } from '../utils/credentialsHelper.js';

// Initialize Google Cloud Storage
// Initialize Google Cloud Storage
let bucket = null;

const initStorage = () => {
  if (bucket) return; // Already initialized

  if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
    try {
      let credentials = null;

      if (process.env.GCS_CREDENTIALS) {
        // Use the utility function to parse and fix credentials
        credentials = parseAndFixGCSCredentials(process.env.GCS_CREDENTIALS);
        
        if (credentials) {
          // Log credential info for debugging (without exposing sensitive data)
          logCredentialInfo(credentials, 'GCS_CREDENTIALS');
        } else {
          console.error('Failed to parse GCS_CREDENTIALS');
        }
      }

      const storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID,
        credentials: credentials
      });
      bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

      console.log('GCS initialized successfully in signed-url handler');
    } catch (error) {
      console.error('Failed to initialize GCS:', error.message);
      console.error('Error details:', error);
    }
  } else {
    console.warn('Missing GCS_BUCKET_NAME or GCS_PROJECT_ID');
  }
};

// Initialize Firebase Admin (lazy initialization to avoid startup errors)
let db = null;
const initFirebase = () => {
  if (db) return db;

  try {
    if (getApps().length === 0) {
      let serviceAccount;
      // Try to get credentials from environment
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = parseAndFixGCSCredentials(process.env.FIREBASE_SERVICE_ACCOUNT);
      }

      // Fallback to GCS_CREDENTIALS if FIREBASE_SERVICE_ACCOUNT is missing
      if (!serviceAccount && process.env.GCS_CREDENTIALS) {
        serviceAccount = parseAndFixGCSCredentials(process.env.GCS_CREDENTIALS);
      }

      if (serviceAccount) {
        // Log credential info for debugging
        logCredentialInfo(serviceAccount, 'Firebase Admin');

        initializeApp({
          credential: cert(serviceAccount)
        });
        console.log('Firebase Admin initialized in signed-url handler');
      } else {
        console.warn('No service account found for Firebase Admin initialization');
        return null;
      }
    } else {
      // Already initialized
    }

    db = getFirestore();
    return db;
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    return null;
  }
};

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
    initStorage();
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
        // Return proxy URL instead of signed URL
        const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
        const proxyUrl = `${backendUrl}/api/stream-video?path=${encodeURIComponent(gcsPath)}`;
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

        console.log('Returning proxy URL for gcsPath');
        return res.json({ signedUrl: proxyUrl, expiresAt: new Date(expiresAt).toISOString() });
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

    // If still not found, try looking up in Firestore (gcsClientCodes)
    if (!foundFile) {
      const firestore = initFirebase();

      if (firestore) {
        try {
          // Try looking up by the clean ID (which is likely the doc ID)
          const docRef = firestore.collection('gcsClientCodes').doc(cleanId);
          const docSnap = await docRef.get();

          if (docSnap.exists) {
            const data = docSnap.data();
            console.log('Found Firestore document:', { id: cleanId, hasGcsPath: !!data.gcsPath, hasFileName: !!data.fileName, hasUserId: !!data.userId });

            // Priority 1: Use gcsPath if available
            if (data.gcsPath) {
              console.log('Using gcsPath from Firestore:', data.gcsPath);
              const file = bucket.file(data.gcsPath);
              const [exists] = await file.exists();

              if (exists) {
                foundFile = file;
                console.log('✅ Found file using gcsPath from Firestore');
              } else {
                console.warn('gcsPath from Firestore does not exist in GCS:', data.gcsPath);
              }
            }

            // Priority 2: Construct path from userId and fileName
            if (!foundFile && data.userId && data.fileName) {
              // Try multiple path patterns since we don't know the exact timestamp
              const patterns = [
                `drafts/${data.userId}/${data.fileName}`,
                `uploads/${data.userId}/${data.fileName}`,
                `videos/${data.userId}/${data.fileName}`
              ];

              for (const pattern of patterns) {
                console.log('Trying constructed path:', pattern);
                const file = bucket.file(pattern);
                const [exists] = await file.exists();
                if (exists) {
                  foundFile = file;
                  console.log('✅ Found file using constructed path');
                  break;
                }
              }

              // Priority 3: Search for filename in drafts folder (handles timestamp prefix)
              if (!foundFile) {
                console.log('Searching drafts folder for filename:', data.fileName);
                try {
                  const [files] = await bucket.getFiles({
                    prefix: `drafts/${data.userId}/`,
                    maxResults: 1000
                  });

                  // Look for files that end with the original filename or contain it
                  const matchingFile = files.find(f => {
                    const name = f.name;
                    // Match files like: drafts/userId/1770627201178-5716235-filename.mp4
                    return name.endsWith(data.fileName) || name.includes(data.fileName);
                  });

                  if (matchingFile) {
                    foundFile = matchingFile;
                    console.log('✅ Found file by searching drafts folder:', matchingFile.name);
                  }
                } catch (searchError) {
                  console.error('Error during filename search in drafts:', searchError);
                }
              }
            } else if (!foundFile) {
              console.error('Firestore document missing required fields:', { hasGcsPath: !!data.gcsPath, hasUserId: !!data.userId, hasFileName: !!data.fileName });
            }
          } else {
            console.log('No Firestore document found for ID:', cleanId);
          }
        } catch (firestoreError) {
          console.error('Error querying Firestore:', firestoreError);
        }
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

    // Generate proxy URL instead of signed URL
    const gcsFilePath = foundFile.name;
    const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
    const proxyUrl = `${backendUrl}/api/stream-video?path=${encodeURIComponent(gcsFilePath)}`;
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    console.log('Returning proxy URL for video streaming');
    res.json({ signedUrl: proxyUrl, expiresAt: new Date(expiresAt).toISOString() });

  } catch (error) {
    console.error('Error in signed-url handler:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
