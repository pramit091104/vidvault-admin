#!/usr/bin/env node

/**
 * Debug script to identify which dependency is causing the url.parse() deprecation warning
 */

// Capture deprecation warnings
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.code === 'DEP0169') {
    console.log('\n🚨 Found DEP0169 warning:');
    console.log('Name:', warning.name);
    console.log('Message:', warning.message);
    console.log('Code:', warning.code);
    console.log('Stack trace:');
    console.log(warning.stack);
    console.log('\n');
  }
});

// Import common dependencies one by one to isolate the issue
console.log('🔍 Testing dependencies for url.parse() usage...\n');

try {
  console.log('Testing express...');
  await import('express');
  console.log('✅ express loaded');
} catch (e) {
  console.log('❌ express failed:', e.message);
}

try {
  console.log('Testing cors...');
  await import('cors');
  console.log('✅ cors loaded');
} catch (e) {
  console.log('❌ cors failed:', e.message);
}

try {
  console.log('Testing multer...');
  await import('multer');
  console.log('✅ multer loaded');
} catch (e) {
  console.log('❌ multer failed:', e.message);
}

try {
  console.log('Testing @google-cloud/storage...');
  const { Storage } = await import('@google-cloud/storage');
  console.log('✅ @google-cloud/storage loaded');
} catch (e) {
  console.log('❌ @google-cloud/storage failed:', e.message);
}

try {
  console.log('Testing razorpay...');
  await import('razorpay');
  console.log('✅ razorpay loaded');
} catch (e) {
  console.log('❌ razorpay failed:', e.message);
}

console.log('\n✅ Dependency test complete');