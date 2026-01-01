#!/usr/bin/env node

/**
 * Migration Test Script - Phase 8
 * Tests the integration of Uppy upload system with existing dashboard
 */

import fs from 'fs';
import path from 'path';

console.log('🚀 Testing Migration Phase 8 - Uppy Integration\n');

// Test 1: Check if required files exist
const requiredFiles = [
  'src/components/dashboard/SmartUploadSection.tsx',
  'src/components/dashboard/UppyUploadSection.tsx',
  'src/components/dashboard/UploadSection.tsx',
  'src/config/features.ts',
  'src/components/dashboard/MigrationStatus.tsx',
  'src/pages/Dashboard.tsx'
];

console.log('📁 Checking required files...');
let filesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    filesExist = false;
  }
});

// Test 2: Check environment configuration
console.log('\n🔧 Checking environment configuration...');
const envFile = '.env';
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const requiredEnvVars = [
    'VITE_UPLOAD_SIMPLE_MAX_SIZE',
    'VITE_UPLOAD_RESUMABLE_MAX_SIZE',
    'VITE_UPLOAD_CHUNK_SIZE'
  ];
  
  requiredEnvVars.forEach(envVar => {
    if (envContent.includes(envVar)) {
      console.log(`✅ ${envVar}`);
    } else {
      console.log(`❌ ${envVar} - MISSING`);
      filesExist = false;
    }
  });
} else {
  console.log('❌ .env file not found');
  filesExist = false;
}

// Test 3: Check Dashboard integration
console.log('\n🎛️ Checking Dashboard integration...');
const dashboardFile = 'src/pages/Dashboard.tsx';
if (fs.existsSync(dashboardFile)) {
  const dashboardContent = fs.readFileSync(dashboardFile, 'utf8');
  
  if (dashboardContent.includes('SmartUploadSection')) {
    console.log('✅ SmartUploadSection imported and used');
  } else {
    console.log('❌ SmartUploadSection not found in Dashboard');
    filesExist = false;
  }
  
  if (dashboardContent.includes('MigrationStatus')) {
    console.log('✅ MigrationStatus imported and used');
  } else {
    console.log('❌ MigrationStatus not found in Dashboard');
    filesExist = false;
  }
}

// Test 4: Check feature configuration
console.log('\n⚙️ Checking feature configuration...');
const featuresFile = 'src/config/features.ts';
if (fs.existsSync(featuresFile)) {
  const featuresContent = fs.readFileSync(featuresFile, 'utf8');
  
  const requiredFeatures = [
    'UPPY_UPLOAD',
    'SIMPLE_UPLOAD',
    'AUTO_SELECT_METHOD',
    'getUploadMethod',
    'formatFileSize',
    'isFileSizeValid'
  ];
  
  requiredFeatures.forEach(feature => {
    if (featuresContent.includes(feature)) {
      console.log(`✅ ${feature}`);
    } else {
      console.log(`❌ ${feature} - MISSING`);
      filesExist = false;
    }
  });
}

// Test 5: Check API endpoints
console.log('\n🌐 Checking API endpoints...');
const apiFiles = [
  'api/gcs/resumable-upload-url.js',
  'api/gcs/finalize-upload.js'
];

apiFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`⚠️ ${file} - Not found (may need to be created)`);
  }
});

// Summary
console.log('\n📊 Migration Test Summary');
console.log('========================');

if (filesExist) {
  console.log('✅ All core migration components are in place');
  console.log('✅ Environment configuration is complete');
  console.log('✅ Dashboard integration is successful');
  console.log('✅ Feature configuration is properly set up');
  console.log('\n🎉 Migration Phase 8 is READY for testing!');
  
  console.log('\n📋 Next Steps:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Navigate to /dashboard');
  console.log('3. Test the Upload Video section');
  console.log('4. Try uploading files < 100MB (should use Simple Upload)');
  console.log('5. Try uploading files > 100MB (should use Uppy Upload)');
  console.log('6. Check the Migration Status section');
  console.log('7. Monitor both upload methods work correctly');
  
  process.exit(0);
} else {
  console.log('❌ Migration has missing components');
  console.log('🔧 Please fix the missing items above before testing');
  process.exit(1);
}