// Legacy endpoint - redirects to new Uppy resumable upload system
export default async function handler(req, res) {
  // CORS headers

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

    console.log('Legacy init-chunked-upload called:', { fileName, fileSize });

    // For now, return a simple response that indicates the new system should be used
    res.status(200).json({
      success: true,
      message: 'Please use the new Uppy resumable upload system for better reliability',
      sessionId: `legacy-${Date.now()}`,
      uploadUrl: '/api/gcs/resumable-upload-url',
      recommendation: 'Switch to UppyUploadSection component for files > 100MB'
    });

  } catch (error) {
    console.error('❌ Error in init-chunked-upload:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}