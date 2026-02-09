#!/usr/bin/env node

/**
 * Extract the correct GCS_CREDENTIALS value for Render
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📋 Getting GCS Credentials for Render\n');
console.log('='.repeat(70));
console.log('');

try {
  // Read the .env file
  const envPath = path.join(__dirname, 'video-server', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Extract GCS_CREDENTIALS
  const match = envContent.match(/GCS_CREDENTIALS=(.+?)(?=\n[A-Z_]+=|$)/s);
  
  if (!match) {
    console.log('❌ GCS_CREDENTIALS not found in video-server/.env');
    process.exit(1);
  }
  
  const credentials = match[1].trim();
  
  // Verify it's valid JSON
  try {
    const parsed = JSON.parse(credentials);
    console.log('✅ Credentials are valid JSON');
    console.log('');
    console.log('📋 Credential Details:');
    console.log('   Project ID:', parsed.project_id);
    console.log('   Client Email:', parsed.client_email);
    console.log('   Private Key ID:', parsed.private_key_id);
    console.log('');
  } catch (e) {
    console.log('❌ Credentials are not valid JSON:', e.message);
    process.exit(1);
  }
  
  console.log('='.repeat(70));
  console.log('');
  console.log('📝 COPY THIS VALUE TO RENDER:');
  console.log('');
  console.log('Variable Name: GCS_CREDENTIALS');
  console.log('');
  console.log('Variable Value (copy everything below this line):');
  console.log('-'.repeat(70));
  console.log(credentials);
  console.log('-'.repeat(70));
  console.log('');
  console.log('⚠️  IMPORTANT:');
  console.log('   1. Copy the ENTIRE line above (it\'s all one line)');
  console.log('   2. Do NOT add extra quotes or spaces');
  console.log('   3. Paste it exactly as shown into Render');
  console.log('');
  console.log('📍 Steps to Update in Render:');
  console.log('   1. Go to https://dashboard.render.com/');
  console.log('   2. Select your video-server service');
  console.log('   3. Click "Environment" in the sidebar');
  console.log('   4. Find GCS_CREDENTIALS and click Edit');
  console.log('   5. Delete the old value');
  console.log('   6. Paste the new value from above');
  console.log('   7. Click "Save Changes"');
  console.log('   8. Wait for automatic redeploy');
  console.log('');
  console.log('🗑️  Also Delete These Variables (if they exist):');
  console.log('   - GCS_CREDENTIALS_BASE64 (old/wrong credentials)');
  console.log('');
  
  // Also save to a file for easy copying
  const outputPath = path.join(__dirname, 'RENDER_GCS_CREDENTIALS.txt');
  fs.writeFileSync(outputPath, credentials, 'utf8');
  console.log('💾 Credentials also saved to: RENDER_GCS_CREDENTIALS.txt');
  console.log('   You can open this file and copy from there if easier');
  console.log('');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
