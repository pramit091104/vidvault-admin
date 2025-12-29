#!/usr/bin/env node

/**
 * Setup Script for veedo-401e0 Project Migration
 * 
 * This script helps you set up the new project configuration
 * and validates that everything is working correctly.
 */

import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const NEW_PROJECT_ID = 'veedo-401e0';
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'previu_videos';

async function checkProjectSetup() {
  console.log('🔍 Checking veedo-401e0 project setup...\n');
  
  // Check if credentials are for the correct project
  if (process.env.GCS_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      
      if (credentials.project_id === NEW_PROJECT_ID) {
        console.log('✅ GCS credentials are for the correct project:', NEW_PROJECT_ID);
      } else {
        console.log('❌ GCS credentials are for wrong project:', credentials.project_id);
        console.log('   Expected:', NEW_PROJECT_ID);
        return false;
      }
    } catch (error) {
      console.log('❌ Invalid GCS credentials JSON:', error.message);
      return false;
    }
  } else {
    console.log('❌ GCS_CREDENTIALS not found in environment');
    return false;
  }
  
  return true;
}

async function testGCSConnection() {
  console.log('\n🔗 Testing GCS connection...');
  
  try {
    let credentials = null;
    
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    }
    
    const storage = new Storage({
      projectId: NEW_PROJECT_ID,
      credentials: credentials
    });
    
    // Test if we can access the project
    const [buckets] = await storage.getBuckets();
    console.log('✅ Successfully connected to GCS');
    console.log(`📁 Found ${buckets.length} buckets in project`);
    
    // Check if our target bucket exists
    const targetBucket = buckets.find(b => b.name === BUCKET_NAME);
    if (targetBucket) {
      console.log(`✅ Target bucket '${BUCKET_NAME}' exists`);
      
      // Test bucket access
      const bucket = storage.bucket(BUCKET_NAME);
      const [files] = await bucket.getFiles({ maxResults: 5 });
      console.log(`📄 Bucket contains ${files.length} files (showing first 5)`);
      
      return true;
    } else {
      console.log(`❌ Target bucket '${BUCKET_NAME}' not found`);
      console.log('Available buckets:', buckets.map(b => b.name).join(', '));
      return false;
    }
    
  } catch (error) {
    console.log('❌ GCS connection failed:', error.message);
    return false;
  }
}

async function createBucketIfNeeded() {
  console.log(`\n🪣 Checking if bucket '${BUCKET_NAME}' needs to be created...`);
  
  try {
    let credentials = null;
    
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    }
    
    const storage = new Storage({
      projectId: NEW_PROJECT_ID,
      credentials: credentials
    });
    
    const bucket = storage.bucket(BUCKET_NAME);
    const [exists] = await bucket.exists();
    
    if (exists) {
      console.log(`✅ Bucket '${BUCKET_NAME}' already exists`);
      return true;
    }
    
    console.log(`📝 Creating bucket '${BUCKET_NAME}'...`);
    
    await storage.createBucket(BUCKET_NAME, {
      location: 'US', // Change this to your preferred location
      storageClass: 'STANDARD',
      uniformBucketLevelAccess: true,
    });
    
    console.log(`✅ Successfully created bucket '${BUCKET_NAME}'`);
    return true;
    
  } catch (error) {
    console.log('❌ Failed to create bucket:', error.message);
    return false;
  }
}

async function configureCORS() {
  console.log('\n🌐 Configuring CORS for bucket...');
  
  try {
    let credentials = null;
    
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    }
    
    const storage = new Storage({
      projectId: NEW_PROJECT_ID,
      credentials: credentials
    });
    
    const bucket = storage.bucket(BUCKET_NAME);
    
    const corsConfig = [
      {
        origin: [
          'http://localhost:3001',
          'http://localhost:8080',
          'http://localhost:5173',
          'https://previu.online'
        ],
        method: ['GET', 'HEAD', 'OPTIONS'],
        responseHeader: [
          'Content-Type',
          'Content-Length',
          'Accept-Ranges',
          'Range',
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Methods',
          'Access-Control-Allow-Headers'
        ],
        maxAgeSeconds: 3600,
      },
    ];
    
    await bucket.setMetadata({ cors: corsConfig });
    console.log('✅ CORS configuration applied successfully');
    
    return true;
  } catch (error) {
    console.log('❌ CORS configuration failed:', error.message);
    return false;
  }
}

async function generateSetupInstructions() {
  console.log('\n📋 Setup Instructions:\n');
  
  if (!process.env.GCS_CREDENTIALS || !process.env.GCS_CREDENTIALS.includes(NEW_PROJECT_ID)) {
    console.log('🔧 You need to update your GCS credentials:');
    console.log('1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=veedo-401e0');
    console.log('2. Create a new service account or use existing one');
    console.log('3. Grant these roles:');
    console.log('   - Storage Object Admin');
    console.log('   - Storage Admin');
    console.log('4. Create and download a JSON key');
    console.log('5. Update your .env.vercel file with the new credentials');
    console.log('6. Update Vercel environment variables\n');
  }
  
  console.log('🚀 After updating credentials, run:');
  console.log('   npm run setup:project  # Run this script again');
  console.log('   npm run debug:deployment  # Test everything');
  console.log('   npm run build && deploy  # Deploy to production\n');
}

async function main() {
  console.log('🚀 veedo-401e0 Project Setup\n');
  
  const projectOk = await checkProjectSetup();
  
  if (!projectOk) {
    await generateSetupInstructions();
    return;
  }
  
  const connectionOk = await testGCSConnection();
  
  if (!connectionOk) {
    const bucketCreated = await createBucketIfNeeded();
    if (bucketCreated) {
      await configureCORS();
    }
  } else {
    await configureCORS();
  }
  
  console.log('\n🎉 Setup Summary:');
  console.log(`Project ID: ${NEW_PROJECT_ID}`);
  console.log(`Bucket Name: ${BUCKET_NAME}`);
  console.log('Status: Ready for testing!');
  
  console.log('\n🧪 Next Steps:');
  console.log('1. Deploy your updated configuration to Vercel');
  console.log('2. Test video upload and playback');
  console.log('3. Run: npm run debug:deployment');
}

// Run setup
main().catch(console.error);