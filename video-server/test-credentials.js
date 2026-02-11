/**
 * Test script to verify GCS credentials are properly formatted
 * Run with: node video-server/test-credentials.js
 */

import { parseAndFixGCSCredentials, validatePrivateKey, logCredentialInfo } from './utils/credentialsHelper.js';
import { config } from 'dotenv';

// Load environment variables
config({ path: './video-server/.env' });

console.log('🔍 Testing GCS Credentials...\n');

// Test GCS_CREDENTIALS
if (process.env.GCS_CREDENTIALS) {
  console.log('✅ GCS_CREDENTIALS found in environment');
  
  try {
    const credentials = parseAndFixGCSCredentials(process.env.GCS_CREDENTIALS);
    
    if (credentials) {
      console.log('\n📋 Parsed Credentials:');
      logCredentialInfo(credentials, 'GCS_CREDENTIALS');
      
      // Validate private key
      if (credentials.private_key) {
        const validation = validatePrivateKey(credentials.private_key);
        
        console.log('\n🔐 Private Key Validation:');
        console.log(`  Status: ${validation.isValid ? '✅ VALID' : '❌ INVALID'}`);
        
        if (!validation.isValid) {
          console.log('  Errors:');
          validation.errors.forEach(error => console.log(`    • ${error}`));
        } else {
          console.log('  ✅ Private key is properly formatted');
          console.log('  ✅ JWT signatures should work correctly');
        }
      }
      
      // Test Storage initialization
      console.log('\n🗄️  Testing Storage Initialization...');
      try {
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage({
          projectId: credentials.project_id,
          credentials: credentials
        });
        
        console.log('  ✅ Storage client created successfully');
        
        // Try to access bucket
        if (process.env.GCS_BUCKET_NAME) {
          const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
          const [exists] = await bucket.exists();
          
          if (exists) {
            console.log(`  ✅ Bucket "${process.env.GCS_BUCKET_NAME}" is accessible`);
          } else {
            console.log(`  ⚠️  Bucket "${process.env.GCS_BUCKET_NAME}" not found`);
          }
        }
      } catch (storageError) {
        console.log('  ❌ Storage initialization failed:', storageError.message);
        
        if (storageError.message.includes('invalid_grant') || storageError.message.includes('Invalid JWT')) {
          console.log('\n  🔧 This indicates the private key still has formatting issues');
          console.log('  💡 Try re-downloading the service account key from Google Cloud Console');
        }
      }
      
    } else {
      console.log('❌ Failed to parse GCS_CREDENTIALS');
    }
  } catch (error) {
    console.log('❌ Error testing credentials:', error.message);
  }
} else {
  console.log('❌ GCS_CREDENTIALS not found in environment');
  console.log('💡 Make sure your .env file is in the correct location');
}

console.log('\n' + '='.repeat(60));
console.log('Test Complete');
console.log('='.repeat(60));
