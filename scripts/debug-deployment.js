#!/usr/bin/env node

/**
 * Deployment Debugging Script
 * 
 * This script helps diagnose common deployment issues:
 * 1. Environment variable configuration
 * 2. API endpoint availability
 * 3. GCS bucket access and CORS
 * 4. Firebase configuration
 */

import fetch from 'node-fetch';
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const REQUIRED_ENV_VARS = [
  'GCS_PROJECT_ID',
  'GCS_BUCKET_NAME',
  'GCS_CREDENTIALS',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'VITE_RAZORPAY_KEY_ID'
];

const API_ENDPOINTS = [
  '/api/signed-url',
  '/api/razorpay/create-order',
  '/api/razorpay/verify-payment'
];

async function checkEnvironmentVariables() {
  console.log('🔍 Checking Environment Variables...');
  
  const missing = [];
  const present = [];
  
  for (const varName of REQUIRED_ENV_VARS) {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }
  
  console.log(`✅ Present (${present.length}):`, present.join(', '));
  
  if (missing.length > 0) {
    console.log(`❌ Missing (${missing.length}):`, missing.join(', '));
    return false;
  }
  
  return true;
}

async function checkGCSAccess() {
  console.log('\n🔍 Checking Google Cloud Storage Access...');
  
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
    
    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    
    // Test bucket access
    const [exists] = await bucket.exists();
    if (!exists) {
      console.log('❌ Bucket does not exist or no access');
      return false;
    }
    
    console.log('✅ Bucket exists and accessible');
    
    // List first 5 files to check content
    const [files] = await bucket.getFiles({ maxResults: 5 });
    console.log(`📁 Sample files (${files.length}):`, files.map(f => f.name));
    
    // Check CORS configuration
    try {
      const [metadata] = await bucket.getMetadata();
      if (metadata.cors) {
        console.log('✅ CORS configured:', JSON.stringify(metadata.cors, null, 2));
      } else {
        console.log('⚠️ No CORS configuration found');
      }
    } catch (corsError) {
      console.log('⚠️ Could not check CORS:', corsError.message);
    }
    
    return true;
  } catch (error) {
    console.log('❌ GCS Access Error:', error.message);
    return false;
  }
}

async function checkAPIEndpoints(baseUrl = '') {
  console.log('\n🔍 Checking API Endpoints...');
  
  const results = [];
  
  for (const endpoint of API_ENDPOINTS) {
    const url = `${baseUrl}${endpoint}`;
    
    try {
      // Test with OPTIONS request first (CORS preflight)
      const optionsResponse = await fetch(url, { method: 'OPTIONS' });
      console.log(`OPTIONS ${endpoint}: ${optionsResponse.status}`);
      
      // Test with actual request
      let testResponse;
      if (endpoint === '/api/signed-url') {
        testResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: 'test', service: 'gcs' })
        });
      } else {
        testResponse = await fetch(url, { method: 'POST' });
      }
      
      console.log(`${endpoint}: ${testResponse.status} ${testResponse.statusText}`);
      results.push({ endpoint, status: testResponse.status, ok: testResponse.ok });
      
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`);
      results.push({ endpoint, status: 'ERROR', ok: false, error: error.message });
    }
  }
  
  return results;
}

async function testVideoSigning() {
  console.log('\n🔍 Testing Video Signing...');
  
  try {
    const testVideoIds = [
      '1767000659545_testVideoTitle_ab7d4670-4ea5-4b29-938d-a3cbd2bba2c5.mp4',
      '1767000659545_testVideoTitle_ab7d4670-4ea5-4b29-938d-a3cbd2bba2c5',
      'testVideoTitle_ab7d4670-4ea5-4b29-938d-a3cbd2bba2c5.mp4'
    ];
    
    for (const videoId of testVideoIds) {
      console.log(`\nTesting video ID: ${videoId}`);
      
      const response = await fetch('/api/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, service: 'gcs' })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Signed URL generated successfully');
        console.log('URL preview:', data.signedUrl.substring(0, 100) + '...');
      } else {
        const errorData = await response.json();
        console.log('❌ Signing failed:', errorData.error);
        if (errorData.similarFiles) {
          console.log('Similar files found:', errorData.similarFiles);
        }
      }
    }
  } catch (error) {
    console.log('❌ Video signing test failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Previu Deployment Diagnostics\n');
  
  const envOk = await checkEnvironmentVariables();
  const gcsOk = await checkGCSAccess();
  
  // Check API endpoints (local and production)
  console.log('\n--- Local Development ---');
  await checkAPIEndpoints('http://localhost:3001');
  
  console.log('\n--- Production ---');
  await checkAPIEndpoints('https://previu.online');
  
  // Test video signing if GCS is working
  if (gcsOk) {
    await testVideoSigning();
  }
  
  console.log('\n📋 Summary:');
  console.log(`Environment Variables: ${envOk ? '✅' : '❌'}`);
  console.log(`GCS Access: ${gcsOk ? '✅' : '❌'}`);
  
  if (!envOk || !gcsOk) {
    console.log('\n🔧 Recommended Actions:');
    if (!envOk) {
      console.log('- Check .env files and Vercel environment variables');
      console.log('- Ensure all required variables are set');
    }
    if (!gcsOk) {
      console.log('- Verify GCS credentials and permissions');
      console.log('- Check bucket name and project ID');
      console.log('- Configure CORS policy for the bucket');
    }
  }
}

// Run diagnostics
main().catch(console.error);