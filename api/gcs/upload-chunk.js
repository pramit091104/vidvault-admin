// Upload chunk endpoint - redirects to Uppy resumable upload
export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    // This endpoint is not used in the new Uppy system
    // Chunks are uploaded directly to GCS using signed URLs
    // Return a message explaining the new system
    
    res.status(200).json({
      success: false,
      message: 'This endpoint is deprecated. Please use the new Uppy resumable upload system.',
      newEndpoint: '/api/gcs/resumable-upload-url',
      documentation: 'See UPPY_QUICK_START.md for migration guide'
    });

  } catch (error) {
    console.error('❌ Error in upload-chunk:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}