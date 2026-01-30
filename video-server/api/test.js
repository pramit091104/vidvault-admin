export default async function handler(req, res) {
  try {
    console.log('Test endpoint called');
    console.log('Method:', req.method);
    console.log('Environment variables:');
    console.log('- GCS_PROJECT_ID:', process.env.GCS_PROJECT_ID);
    console.log('- GCS_BUCKET_NAME:', process.env.GCS_BUCKET_NAME);
    console.log('- GCS_CREDENTIALS available:', !!process.env.GCS_CREDENTIALS);
    
    res.status(200).json({
      success: true,
      message: 'Test endpoint working',
      environment: {
        nodeEnv: process.env.NODE_ENV,
        gcsProjectId: process.env.GCS_PROJECT_ID,
        gcsBucketName: process.env.GCS_BUCKET_NAME,
        hasCredentials: !!process.env.GCS_CREDENTIALS
      }
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}