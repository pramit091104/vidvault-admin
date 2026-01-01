// Legacy endpoint - redirects to new Uppy resumable upload system
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
    // Extract data from old format
    const { fileName, fileSize, contentType, metadata } = req.body;

    // Redirect to new resumable upload URL endpoint
    const baseUrl = req.headers.host?.includes('localhost') 
      ? `http://${req.headers.host}` 
      : `https://${req.headers.host}`;

    const response = await fetch(`${baseUrl}/api/gcs/resumable-upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || ''
      },
      body: JSON.stringify({
        fileName,
        fileSize,
        contentType,
        metadata
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();

    // Return in format expected by old system
    res.status(200).json({
      success: true,
      sessionId: data.gcsPath, // Use gcsPath as sessionId for compatibility
      uploadUrl: data.uploadUrl,
      gcsPath: data.gcsPath,
      expiresAt: data.expiresAt
    });

  } catch (error) {
    console.error('❌ Error in init-chunked-upload:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}