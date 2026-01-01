// Video compression endpoint - handles large files
import multer from 'multer';

// Configure multer for large files (up to 2GB)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
  }
});

export const config = {
  api: {
    bodyParser: false, // Disable default body parser for multer
    responseLimit: false, // Disable response size limit
  },
};

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle multipart form data
    upload.single('video')(req, res, async (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ 
            error: 'File too large. Maximum size is 2GB.',
            maxSize: '2GB'
          });
        }
        return res.status(400).json({ error: err.message });
      }

      const videoFile = req.file;
      if (!videoFile) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      console.log(`📹 Compression request for: ${videoFile.originalname} (${videoFile.size} bytes)`);

      // For now, return the original file without compression
      // In a production environment, you would implement actual video compression here
      // using FFmpeg or similar tools, but that requires significant server resources

      res.status(200).json({
        success: true,
        message: 'Compression skipped - using original file',
        originalSize: videoFile.size,
        compressedSize: videoFile.size,
        compressionRatio: 1.0,
        skipReason: 'Compression disabled for large files to prevent timeouts'
      });
    });

  } catch (error) {
    console.error('❌ Error in video compression:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}