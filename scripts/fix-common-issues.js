#!/usr/bin/env node

/**
 * Quick Fix Script for Common Previu Issues
 * 
 * This script attempts to fix the most common deployment and runtime issues:
 * 1. Configure GCS CORS
 * 2. Verify and fix file paths
 * 3. Test API endpoints
 */

import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function fixGCSCORS() {
  console.log('🔧 Configuring GCS CORS...');
  
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
    console.log('✅ CORS configuration updated successfully');
    
    return true;
  } catch (error) {
    console.log('❌ CORS configuration failed:', error.message);
    return false;
  }
}

async function listAndAnalyzeFiles() {
  console.log('\n🔍 Analyzing bucket contents...');
  
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
    
    const [files] = await bucket.getFiles({ maxResults: 50 });
    
    console.log(`📁 Found ${files.length} files in bucket:`);
    
    const filesByFolder = {};
    const videoFiles = [];
    
    files.forEach(file => {
      const name = file.name;
      console.log(`  - ${name}`);
      
      // Categorize by folder
      const folder = name.includes('/') ? name.split('/')[0] : 'root';
      if (!filesByFolder[folder]) filesByFolder[folder] = [];
      filesByFolder[folder].push(name);
      
      // Identify video files
      if (name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.avi')) {
        videoFiles.push(name);
      }
    });
    
    console.log('\n📊 File organization:');
    Object.entries(filesByFolder).forEach(([folder, files]) => {
      console.log(`  ${folder}: ${files.length} files`);
    });
    
    console.log('\n🎥 Video files found:');
    videoFiles.forEach(video => {
      console.log(`  - ${video}`);
    });
    
    // Check for the specific problematic file
    const problematicFile = '1767000659545_testVideoTitle_ab7d4670-4ea5-4b29-938d-a3cbd2bba2c5.mp4';
    const foundProblematic = files.find(f => 
      f.name.includes('1767000659545') || 
      f.name.includes('testVideoTitle') ||
      f.name === problematicFile
    );
    
    if (foundProblematic) {
      console.log(`\n🎯 Found problematic file: ${foundProblematic.name}`);
      
      // Test if it's accessible
      try {
        const [signedUrl] = await foundProblematic.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });
        console.log('✅ File is accessible, signed URL generated');
        console.log('URL preview:', signedUrl.substring(0, 100) + '...');
      } catch (signError) {
        console.log('❌ File access failed:', signError.message);
      }
    } else {
      console.log('\n⚠️ Problematic file not found in bucket');
    }
    
    return true;
  } catch (error) {
    console.log('❌ File analysis failed:', error.message);
    return false;
  }
}

async function testFileAccess() {
  console.log('\n🧪 Testing file access patterns...');
  
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
    
    // Test different path patterns
    const testPaths = [
      '1767000659545_testVideoTitle_ab7d4670-4ea5-4b29-938d-a3cbd2bba2c5.mp4',
      'uploads/1767000659545_testVideoTitle_ab7d4670-4ea5-4b29-938d-a3cbd2bba2c5.mp4',
      'videos/1767000659545_testVideoTitle_ab7d4670-4ea5-4b29-938d-a3cbd2bba2c5.mp4',
      '1767000659545_testVideoTitle_ab7d4670-4ea5-4b29-938d-a3cbd2bba2c5',
    ];
    
    for (const path of testPaths) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      console.log(`${exists ? '✅' : '❌'} ${path}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ File access test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Previu Quick Fix Script\n');
  
  // Check if required environment variables are present
  if (!process.env.GCS_PROJECT_ID || !process.env.GCS_BUCKET_NAME || !process.env.GCS_CREDENTIALS) {
    console.log('❌ Missing required environment variables');
    console.log('Required: GCS_PROJECT_ID, GCS_BUCKET_NAME, GCS_CREDENTIALS');
    return;
  }
  
  const corsFixed = await fixGCSCORS();
  const filesAnalyzed = await listAndAnalyzeFiles();
  const accessTested = await testFileAccess();
  
  console.log('\n📋 Fix Summary:');
  console.log(`CORS Configuration: ${corsFixed ? '✅' : '❌'}`);
  console.log(`File Analysis: ${filesAnalyzed ? '✅' : '❌'}`);
  console.log(`Access Testing: ${accessTested ? '✅' : '❌'}`);
  
  if (corsFixed && filesAnalyzed && accessTested) {
    console.log('\n🎉 All fixes applied successfully!');
    console.log('Try accessing your videos again.');
  } else {
    console.log('\n⚠️ Some fixes failed. Check the error messages above.');
  }
}

// Run fixes
main().catch(console.error);