import { Storage } from '@google-cloud/storage';

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
    
    console.log('GCS initialized successfully for delete operations');
  } catch (error) {
    console.error('Failed to initialize GCS for delete:', error.message);
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
      console.error('Storage unavailable - bucket not initialized');
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const { fileName } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ error: 'fileName required' });
    }

    console.log('Attempting to delete file:', fileName);

    // Clean up the input filename
    const cleanFileName = fileName.replace(/\.mp4\.mp4$/, '.mp4');

    // Try different path patterns like in signed-url
    const potentialPaths = [
      cleanFileName,
      `videos/${cleanFileName}`,
      `uploads/${cleanFileName}`,
      `${cleanFileName}.mp4`,
      `uploads/${cleanFileName}.mp4`,
      `videos/${cleanFileName}.mp4`,
    ];

    let fileDeleted = false;
    let deletedPath = null;

    // Try to find and delete the file
    for (const path of potentialPaths) {
      try {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        
        if (exists) {
          await file.delete();
          fileDeleted = true;
          deletedPath = path;
          console.log('Successfully deleted file at path:', path);
          break;
        }
      } catch (deleteError) {
        console.log('Failed to delete at path:', path, deleteError.message);
      }
    }

    if (!fileDeleted) {
      console.error('File not found in any of the searched paths:', potentialPaths);
      return res.status(404).json({ 
        error: 'File not found',
        searchedPaths: potentialPaths
      });
    }
    
    res.json({ 
      success: true, 
      deletedPath,
      message: `File deleted successfully from ${deletedPath}`
    });

  } catch (error) {
    console.error('GCS delete error:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}