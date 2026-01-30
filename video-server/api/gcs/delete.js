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
  // CORS headers

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    const { fileName, gcsPath } = req.body;
    
    if (!fileName && !gcsPath) {
      return res.status(400).json({ error: 'fileName or gcsPath required' });
    }

    console.log('Attempting to delete file:', { fileName, gcsPath });

    // If gcsPath is provided, try it first
    if (gcsPath) {
      try {
        const file = bucket.file(gcsPath);
        const [exists] = await file.exists();
        
        if (exists) {
          await file.delete();
          console.log('Successfully deleted file at gcsPath:', gcsPath);
          return res.json({ 
            success: true, 
            deletedPath: gcsPath,
            message: `File deleted successfully from ${gcsPath}`
          });
        }
      } catch (deleteError) {
        console.log('Failed to delete at gcsPath:', gcsPath, deleteError.message);
      }
    }

    // Clean up the input filename
    const cleanFileName = fileName.replace(/\.mp4\.mp4$/, '.mp4');

    // Try different path patterns including new Uppy paths
    const potentialPaths = [
      cleanFileName,
      // New Uppy upload paths (drafts folder structure)
      `drafts/${cleanFileName}`,
      // Legacy paths
      `videos/${cleanFileName}`,
      `uploads/${cleanFileName}`,
      `${cleanFileName}.mp4`,
      `uploads/${cleanFileName}.mp4`,
      `videos/${cleanFileName}.mp4`,
      // Additional patterns
      `${cleanFileName.replace('.mp4', '')}.mp4`,
      `uploads/${cleanFileName.replace('.mp4', '')}.mp4`,
      `videos/${cleanFileName.replace('.mp4', '')}.mp4`,
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

    // If not found in direct paths, search in drafts folder
    if (!fileDeleted) {
      console.log('Direct path search failed, trying drafts folder search...');
      
      try {
        // List files in drafts folder
        const [files] = await bucket.getFiles({
          prefix: 'drafts/',
          maxResults: 1000
        });

        // Search for files that match the fileName pattern
        const searchTerms = [
          cleanFileName,
          cleanFileName.replace('.mp4', ''),
          cleanFileName.replace(/\.[^/.]+$/, ''),
          fileName,
          fileName.replace('.mp4', ''),
          fileName.replace(/\.[^/.]+$/, '')
        ];

        for (const file of files) {
          const filePath = file.name;
          console.log('Checking drafts file for deletion:', filePath);
          
          // Check if any search term matches the file name
          for (const term of searchTerms) {
            if (filePath.includes(term) || filePath.endsWith(term) || filePath.includes(term.replace(/[^a-zA-Z0-9]/g, '_'))) {
              await file.delete();
              fileDeleted = true;
              deletedPath = filePath;
              console.log('Successfully deleted matching file in drafts:', filePath);
              break;
            }
          }
          
          if (fileDeleted) break;
        }
      } catch (listError) {
        console.error('Error searching drafts folder:', listError);
      }
    }

    if (!fileDeleted) {
      console.error('File not found in any of the searched paths:', potentialPaths);
      return res.status(404).json({ 
        error: 'File not found',
        searchedPaths: potentialPaths,
        fileName: fileName,
        gcsPath: gcsPath
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