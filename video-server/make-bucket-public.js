import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: JSON.parse(process.env.GCS_CREDENTIALS)
});

const bucketName = process.env.GCS_BUCKET_NAME;
const bucket = storage.bucket(bucketName);

async function makePublic() {
  try {
    console.log(`Making bucket ${bucketName} publicly readable...`);
    
    // Add allUsers as a viewer (Storage Object Viewer role)
    await bucket.iam.setPolicy({
      bindings: [
        {
          role: 'roles/storage.objectViewer',
          members: ['allUsers'],
        },
      ],
    });
    
    console.log('✅ Bucket is now publicly readable');
    console.log('All objects in this bucket can now be accessed via direct URLs');
  } catch (error) {
    console.error('❌ Error making bucket public:', error.message);
    console.error('Full error:', error);
  }
}

makePublic();
