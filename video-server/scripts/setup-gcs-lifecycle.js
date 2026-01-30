import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupGCSLifecycle() {
  try {
    console.log('🚀 Setting up GCS bucket lifecycle rules...\n');

    // Initialize GCS
    let credentials = null;
    
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    }

    if (!credentials) {
      throw new Error('GCS_CREDENTIALS not found in environment');
    }

    const storage = new Storage({ 
      projectId: process.env.GCS_PROJECT_ID,
      credentials: credentials
    });

    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME not found in environment');
    }

    const bucket = storage.bucket(bucketName);

    // Check if bucket exists
    const [exists] = await bucket.exists();
    if (!exists) {
      throw new Error(`Bucket ${bucketName} does not exist`);
    }

    console.log(`✅ Connected to bucket: ${bucketName}\n`);

    // Define lifecycle rules
    const lifecycleRules = [
      {
        action: {
          type: 'Delete'
        },
        condition: {
          age: 30,
          matchesPrefix: ['drafts/']
        }
      },
      {
        action: {
          type: 'Delete'
        },
        condition: {
          age: 1,
          matchesPrefix: ['temp/']
        }
      }
    ];

    console.log('📝 Applying lifecycle rules:');
    console.log('   - drafts/ folder: Delete after 30 days');
    console.log('   - temp/ folder: Delete after 1 day');
    console.log('   - videos/ folder: Keep permanently\n');

    // Apply lifecycle rules
    await bucket.setMetadata({
      lifecycle: {
        rule: lifecycleRules
      }
    });

    console.log('✅ Lifecycle rules configured successfully!\n');

    // Verify configuration
    const [metadata] = await bucket.getMetadata();
    if (metadata.lifecycle && metadata.lifecycle.rule) {
      console.log('📊 Current lifecycle rules:');
      console.log(JSON.stringify(metadata.lifecycle.rule, null, 2));
    }

    console.log('\n🎉 Setup complete!');

  } catch (error) {
    console.error('❌ Error setting up lifecycle rules:', error.message);
    process.exit(1);
  }
}

// Run setup
setupGCSLifecycle();
