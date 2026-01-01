import { Storage } from '@google-cloud/storage';

// Initialize Google Cloud Storage
let bucket = null;

if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    let credentials = null;
    
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    }
    
    const storage = new Storage({ 
      projectId: process.env.GCS_PROJECT_ID,
      credentials: credentials
    });
    bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    
    console.log('✅ GCS initialized for lifecycle configuration');
  } catch (error) {
    console.error('❌ Failed to initialize GCS:', error.message);
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    console.log('📝 Configuring bucket lifecycle rules...');

    // Define lifecycle rules
    const lifecycleRules = [
      {
        action: {
          type: 'Delete'
        },
        condition: {
          age: 30, // Delete after 30 days
          matchesPrefix: ['drafts/'] // Only apply to drafts folder
        }
      },
      {
        action: {
          type: 'Delete'
        },
        condition: {
          age: 1, // Delete after 1 day
          matchesPrefix: ['temp/'] // Temporary files
        }
      }
      // Final videos in 'videos/' folder are kept permanently (no rule)
    ];

    // Apply lifecycle rules to bucket
    await bucket.setMetadata({
      lifecycle: {
        rule: lifecycleRules
      }
    });

    console.log('✅ Lifecycle rules configured successfully');

    res.status(200).json({
      success: true,
      message: 'Lifecycle rules configured successfully',
      rules: lifecycleRules
    });

  } catch (error) {
    console.error('❌ Error configuring lifecycle rules:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
