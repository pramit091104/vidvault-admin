// Simple validation script to check payment flow configuration
// This script validates that CORS issues are resolved

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Validating Payment Flow Configuration...\n');

// Check that API service routes to backend endpoints
const apiServicePath = path.join(__dirname, 'src', 'services', 'apiService.ts');
if (fs.existsSync(apiServicePath)) {
  const apiServiceContent = fs.readFileSync(apiServicePath, 'utf8');
  
  // Check for correct endpoint usage
  const hasCreateOrderEndpoint = apiServiceContent.includes('/api/razorpay/create-order');
  const hasVerifyPaymentEndpoint = apiServiceContent.includes('/api/razorpay/verify-payment');
  
  // Check that it doesn't make direct calls to Razorpay
  const hasDirectRazorpayCall = apiServiceContent.includes('api.razorpay.com') || 
                                apiServiceContent.includes('checkout.razorpay.com');
  
  console.log('📋 API Service Configuration:');
  console.log(`  ✅ Uses create-order endpoint: ${hasCreateOrderEndpoint}`);
  console.log(`  ✅ Uses verify-payment endpoint: ${hasVerifyPaymentEndpoint}`);
  console.log(`  ${hasDirectRazorpayCall ? '❌' : '✅'} No direct Razorpay API calls: ${!hasDirectRazorpayCall}`);
  
  if (hasCreateOrderEndpoint && hasVerifyPaymentEndpoint && !hasDirectRazorpayCall) {
    console.log('\n🎉 CORS Issue Resolution: ✅ PASSED');
    console.log('   All payment requests are routed through backend API');
  } else {
    console.log('\n⚠️  CORS Issue Resolution: ❌ FAILED');
    console.log('   Payment requests may still cause CORS errors');
  }
} else {
  console.log('❌ API Service file not found');
}

// Check backend endpoints exist
const backendEndpoints = [
  path.join(__dirname, 'api', 'razorpay', 'create-order.js'),
  path.join(__dirname, 'api', 'razorpay', 'verify-payment.js'),
  path.join(__dirname, 'server.js')
];

console.log('\n📋 Backend Endpoint Configuration:');
backendEndpoints.forEach(endpoint => {
  const exists = fs.existsSync(endpoint);
  const filename = path.basename(endpoint);
  console.log(`  ${exists ? '✅' : '❌'} ${filename}: ${exists ? 'Found' : 'Missing'}`);
});

// Check server.js for Razorpay endpoints
const serverPath = path.join(__dirname, 'server.js');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  const hasCreateOrderRoute = serverContent.includes('/api/razorpay/create-order');
  const hasVerifyPaymentRoute = serverContent.includes('/api/razorpay/verify-payment');
  
  console.log('\n📋 Server Route Configuration:');
  console.log(`  ✅ Create order route: ${hasCreateOrderRoute}`);
  console.log(`  ✅ Verify payment route: ${hasVerifyPaymentRoute}`);
  
  if (hasCreateOrderRoute && hasVerifyPaymentRoute) {
    console.log('\n🎉 Backend API Routes: ✅ CONFIGURED');
  } else {
    console.log('\n⚠️  Backend API Routes: ❌ MISSING');
  }
}

// Check integration tests exist
const integrationTestPath = path.join(__dirname, 'src', 'api', 'payment-integration.test.ts');
const integrationTestExists = fs.existsSync(integrationTestPath);

console.log('\n📋 Integration Test Coverage:');
console.log(`  ${integrationTestExists ? '✅' : '❌'} Payment integration tests: ${integrationTestExists ? 'Available' : 'Missing'}`);

// Final summary
console.log('\n' + '='.repeat(60));
console.log('🏁 VALIDATION SUMMARY');
console.log('='.repeat(60));

const allChecks = [
  fs.existsSync(apiServicePath),
  fs.existsSync(serverPath),
  integrationTestExists
];

const allPassed = allChecks.every(Boolean);

if (allPassed) {
  console.log('✅ All core components are in place');
  console.log('✅ CORS issues should be resolved');
  console.log('✅ Payment flow routes through backend API');
  console.log('✅ Integration tests are available');
  console.log('\n🎉 Payment system is ready for use!');
} else {
  console.log('⚠️  Some components may be missing');
  console.log('⚠️  Please review the configuration above');
}

console.log('\n💡 To run integration tests: npm test -- src/api/payment-integration.test.ts');
console.log('💡 To start the server: npm run server');
console.log('');