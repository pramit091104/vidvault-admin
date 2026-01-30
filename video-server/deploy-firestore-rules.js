#!/usr/bin/env node

/**
 * Deploy Firestore Security Rules
 * 
 * This script deploys the Firestore security rules to fix the subscription update
 * permission errors.
 * 
 * Usage:
 *   npm run deploy:rules
 *   or
 *   node deploy-firestore-rules.js
 */

import { execSync } from 'child_process';

console.log('🚀 Deploying Firestore Security Rules...');

try {
  // Deploy only Firestore rules (not hosting)
  execSync('firebase deploy --only firestore:rules', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('✅ Firestore security rules deployed successfully!');
  console.log('📝 The subscription update API should now work properly.');
  
} catch (error) {
  console.error('❌ Failed to deploy Firestore rules:', error.message);
  console.log('\n📋 Manual deployment steps:');
  console.log('1. Run: firebase login');
  console.log('2. Run: firebase deploy --only firestore:rules');
  process.exit(1);
}