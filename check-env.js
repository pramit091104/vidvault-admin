#!/usr/bin/env node

// Environment validation script
// Run with: npm run check-env

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=');
        process.env[key] = value;
      }
    }
  });
}

// Required environment variables
const requiredVars = {
  backend: [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    // Firebase/GCS credentials (at least one required)
    // 'GCS_CREDENTIALS', 'GCS_CREDENTIALS_BASE64', or 'FIREBASE_SERVICE_ACCOUNT_KEY'
    'GCS_PROJECT_ID' // or 'FIREBASE_PROJECT_ID'
  ],
  frontend: [
    'VITE_RAZORPAY_KEY_ID'
  ]
};

// Firebase credentials check (at least one must be present)
const firebaseCredentialVars = [
  'GCS_CREDENTIALS',
  'GCS_CREDENTIALS_BASE64', 
  'FIREBASE_SERVICE_ACCOUNT_KEY'
];

// Placeholder values that should be replaced
const placeholderValues = [
  'your_razorpay_key_id_here',
  'your_razorpay_key_secret_here'
];

console.log('🔍 Checking environment configuration...\n');

let hasErrors = false;

// Check Firebase credentials
console.log('🔥 Firebase Configuration:');
const hasFirebaseCredentials = firebaseCredentialVars.some(varName => {
  const value = process.env[varName];
  if (value && value.trim() !== '') {
    console.log(`  ✅ ${varName}: Present`);
    
    // Validate JSON format for credential variables
    if (varName !== 'GCS_CREDENTIALS_BASE64') {
      try {
        JSON.parse(value);
        console.log(`  ✅ ${varName}: Valid JSON format`);
      } catch (e) {
        console.log(`  ❌ ${varName}: Invalid JSON format`);
        hasErrors = true;
      }
    }
    return true;
  }
  return false;
});

if (!hasFirebaseCredentials) {
  console.log('  ❌ No Firebase credentials found. At least one of the following is required:');
  firebaseCredentialVars.forEach(varName => {
    console.log(`     - ${varName}`);
  });
  hasErrors = true;
}

// Check Firebase Project ID
const projectId = process.env.GCS_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
if (projectId) {
  console.log(`  ✅ Project ID: ${projectId}`);
} else {
  console.log('  ❌ Missing GCS_PROJECT_ID or FIREBASE_PROJECT_ID');
  hasErrors = true;
}

console.log('');
const errors = [];
const warnings = [];

// Check backend variables
console.log('📋 Backend Environment Variables:');
requiredVars.backend.forEach(varName => {
  const value = process.env[varName];
  
  if (!value) {
    console.log(`❌ ${varName}: NOT SET`);
    errors.push(`Missing required variable: ${varName}`);
    hasErrors = true;
  } else if (placeholderValues.includes(value)) {
    console.log(`⚠️  ${varName}: SET TO PLACEHOLDER VALUE`);
    warnings.push(`${varName} is set to placeholder value, please update with actual credentials`);
    hasErrors = true;
  } else {
    console.log(`✅ ${varName}: SET (${value.substring(0, 8)}...)`);
  }
});

console.log('\n📋 Frontend Environment Variables:');
requiredVars.frontend.forEach(varName => {
  const value = process.env[varName];
  
  if (!value) {
    console.log(`❌ ${varName}: NOT SET`);
    errors.push(`Missing required variable: ${varName}`);
    hasErrors = true;
  } else if (placeholderValues.includes(value)) {
    console.log(`⚠️  ${varName}: SET TO PLACEHOLDER VALUE`);
    warnings.push(`${varName} is set to placeholder value, please update with actual credentials`);
    hasErrors = true;
  } else {
    console.log(`✅ ${varName}: SET (${value.substring(0, 8)}...)`);
  }
});

// Check if .env file exists
console.log('\n📋 Configuration Files:');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file: EXISTS');
} else {
  console.log('⚠️  .env file: NOT FOUND');
  warnings.push('.env file not found, using system environment variables');
}

if (fs.existsSync('.env.example')) {
  console.log('✅ .env.example file: EXISTS');
} else {
  console.log('⚠️  .env.example file: NOT FOUND');
}

// Summary
console.log('\n📊 Summary:');
if (hasErrors) {
  console.log('❌ Environment validation FAILED\n');
  
  if (errors.length > 0) {
    console.log('🚨 Errors:');
    errors.forEach(error => console.log(`   • ${error}`));
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   • ${warning}`));
    console.log('');
  }
  
  console.log('💡 To fix these issues:');
  console.log('   1. Copy .env.example to .env: cp .env.example .env');
  console.log('   2. Edit .env and replace placeholder values with actual credentials');
  console.log('   3. Ensure all required variables are set');
  console.log('   4. Run this script again to verify: node check-env.js');
  
  process.exit(1);
} else {
  console.log('✅ Environment validation PASSED');
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   • ${warning}`));
  }
  
  console.log('\n🎉 All required environment variables are properly configured!');
  process.exit(0);
}