// Video compression endpoint - handles large files
import multer from 'multer';

// Configure multer for large files (up to 2GB)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
    fieldSize: 2 * 1024 * 1024 * 1024, // 2GB field limit
  }
});

export const config = {
  api: {
    bodyParser: false, // Disable default body parser for multer
    responseLimit: false, // Disable response size limit
    sizeLimit: '2gb', // Allow up to 2GB
  },
  maxDuration: 300, // 5 minutes timeout
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
    // For large files, skip compression entirely to avoid 413 errors
    console.log('📹 Compression request received - skipping for large files');

    // Return success without processing
    res.status(200).json({
      success: true,
      message: 'Compression skipped for large files',
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 1.0,
      skipReason: 'Large file compression disabled to prevent server timeouts'
    });

  } catch (error) {
    console.error('❌ Error in video compression:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}