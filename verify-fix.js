#!/usr/bin/env node

/**
 * Comprehensive verification that the GCS credentials fix is applied correctly
 */

import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verifying GCS Credentials Fix\n');
console.log('='.repeat(60));
console.log('');

let hasErrors = false;

// 1. Check .env.local is disabled
console.log('1️⃣  Checking .env.local status...');
const envLocalPath = join(__dirname, 'video-server', '.env.local');
const envLocalBackupPath = join(__dirname, 'video-server', '.env.local.backup');

if (fs.existsSync(envLocalPath)) {
  console.log('   ❌ .env.local still exists!');
  console.log('   💡 This file should be renamed to .env.local.backup');
  hasErrors = true;
} else {
  console.log('   ✅ .env.local is disabled');
}

if (fs.existsSync(envLocalBackupPath)) {
  console.log('   ✅ .env.local.backup exists (old credentials backed up)');
}

console.log('');

// 2. Load and check video-server/.env
console.log('2️⃣  Loading video-server/.env...');
dotenv.config({ path: join(__dirname, 'video-server', '.env') });

if (!process.env.GCS_CREDENTIALS) {
  console.log('   ❌ GCS_CREDENTIALS not found!');
  hasErrors = true;
  process.exit(1);
}

console.log('   ✅ GCS_CREDENTIALS found');
console.log('');

// 3. Parse and validate credentials
console.log('3️⃣  Validating credentials format...');
let credentials;
try {
  credentials = JSON.parse(process.env.GCS_CREDENTIALS);
  console.log('   ✅ JSON parses correctly');
} catch (e) {
  console.log('   ❌ Failed to parse JSON:', e.message);
  hasErrors = true;
  process.exit(1);
}

console.log('');
console.log('4️⃣  Checking credential details...');
console.log('   Project ID:', credentials.project_id);
console.log('   Client Email:', credentials.client_email);
console.log('   Private Key ID:', credentials.private_key_id);

// Verify it's the correct project
if (credentials.project_id !== 'veedo-401e0') {
  console.log('   ❌ Wrong project! Expected veedo-401e0');
  hasErrors = true;
} else {
  console.log('   ✅ Correct project (veedo-401e0)');
}

// Verify it's the correct service account
if (credentials.client_email !== 'previu@veedo-401e0.iam.gserviceaccount.com') {
  console.log('   ❌ Wrong service account!');
  hasErrors = true;
} else {
  console.log('   ✅ Correct service account');
}

// Verify it's the correct key
if (credentials.private_key_id !== '7d034b84f0d9c63c230d1262193f15ba93d5e60f') {
  console.log('   ⚠️  Different private key ID');
  console.log('   💡 This might be okay if you regenerated the key');
} else {
  console.log('   ✅ Expected private key ID');
}

console.log('');

// 4. Check private key format
console.log('5️⃣  Checking private key format...');
if (!credentials.private_key) {
  console.log('   ❌ Private key missing!');
  hasErrors = true;
} else {
  const hasActualNewlines = credentials.private_key.includes('\n');
  const hasEscapedNewlines = credentials.private_key.includes('\\n');
  
  if (hasActualNewlines && !hasEscapedNewlines) {
    console.log('   ✅ Private key has proper newlines');
  } else if (hasEscapedNewlines) {
    console.log('   ⚠️  Private key has escaped newlines');
    console.log('   💡 Server code will fix this automatically');
  } else {
    console.log('   ❌ Private key format unclear');
    hasErrors = true;
  }
  
  if (credentials.private_key.startsWith('-----BEGIN PRIVATE KEY-----')) {
    console.log('   ✅ Private key has correct header');
  } else {
    console.log('   ❌ Private key missing header');
    hasErrors = true;
  }
}

console.log('');

// 5. Test authentication
console.log('6️⃣  Testing Google Cloud Storage authentication...');

try {
  // Apply the same fix the server does
  let fixedCredentials = { ...credentials };
  if (fixedCredentials.private_key) {
    fixedCredentials.private_key = fixedCredentials.private_key.replace(/\\n/g, '\n');
  }
  
  const storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials: fixedCredentials
  });
  
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const [exists] = await bucket.exists();
  
  if (exists) {
    console.log('   ✅ Successfully authenticated with GCS!');
    console.log('   ✅ Bucket is accessible');
    
    // Try to list a file
    const [files] = await bucket.getFiles({ maxResults: 1 });
    if (files.length > 0) {
      console.log('   ✅ Can list files in bucket');
    }
  } else {
    console.log('   ❌ Bucket not accessible');
    hasErrors = true;
  }
} catch (error) {
  console.log('   ❌ Authentication failed:', error.message);
  
  if (error.message.includes('invalid_grant')) {
    console.log('   💡 The service account key is still invalid');
    console.log('   💡 You may need to generate a new key from Google Cloud Console');
  }
  
  hasErrors = true;
}

console.log('');
console.log('='.repeat(60));
console.log('');

if (hasErrors) {
  console.log('❌ VERIFICATION FAILED');
  console.log('');
  console.log('There are still issues with the credentials.');
  console.log('Please review the errors above and fix them.');
  console.log('');
  process.exit(1);
} else {
  console.log('✅ VERIFICATION PASSED');
  console.log('');
  console.log('🎉 All checks passed! Your credentials are configured correctly.');
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Restart your video server');
  console.log('   2. Test the watch page');
  console.log('   3. Verify no "invalid_grant" errors in browser console');
  console.log('');
  console.log('💡 To restart the server:');
  console.log('   cd video-server && npm start');
  console.log('');
}
