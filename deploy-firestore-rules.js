/**
 * Deploy Firestore Security Rules
 * Run with: node deploy-firestore-rules.js
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

console.log('🔐 Deploying Firestore Security Rules...\n');

try {
  // Read the rules file to show what's being deployed
  const rules = readFileSync('./firestore.rules', 'utf8');
  
  console.log('📋 Rules to be deployed:');
  console.log('─'.repeat(60));
  console.log(rules);
  console.log('─'.repeat(60));
  console.log();

  // Deploy the rules
  console.log('🚀 Deploying to Firebase...');
  execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
  
  console.log('\n✅ Firestore rules deployed successfully!');
  console.log('\n📝 Key changes:');
  console.log('  • Anonymous users can now create comments');
  console.log('  • Only authenticated users can update/delete comments');
  console.log('  • Public read access maintained for all comments');
  console.log('\n⚠️  Note: Changes may take a few seconds to propagate');
  
} catch (error) {
  console.error('\n❌ Error deploying rules:', error.message);
  console.error('\n💡 Make sure you have:');
  console.error('  1. Firebase CLI installed (npm install -g firebase-tools)');
  console.error('  2. Logged in to Firebase (firebase login)');
  console.error('  3. Initialized Firebase in this project (firebase init)');
  process.exit(1);
}
