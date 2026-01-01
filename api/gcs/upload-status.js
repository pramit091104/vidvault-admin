// Upload status endpoint for compatibility with existing system
export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    // For the new Uppy system, we don't track upload status server-side
    // The client handles all progress tracking
    // Return a generic "in progress" status
    res.status(200).json({
      success: true,
      sessionId: sessionId,
      status: 'in_progress',
      uploadedChunks: [],
      totalChunks: 0,
      message: 'Upload status tracking handled client-side with Uppy'
    });

  } catch (error) {
    console.error('❌ Error getting upload status:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}